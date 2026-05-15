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
    let techStack = [];

    if (githubService) {
      try {
        [profile, projects, techStack] = await Promise.all([
          githubService.getProfileStats(),
          githubService.getPortfolioProjects(),
          githubService.getDynamicTechStack()
        ]);
        console.log(`✅ GitHub: ${projects.length} proyectos, ${techStack.length} tecnologías`);
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
        { id: 1, name: 'ecommerce-api', fullName: 'devcraft/ecommerce-api', description: 'API RESTful para e-commerce con Node.js y MongoDB', url: 'https://github.com', language: 'JavaScript', stars: 24, forks: 8, openIssues: 2, isPrivate: false, license: 'MIT', defaultBranch: 'main', techBadges: [{ name: 'Node.js', color: '#339933' }, { name: 'MongoDB', color: '#47a248' }] },
        { id: 2, name: 'react-dashboard', fullName: 'devcraft/react-dashboard', description: 'Dashboard con React, TypeScript y gráficos en tiempo real', url: 'https://github.com', language: 'TypeScript', stars: 18, forks: 5, openIssues: 1, isPrivate: false, license: 'MIT', defaultBranch: 'main', techBadges: [{ name: 'React', color: '#61dafb' }, { name: 'TypeScript', color: '#3178c6' }] },
        { id: 3, name: 'ai-chatbot', fullName: 'devcraft/ai-chatbot', description: 'Chatbot con NLP y machine learning en Python', url: 'https://github.com', language: 'Python', stars: 32, forks: 12, openIssues: 3, isPrivate: true, license: 'GPL-3.0', defaultBranch: 'main', techBadges: [{ name: 'Python', color: '#3776ab' }, { name: 'AWS', color: '#ff9900' }] },
        { id: 4, name: 'mobile-app', fullName: 'devcraft/mobile-app', description: 'App móvil con React Native y Firebase', url: 'https://github.com', language: 'JavaScript', stars: 15, forks: 4, openIssues: 0, isPrivate: false, license: 'MIT', defaultBranch: 'main', techBadges: [{ name: 'React Native', color: '#61dafb' }, { name: 'Firebase', color: '#ffca28' }] },
        { id: 5, name: 'devops-tools', fullName: 'devcraft/devops-tools', description: 'Herramientas DevOps con Docker y Kubernetes', url: 'https://github.com', language: 'Go', stars: 28, forks: 10, openIssues: 2, isPrivate: false, license: 'Apache-2.0', defaultBranch: 'main', techBadges: [{ name: 'Docker', color: '#2496ed' }, { name: 'Kubernetes', color: '#326ce5' }] },
        { id: 6, name: 'landing-builder', fullName: 'devcraft/landing-builder', description: 'Constructor de landing pages con Next.js', url: 'https://github.com', language: 'TypeScript', stars: 22, forks: 7, openIssues: 1, isPrivate: true, license: 'MIT', defaultBranch: 'main', techBadges: [{ name: 'Next.js', color: '#000000' }, { name: 'Tailwind', color: '#06b6d4' }] }
      ];
    }

    if (techStack.length === 0) {
      techStack = [
        { name: 'JavaScript', level: 95, color: '#f7df1e', icon: '📜', count: 15, stars: 120 },
        { name: 'TypeScript', level: 88, color: '#3178c6', icon: '🔷', count: 10, stars: 85 },
        { name: 'React', level: 90, color: '#61dafb', icon: '⚛️', count: 8, stars: 95 },
        { name: 'Node.js', level: 85, color: '#339933', icon: '💚', count: 12, stars: 70 },
        { name: 'Python', level: 82, color: '#3776ab', icon: '🐍', count: 6, stars: 55 },
        { name: 'Docker', level: 78, color: '#2496ed', icon: '🐳', count: 9, stars: 40 }
      ];
    }

    // 🆕 Filtrar proyectos según el plan
    const filteredProjects = planService.filterProjectsByPlan(
      projects,
      req.userPlan.id,
      req.selectedProjects
    );

    const data = {
      title: 'DevCraft Studio | Desarrollo de Software Profesional',
      theme: req.theme,
      currentYear: new Date().getFullYear(),
      profile,
      projects: filteredProjects,
      allProjects: projects, // Todos los proyectos para el selector
      techStack,
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