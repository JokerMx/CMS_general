require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const TemplateEngine = require('./templateEngine');
const { resolveTemplateContext } = require('./contextResolver');
const GitHubService = require('./githubService');
const { PlanService } = require('./planService');

const app = express();
const engine = new TemplateEngine();
const planService = new PlanService();

// Inicializar servicio de GitHub
let githubService = null;
if (process.env.GITHUB_TOKEN && process.env.GITHUB_USERNAME) {
  githubService = new GitHubService(
    process.env.GITHUB_TOKEN,
    process.env.GITHUB_USERNAME
  );
  console.log('✅ GitHub Service inicializado para:', process.env.GITHUB_USERNAME);
} else {
  console.warn('⚠️  GITHUB_TOKEN o GITHUB_USERNAME no configurados en .env');
}

// ==========================================
// MIDDLEWARES
// ==========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/static', express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  const { sets, theme } = resolveTemplateContext(req);
  req.templateSets = sets;
  req.theme = theme;
  req.userPlan = planService.getUserPlan(req);
  req.selectedProjects = planService.getSelectedProjects(req);
  next();
});

// ==========================================
// RUTAS
// ==========================================

app.get('/', async (req, res) => {
  try {
    let profile = null;
    let projects = [];
    let allTechStack = [];

    if (githubService) {
      try {
        [profile, projects, allTechStack] = await Promise.all([
          githubService.getProfileStats(),
          githubService.getPortfolioProjects(),
          githubService.getDynamicTechStack()
        ]);
        console.log(`✅ GitHub: ${projects.length} proyectos, ${allTechStack.length} tecnologías totales`);
      } catch (githubError) {
        console.error('⚠️  Error GitHub:', githubError.message);
      }
    }

    // Datos de ejemplo si no hay GitHub
    if (!profile) {
      profile = {
        username: process.env.GITHUB_USERNAME || 'devcraft',
        name: 'DevCraft Studio',
        bio: 'Desarrollo de Software Profesional',
        avatar: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
        followers: 0, following: 0, totalRepos: 0, totalStars: 0, topLanguages: []
      };
    }

    if (projects.length === 0) {
      projects = [
        { id: 1, name: 'ecommerce-api', fullName: 'devcraft/ecommerce-api', description: 'API RESTful para e-commerce con Node.js y MongoDB', url: 'https://github.com', language: 'JavaScript', stars: 24, forks: 8, openIssues: 2, isPrivate: false, license: 'MIT', defaultBranch: 'main', techBadges: [{ name: 'Node.js', color: '#339933' }, { name: 'MongoDB', color: '#47a248' }, { name: 'Docker', color: '#2496ed' }] },
        { id: 2, name: 'react-dashboard', fullName: 'devcraft/react-dashboard', description: 'Dashboard con React, TypeScript y gráficos', url: 'https://github.com', language: 'TypeScript', stars: 18, forks: 5, openIssues: 1, isPrivate: false, license: 'MIT', defaultBranch: 'main', techBadges: [{ name: 'React', color: '#61dafb' }, { name: 'TypeScript', color: '#3178c6' }, { name: 'GraphQL', color: '#e10098' }] },
        { id: 3, name: 'ai-chatbot', fullName: 'devcraft/ai-chatbot', description: 'Chatbot con NLP y machine learning', url: 'https://github.com', language: 'Python', stars: 32, forks: 12, openIssues: 3, isPrivate: true, license: 'GPL-3.0', defaultBranch: 'main', techBadges: [{ name: 'Python', color: '#3776ab' }, { name: 'AWS', color: '#ff9900' }, { name: 'Docker', color: '#2496ed' }] },
        { id: 4, name: 'mobile-app', fullName: 'devcraft/mobile-app', description: 'App móvil con React Native', url: 'https://github.com', language: 'JavaScript', stars: 15, forks: 4, openIssues: 0, isPrivate: false, license: 'MIT', defaultBranch: 'main', techBadges: [{ name: 'React Native', color: '#61dafb' }, { name: 'Firebase', color: '#ffca28' }] },
        { id: 5, name: 'devops-tools', fullName: 'devcraft/devops-tools', description: 'Herramientas DevOps con Docker y K8s', url: 'https://github.com', language: 'Go', stars: 28, forks: 10, openIssues: 2, isPrivate: false, license: 'Apache-2.0', defaultBranch: 'main', techBadges: [{ name: 'Docker', color: '#2496ed' }, { name: 'Kubernetes', color: '#326ce5' }] },
        { id: 6, name: 'landing-builder', fullName: 'devcraft/landing-builder', description: 'Constructor de landing pages', url: 'https://github.com', language: 'TypeScript', stars: 22, forks: 7, openIssues: 1, isPrivate: true, license: 'MIT', defaultBranch: 'main', techBadges: [{ name: 'Next.js', color: '#000000' }, { name: 'Tailwind CSS', color: '#06b6d4' }] }
      ];
    }

    // 🆕 Filtrar proyectos según el plan y selección
    const filteredProjects = planService.filterProjectsByPlan(
      projects,
      req.userPlan.id,
      req.selectedProjects
    );

    console.log(`📦 Mostrando ${filteredProjects.length} proyectos (Plan: ${req.userPlan.name})`);

    // 🆕 Generar stack tecnológico basado SOLO en los proyectos visibles
    let filteredTechStack = [];
    if (filteredProjects.length > 0) {
      if (githubService) {
        filteredTechStack = githubService.getFilteredTechStack(filteredProjects);
      } else {
        // Stack de ejemplo basado en proyectos visibles
        filteredTechStack = githubService ? githubService.getFilteredTechStack(filteredProjects) : getExampleTechStack(filteredProjects);
      }
    }

    console.log(`📊 Stack tecnológico: ${filteredTechStack.length} tecnologías detectadas`);

    const data = {
      title: 'DevCraft Studio | Desarrollo de Software Profesional',
      theme: req.theme,
      currentYear: new Date().getFullYear(),
      profile,
      projects: filteredProjects,
      allProjects: projects,
      techStack: filteredTechStack,
      userPlan: req.userPlan,
      selectedProjects: req.selectedProjects,
      plans: planService.getAllPlans(),
      services: [
        { icon: '🖥️', title: 'Desarrollo Web', description: 'Aplicaciones web modernas con React, Vue, Angular y Node.js.', features: ['SPA/PWA', 'E-commerce', 'Dashboards'] },
        { icon: '📱', title: 'Apps Móviles', description: 'Aplicaciones nativas e híbridas para iOS y Android.', features: ['iOS & Android', 'UI/UX nativo', 'Offline-first'] },
        { icon: '☁️', title: 'Cloud & DevOps', description: 'Arquitecturas en AWS, Azure y GCP con CI/CD.', features: ['Docker/K8s', 'Serverless', 'Monitoreo'] },
        { icon: '🤖', title: 'IA & Automatización', description: 'Integración de modelos de IA y automatización de procesos.', features: ['ML/DL', 'NLP', 'RPA'] },
        { icon: '🔒', title: 'Ciberseguridad', description: 'Auditorías de seguridad y hardening de aplicaciones.', features: ['Pentesting', 'OAuth/JWT', 'GDPR'] },
        { icon: '🎯', title: 'Consultoría Tech', description: 'Asesoría en arquitectura de software y migraciones.', features: ['Auditorías', 'Roadmaps', 'MVP'] }
      ]
    };

    const bodyHtml = await engine.render('home.ejs', data, req.templateSets);
    const fullHtml = await engine.render('layout.ejs', { ...data, body: bodyHtml }, req.templateSets);
    res.send(fullHtml);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p><a href="/">Volver</a>`);
  }
});

// 🆕 Función auxiliar para stack de ejemplo basado en proyectos visibles
function getExampleTechStack(filteredProjects) {
  const techColors = {
    'JavaScript': '#f7df1e', 'TypeScript': '#3178c6', 'Python': '#3776ab',
    'React': '#61dafb', 'Node.js': '#339933', 'Docker': '#2496ed',
    'MongoDB': '#47a248', 'GraphQL': '#e10098', 'AWS': '#ff9900',
    'Kubernetes': '#326ce5', 'Next.js': '#000000', 'Tailwind CSS': '#06b6d4',
    'React Native': '#61dafb'
  };
  const icons = {
    'JavaScript': '📜', 'TypeScript': '🔷', 'Python': '🐍',
    'React': '⚛️', 'Node.js': '💚', 'Docker': '🐳',
    'MongoDB': '🍃', 'GraphQL': '◈', 'AWS': '☁️',
    'Kubernetes': '☸️', 'Next.js': '▲', 'Tailwind CSS': '🌊',
    'React Native': '📱'
  };

  const techCount = {};
  filteredProjects.forEach(project => {
    if (project.language) {
      techCount[project.language] = (techCount[project.language] || 0) + 1;
    }
    if (project.techBadges) {
      project.techBadges.forEach(badge => {
        if (badge.name) {
          techCount[badge.name] = (techCount[badge.name] || 0) + 1;
        }
      });
    }
  });

  const total = filteredProjects.length;
  return Object.entries(techCount)
    .map(([name, count]) => ({
      name,
      level: Math.min(Math.round((count / total) * 100), 100),
      count,
      stars: 0,
      reposCount: count,
      color: techColors[name] || '#6c5ce7',
      icon: icons[name] || '💻',
      repos: [],
      percentage: Math.round((count / total) * 100)
    }))
    .sort((a, b) => b.level - a.level)
    .slice(0, 12);
};

// 🆕 Página de planes
app.get('/plans', async (req, res) => {
  try {
    const data = {
      title: 'Planes | DevCraft Studio',
      theme: req.theme,
      currentYear: new Date().getFullYear(),
      plans: planService.getAllPlans(),
      userPlan: req.userPlan
    };

    const bodyHtml = await engine.render('plans.ejs', data, req.templateSets);
    const fullHtml = await engine.render('layout.ejs', { ...data, body: bodyHtml }, req.templateSets);
    res.send(fullHtml);
  } catch (error) {
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

// 🆕 Cambiar plan
app.get('/set-plan/:planId', (req, res) => {
  const { planId } = req.params;
  const plan = planService.getPlan(planId);
  
  res.cookie('userPlan', planId, {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true
  });
  
  // Limpiar proyectos seleccionados al cambiar de plan
  res.clearCookie('selectedProjects');
  
  console.log(`📊 Plan cambiado a: ${plan.name}`);
  
  const backUrl = req.get('referer') || '/';
  res.redirect(backUrl);
});

// 🆕 Guardar selección de proyectos
app.post('/api/save-project-selection', (req, res) => {
  const { projects } = req.body;
  
  if (!Array.isArray(projects)) {
    return res.status(400).json({ success: false, error: 'Formato inválido' });
  }
  
  planService.setSelectedProjectsCookie(res, projects);
  
  res.json({ success: true, message: 'Proyectos guardados', selected: projects });
});

// 🆕 API para obtener README
app.get('/api/readme/:repoName', async (req, res) => {
  try {
    if (!githubService) return res.json({ success: false, error: 'GitHub no configurado' });
    
    const readmeData = await githubService.getReadme(req.params.repoName);
    
    if (readmeData) {
      res.json({ success: true, readme: readmeData.content, truncated: readmeData.truncated, totalLines: readmeData.totalLines });
    } else {
      res.json({ success: false, readme: null });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/projects', async (req, res) => {
  try {
    if (!githubService) return res.json({ projects: [] });
    res.json({ success: true, projects: await githubService.getPortfolioProjects() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/profile', async (req, res) => {
  try {
    if (!githubService) return res.json({ profile: null });
    res.json({ success: true, profile: await githubService.getProfileStats() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tech-stack', async (req, res) => {
  try {
    if (!githubService) return res.json({ techStack: [] });
    res.json({ success: true, techStack: await githubService.getDynamicTechStack() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', github: githubService ? 'connected' : 'not configured', theme: req.theme, plan: req.userPlan });
});

app.get('/toggle-theme', (req, res) => {
  const currentTheme = req.query.current || req.cookies?.theme || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  res.cookie('theme', newTheme, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
  const referer = req.get('referer') || '/';
  try {
    const url = new URL(referer, `http://${req.get('host')}`);
    url.searchParams.set('theme', newTheme);
    res.redirect(url.pathname + url.search);
  } catch (e) {
    res.redirect(`/?theme=${newTheme}`);
  }
});

app.post('/contact', (req, res) => {
  console.log('📩 Contacto:', req.body);
  res.json({ success: true, message: '¡Mensaje recibido!' });
});

// ==========================================
// 🆕 PANEL DE ADMINISTRACIÓN DE PROYECTOS
// ==========================================

// Página del panel de administración
app.get('/admin', async (req, res) => {
  try {
    let allProjects = [];

    if (githubService) {
      try {
        allProjects = await githubService.getPortfolioProjects();
      } catch (error) {
        console.error('Error al obtener proyectos:', error.message);
      }
    }

    // Datos de ejemplo si no hay GitHub
    if (allProjects.length === 0) {
      allProjects = [
        { id: 1, name: 'ecommerce-api', fullName: 'devcraft/ecommerce-api', description: 'API RESTful para e-commerce con Node.js y MongoDB', url: 'https://github.com', language: 'JavaScript', stars: 24, forks: 8, isPrivate: false, topics: ['nodejs', 'mongodb', 'api'], techBadges: [{ name: 'Node.js', color: '#339933' }, { name: 'MongoDB', color: '#47a248' }] },
        { id: 2, name: 'react-dashboard', fullName: 'devcraft/react-dashboard', description: 'Dashboard con React, TypeScript y gráficos', url: 'https://github.com', language: 'TypeScript', stars: 18, forks: 5, isPrivate: false, topics: ['react', 'typescript'], techBadges: [{ name: 'React', color: '#61dafb' }, { name: 'TypeScript', color: '#3178c6' }] },
        { id: 3, name: 'ai-chatbot', fullName: 'devcraft/ai-chatbot', description: 'Chatbot con NLP y machine learning', url: 'https://github.com', language: 'Python', stars: 32, forks: 12, isPrivate: true, topics: ['python', 'ai'], techBadges: [{ name: 'Python', color: '#3776ab' }, { name: 'AWS', color: '#ff9900' }] },
        { id: 4, name: 'mobile-app', fullName: 'devcraft/mobile-app', description: 'App móvil con React Native', url: 'https://github.com', language: 'JavaScript', stars: 15, forks: 4, isPrivate: false, topics: ['react-native'], techBadges: [{ name: 'React Native', color: '#61dafb' }] },
        { id: 5, name: 'devops-tools', fullName: 'devcraft/devops-tools', description: 'Herramientas DevOps', url: 'https://github.com', language: 'Go', stars: 28, forks: 10, isPrivate: false, topics: ['docker', 'kubernetes'], techBadges: [{ name: 'Docker', color: '#2496ed' }, { name: 'Kubernetes', color: '#326ce5' }] },
        { id: 6, name: 'landing-builder', fullName: 'devcraft/landing-builder', description: 'Constructor de landing pages', url: 'https://github.com', language: 'TypeScript', stars: 22, forks: 7, isPrivate: true, topics: ['nextjs', 'tailwind'], techBadges: [{ name: 'Next.js', color: '#000000' }] },
        { id: 7, name: 'api-gateway', fullName: 'devcraft/api-gateway', description: 'API Gateway con GraphQL', url: 'https://github.com', language: 'TypeScript', stars: 12, forks: 3, isPrivate: false, topics: ['graphql', 'apollo'], techBadges: [{ name: 'GraphQL', color: '#e10098' }] },
        { id: 8, name: 'cli-tool', fullName: 'devcraft/cli-tool', description: 'Herramienta CLI en Rust', url: 'https://github.com', language: 'Rust', stars: 20, forks: 6, isPrivate: false, topics: ['rust', 'cli'], techBadges: [{ name: 'Rust', color: '#dea584' }] }
      ];
    }

    const data = {
      title: 'Panel de Administración | DevCraft Studio',
      theme: req.theme,
      currentYear: new Date().getFullYear(),
      allProjects,
      userPlan: req.userPlan,
      selectedProjects: req.selectedProjects,
      maxProjects: req.userPlan.maxProjects === Infinity ? 999 : req.userPlan.maxProjects
    };

    const bodyHtml = await engine.render('admin.ejs', data, req.templateSets);
    const fullHtml = await engine.render('layout.ejs', { ...data, body: bodyHtml }, req.templateSets);
    res.send(fullHtml);
  } catch (error) {
    console.error('❌ Error en panel admin:', error.message);
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p><a href="/admin">Reintentar</a>`);
  }
});

// 🆕 API para guardar/obtener selección de proyectos
app.post('/api/projects/selection', (req, res) => {
  const { projects } = req.body;
  
  if (!Array.isArray(projects)) {
    return res.status(400).json({ success: false, error: 'Formato inválido. Se esperaba un array de nombres de proyectos.' });
  }

  // Validar contra el plan del usuario
  const userPlan = planService.getUserPlan(req);
  if (projects.length > userPlan.maxProjects && userPlan.maxProjects !== Infinity) {
    return res.status(400).json({ 
      success: false, 
      error: `Tu plan ${userPlan.name} solo permite ${userPlan.maxProjects} proyectos. Seleccionaste ${projects.length}.` 
    });
  }

  planService.setSelectedProjectsCookie(res, projects);
  
  console.log(`📦 Proyectos seleccionados (${projects.length}):`, projects);
  
  res.json({ 
    success: true, 
    message: `${projects.length} proyectos guardados correctamente.`,
    selected: projects 
  });
});

// 🆕 API para obtener la selección actual
app.get('/api/projects/selection', (req, res) => {
  const selected = planService.getSelectedProjects(req);
  res.json({ success: true, selected });
});

app.use(async (req, res) => {
  try {
    const html = await engine.render('404.ejs', { theme: req.theme }, req.templateSets);
    res.status(404).send(html);
  } catch (error) {
    res.status(404).send(`<h1>404</h1><a href="/">Volver</a>`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 DevCraft Studio en http://localhost:${PORT}`);
  console.log(`📊 Planes: http://localhost:${PORT}/plans\n`);
});