const axios = require('axios');

class GitHubService {
  constructor(token, username) {
    this.token = token;
    this.username = username;
    this.baseURL = 'https://api.github.com';
    this.headers = {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json'
    };
  }

  /**
   * Obtiene todos los repositorios del usuario (públicos y privados)
   */
  async getRepositories() {
    try {
      const response = await axios.get(`${this.baseURL}/user/repos`, {
        headers: this.headers,
        params: {
          visibility: 'all',
          affiliation: 'owner',
          sort: 'updated',
          direction: 'desc',
          per_page: 100
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error al obtener repositorios:', error.message);
      return [];
    }
  }

  /**
   * Obtiene el README.md limitado a las primeras 40 líneas
   */
  async getReadme(repoName) {
    try {
      const response = await axios.get(
        `${this.baseURL}/repos/${this.username}/${repoName}/readme`,
        {
          headers: {
            ...this.headers,
            'Accept': 'application/vnd.github.v3.raw'
          }
        }
      );
      
      // Limitar a 40 líneas
      const lines = response.data.split('\n');
      const limitedContent = lines.slice(0, 40).join('\n');
      const truncated = lines.length > 40;
      
      return {
        content: limitedContent,
        truncated: truncated,
        totalLines: lines.length
      };
    } catch (error) {
      console.error(`Error al obtener README de ${repoName}:`, error.message);
      return null;
    }
  }

  /**
   * Obtiene repositorios formateados para mostrar en el portafolio
   */
  async getPortfolioProjects() {
    const repos = await this.getRepositories();
    
    return repos
      .filter(repo => !repo.fork && !repo.archived)
      .map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || 'Sin descripción',
        url: repo.html_url,
        homepage: repo.homepage,
        language: repo.language,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        openIssues: repo.open_issues_count,
        watchers: repo.watchers_count,
        topics: repo.topics || [],
        isPrivate: repo.private,
        license: repo.license ? repo.license.spdx_id : null,
        updatedAt: repo.updated_at,
        createdAt: repo.created_at,
        defaultBranch: repo.default_branch,
        size: repo.size,
        techBadges: this.getTechBadges(repo.language, repo.topics)
      }));
  }

  /**
   * Obtiene estadísticas del perfil de GitHub
   */
  async getProfileStats() {
    try {
      const [userResponse, repos] = await Promise.all([
        axios.get(`${this.baseURL}/users/${this.username}`, { headers: this.headers }),
        this.getRepositories()
      ]);

      const user = userResponse.data;
      
      return {
        username: user.login,
        name: user.name || user.login,
        bio: user.bio,
        avatar: user.avatar_url,
        followers: user.followers,
        following: user.following,
        publicRepos: user.public_repos,
        totalRepos: repos.length,
        totalStars: repos.reduce((sum, repo) => sum + repo.stargazers_count, 0),
        topLanguages: this.getTopLanguages(repos)
      };
    } catch (error) {
      console.error('Error al obtener perfil:', error.message);
      return null;
    }
  }

  /**
   * Genera el stack tecnológico basado en TODOS los repositorios
   */
  async getDynamicTechStack() {
    const repos = await this.getRepositories();
    
    const techColors = {
      'JavaScript': '#f7df1e', 'TypeScript': '#3178c6', 'Python': '#3776ab',
      'Java': '#007396', 'Go': '#00add8', 'Rust': '#dea584', 'Ruby': '#cc342d',
      'PHP': '#777bb4', 'C++': '#00599c', 'C#': '#239120', 'Swift': '#fa7343',
      'Kotlin': '#7f52ff', 'Dart': '#0175c2', 'React': '#61dafb', 'Vue.js': '#4fc08d',
      'Angular': '#dd1b16', 'Node.js': '#339933', 'Docker': '#2496ed',
      'Kubernetes': '#326ce5', 'AWS': '#ff9900', 'Azure': '#0089d6', 'GCP': '#4285f4',
      'MongoDB': '#47a248', 'PostgreSQL': '#336791', 'MySQL': '#4479a1',
      'Redis': '#dc382d', 'GraphQL': '#e10098', 'REST API': '#009688',
      'Next.js': '#000000', 'Tailwind CSS': '#06b6d4', 'Sass': '#cc6699',
      'React Native': '#61dafb', 'Flutter': '#02569b', 'Electron': '#47848f',
      'Firebase': '#ffca28', 'TensorFlow': '#ff6f00', 'PyTorch': '#ee4c2c',
      'Linux': '#fcc624', 'Jest': '#c21325', 'Vite': '#646cff', 'Bootstrap': '#7952b3',
      'Webpack': '#8dd6f9', 'Nginx': '#009639', 'GitHub Actions': '#2088ff'
    };

    const icons = {
      'JavaScript': '📜', 'TypeScript': '🔷', 'Python': '🐍', 'Java': '☕',
      'Go': '🔵', 'Rust': '🦀', 'Ruby': '💎', 'PHP': '🐘', 'C++': '⚡',
      'C#': '🎯', 'Swift': '🍎', 'Kotlin': '🅱️', 'Dart': '🎯', 'React': '⚛️',
      'Vue.js': '💚', 'Angular': '🔴', 'Node.js': '💚', 'Docker': '🐳',
      'Kubernetes': '☸️', 'AWS': '☁️', 'Azure': '🔷', 'GCP': '🌈',
      'MongoDB': '🍃', 'PostgreSQL': '🐘', 'MySQL': '🐬', 'Redis': '🔴',
      'GraphQL': '◈', 'REST API': '🔗', 'Next.js': '▲', 'Tailwind CSS': '🌊',
      'Sass': '💅', 'React Native': '📱', 'Flutter': '💙', 'Electron': '💻',
      'Firebase': '🔥', 'TensorFlow': '🧠', 'PyTorch': '🔥', 'Linux': '🐧',
      'Jest': '🃏', 'Vite': '⚡', 'Bootstrap': '🟣', 'Webpack': '📦',
      'Nginx': '🟢', 'GitHub Actions': '🔄'
    };

    const techCount = {};
    const techStars = {};
    const techRepos = {};

    repos.forEach(repo => {
      if (repo.language) {
        techCount[repo.language] = (techCount[repo.language] || 0) + 1;
        techStars[repo.language] = (techStars[repo.language] || 0) + repo.stargazers_count;
        if (!techRepos[repo.language]) techRepos[repo.language] = [];
        techRepos[repo.language].push(repo.name);
      }

      if (repo.topics) {
        repo.topics.forEach(topic => {
          const formattedTopic = topic.charAt(0).toUpperCase() + topic.slice(1).replace(/-/g, ' ');
          if (techColors[formattedTopic] || techColors[topic]) {
            const key = techColors[formattedTopic] ? formattedTopic : topic;
            techCount[key] = (techCount[key] || 0) + 1;
            techStars[key] = (techStars[key] || 0) + repo.stargazers_count;
            if (!techRepos[key]) techRepos[key] = [];
            if (!techRepos[key].includes(repo.name)) techRepos[key].push(repo.name);
          }
        });
      }
    });

    const maxCount = Math.max(...Object.values(techCount), 1);
    const maxStars = Math.max(...Object.values(techStars), 1);

    const techStack = Object.entries(techCount)
      .map(([name, count]) => {
        const stars = techStars[name] || 0;
        const reposUsing = techRepos[name] || [];
        
        const countScore = (count / maxCount) * 40;
        const starsScore = Math.min((stars / maxStars) * 40, 40);
        const frequencyScore = Math.min((reposUsing.length / repos.length) * 20, 20);
        const level = Math.min(Math.round(countScore + starsScore + frequencyScore), 100);

        return {
          name,
          level,
          count,
          stars,
          reposCount: reposUsing.length,
          color: techColors[name] || '#6c5ce7',
          icon: icons[name] || '💻',
          repos: reposUsing.slice(0, 5)
        };
      })
      .sort((a, b) => b.level - a.level)
      .slice(0, 12);

    return techStack;
  }

  /**
   * Genera el stack tecnológico basado SOLO en los proyectos filtrados
   * (los que están visibles en el portafolio según plan y selección)
   */
  getFilteredTechStack(filteredProjects) {
    const techColors = {
      'JavaScript': '#f7df1e', 'TypeScript': '#3178c6', 'Python': '#3776ab',
      'Java': '#007396', 'Go': '#00add8', 'Rust': '#dea584', 'Ruby': '#cc342d',
      'PHP': '#777bb4', 'C++': '#00599c', 'C#': '#239120', 'Swift': '#fa7343',
      'Kotlin': '#7f52ff', 'Dart': '#0175c2', 'React': '#61dafb', 'Vue.js': '#4fc08d',
      'Angular': '#dd1b16', 'Node.js': '#339933', 'Docker': '#2496ed',
      'Kubernetes': '#326ce5', 'AWS': '#ff9900', 'Azure': '#0089d6', 'GCP': '#4285f4',
      'MongoDB': '#47a248', 'PostgreSQL': '#336791', 'MySQL': '#4479a1',
      'Redis': '#dc382d', 'GraphQL': '#e10098', 'REST API': '#009688',
      'Next.js': '#000000', 'Tailwind CSS': '#06b6d4', 'Sass': '#cc6699',
      'React Native': '#61dafb', 'Flutter': '#02569b', 'Electron': '#47848f',
      'Firebase': '#ffca28', 'TensorFlow': '#ff6f00', 'PyTorch': '#ee4c2c',
      'Linux': '#fcc624', 'Jest': '#c21325', 'Vite': '#646cff', 'Bootstrap': '#7952b3',
      'Webpack': '#8dd6f9', 'Nginx': '#009639', 'GitHub Actions': '#2088ff'
    };

    const icons = {
      'JavaScript': '📜', 'TypeScript': '🔷', 'Python': '🐍', 'Java': '☕',
      'Go': '🔵', 'Rust': '🦀', 'Ruby': '💎', 'PHP': '🐘', 'C++': '⚡',
      'C#': '🎯', 'Swift': '🍎', 'Kotlin': '🅱️', 'Dart': '🎯', 'React': '⚛️',
      'Vue.js': '💚', 'Angular': '🔴', 'Node.js': '💚', 'Docker': '🐳',
      'Kubernetes': '☸️', 'AWS': '☁️', 'Azure': '🔷', 'GCP': '🌈',
      'MongoDB': '🍃', 'PostgreSQL': '🐘', 'MySQL': '🐬', 'Redis': '🔴',
      'GraphQL': '◈', 'REST API': '🔗', 'Next.js': '▲', 'Tailwind CSS': '🌊',
      'Sass': '💅', 'React Native': '📱', 'Flutter': '💙', 'Electron': '💻',
      'Firebase': '🔥', 'TensorFlow': '🧠', 'PyTorch': '🔥', 'Linux': '🐧',
      'Jest': '🃏', 'Vite': '⚡', 'Bootstrap': '🟣', 'Webpack': '📦',
      'Nginx': '🟢', 'GitHub Actions': '🔄'
    };

    if (!filteredProjects || filteredProjects.length === 0) {
      return [];
    }

    const techCount = {};
    const techStars = {};
    const techRepos = {};

    filteredProjects.forEach(project => {
      if (project.language) {
        techCount[project.language] = (techCount[project.language] || 0) + 1;
        techStars[project.language] = (techStars[project.language] || 0) + (project.stars || 0);
        if (!techRepos[project.language]) techRepos[project.language] = [];
        techRepos[project.language].push(project.name);
      }

      if (project.techBadges && project.techBadges.length > 0) {
        project.techBadges.forEach(badge => {
          if (badge.name && badge.name !== project.language) {
            techCount[badge.name] = (techCount[badge.name] || 0) + 1;
            techStars[badge.name] = (techStars[badge.name] || 0) + (project.stars || 0);
            if (!techRepos[badge.name]) techRepos[badge.name] = [];
            if (techRepos[badge.name].indexOf(project.name) === -1) {
              techRepos[badge.name].push(project.name);
            }
          }
        });
      }
    });

    const totalProjects = filteredProjects.length;
    
    const techStack = Object.entries(techCount)
      .map(([name, count]) => {
        const stars = techStars[name] || 0;
        const reposUsing = techRepos[name] || [];
        
        const frequencyScore = Math.min((count / totalProjects) * 50, 50);
        const starsScore = Math.min((stars / Math.max(...Object.values(techStars), 1)) * 30, 30);
        const reposScore = Math.min((reposUsing.length / totalProjects) * 20, 20);
        const level = Math.min(Math.round(frequencyScore + starsScore + reposScore), 100);

        return {
          name,
          level: Math.max(level, 10),
          count,
          stars,
          reposCount: reposUsing.length,
          color: techColors[name] || '#6c5ce7',
          icon: icons[name] || '💻',
          repos: reposUsing.slice(0, 5),
          percentage: Math.round((count / totalProjects) * 100)
        };
      })
      .sort((a, b) => b.level - a.level)
      .slice(0, 12);

    return techStack;
  }

  /**
   * Extrae los lenguajes más usados
   */
  getTopLanguages(repos) {
    const langCount = {};
    repos.forEach(repo => {
      if (repo.language) {
        langCount[repo.language] = (langCount[repo.language] || 0) + 1;
      }
    });
    
    return Object.entries(langCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([lang, count]) => ({ name: lang, count }));
  }

  /**
   * Genera badges de tecnologías basados en el lenguaje y topics
   */
  getTechBadges(language, topics) {
    const badges = [];
    
    const techColors = {
      'JavaScript': '#f7df1e',
      'TypeScript': '#3178c6',
      'Python': '#3776ab',
      'Java': '#007396',
      'Go': '#00add8',
      'Rust': '#dea584',
      'Ruby': '#cc342d',
      'PHP': '#777bb4',
      'C++': '#00599c',
      'C#': '#239120',
      'Swift': '#fa7343',
      'Kotlin': '#7f52ff',
      'Dart': '#0175c2',
      'React': '#61dafb',
      'Vue': '#4fc08d',
      'Angular': '#dd1b16',
      'Node.js': '#339933',
      'Docker': '#2496ed',
      'Kubernetes': '#326ce5',
      'AWS': '#ff9900',
      'MongoDB': '#47a248',
      'PostgreSQL': '#336791',
      'Redis': '#dc382d',
      'GraphQL': '#e10098'
    };

    if (language) {
      badges.push({
        name: language,
        color: techColors[language] || '#6c5ce7'
      });
    }

    if (topics) {
      topics.forEach(topic => {
        if (techColors[topic]) {
          badges.push({
            name: topic,
            color: techColors[topic]
          });
        }
      });
    }

    return badges;
  }
}

module.exports = GitHubService;