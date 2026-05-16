require('dotenv').config();
const Config = require('./models/Config');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const TemplateEngine = require('./templateEngine');
const { resolveTemplateContext } = require('./contextResolver');
const GitHubService = require('./githubService');
const { PlanService } = require('./planService');
const { initDatabase } = require('./database');
const { loadUser, isAuthenticated, isNotAuthenticated } = require('./middleware/auth');
const User = require('./models/User');

const app = express();
const engine = new TemplateEngine();
const planService = new PlanService();

// ==========================================
// MIDDLEWARES
// ==========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'devcraft_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true
  }
}));
app.use('/static', express.static(path.join(__dirname, 'public')));

// Middleware de usuario (carga datos del usuario autenticado)
app.use(loadUser);

// Middleware de contexto de plagetFilteredTechStackntillas
app.use((req, res, next) => {
  const { sets, theme } = resolveTemplateContext(req);
  req.templateSets = sets;
  req.theme = theme;
  next();
});

// ==========================================
// FUNCIÓN AUXILIAR: GitHub Service
// ==========================================
async function getGitHubService(req) {
  let token = process.env.GITHUB_TOKEN;
  let username = process.env.GITHUB_USERNAME;

  // Si el usuario está autenticado, buscar sus credenciales en la BD
  if (req.session && req.session.userId) {
    try {
      const credentials = await Config.getGitHubCredentials(req.session.userId);
      if (credentials.token && credentials.username) {
        token = credentials.token;
        username = credentials.username;
        console.log(`🔑 Usando credenciales de GitHub del usuario (BD)`);
      } else {
        console.log(`🔑 Usando credenciales de GitHub del .env`);
      }
    } catch (error) {
      console.error('Error al obtener credenciales de BD:', error.message);
    }
  }

  if (token && username) {
    return new GitHubService(token, username);
  }
  return null;
}

// ==========================================
// RUTAS DE AUTENTICACIÓN
// ==========================================

// Página de login
app.get('/login', isNotAuthenticated, async (req, res) => {
  try {
    const bodyHtml = await engine.render('login.ejs', {
      error: req.query.error,
      success: req.query.success
    }, req.templateSets);

    const fullHtml = await engine.render('layout.ejs', {
      title: 'Iniciar Sesión | DevCraft Studio',
      theme: req.theme,
      currentYear: new Date().getFullYear(),
      user: null,
      userPlan: null,
      body: bodyHtml
    }, req.templateSets);

    res.send(fullHtml);
  } catch (error) {
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p><a href="/">Volver</a>`);
  }
});

// Procesar login
app.post('/login', isNotAuthenticated, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.redirect('/login?error=Todos los campos son obligatorios');
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.redirect('/login?error=Email o contraseña incorrectos');
    }

    const isValid = await User.verifyPassword(password, user.password);
    if (!isValid) {
      return res.redirect('/login?error=Email o contraseña incorrectos');
    }

    // Crear sesión
    req.session.userId = user.id;
    req.session.userPlan = user.plan;
    req.session.justLoggedIn = true; // 🆕 Flag para mostrar modal

    await User.updateLastLogin(user.id);

    console.log(`✅ Login exitoso: ${user.username} (${user.email})`);

    // Redirigir a la página de bienvenida
    res.redirect('/welcome');
  } catch (error) {
    console.error('Error en login:', error);
    res.redirect('/login?error=Error al iniciar sesión');
  }
});
// Página de bienvenida después del login (muestra modal)
app.get('/welcome', isAuthenticated, async (req, res) => {
  try {
    const showModal = req.session.justLoggedIn || false;
    req.session.justLoggedIn = false; // Limpiar flag

    const user = await User.findById(req.session.userId);
    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;

    const bodyHtml = await engine.render('welcome.ejs', {
      user,
      showModal,
      returnTo
    }, req.templateSets);

    const fullHtml = await engine.render('layout.ejs', {
      title: 'Bienvenido | DevCraft Studio',
      theme: req.theme,
      currentYear: new Date().getFullYear(),
      user: user,
      userPlan: res.locals.userPlan || null,
      body: bodyHtml
    }, req.templateSets);

    res.send(fullHtml);
  } catch (error) {
    res.redirect('/');
  }
});

// Página de registro
app.get('/register', isNotAuthenticated, async (req, res) => {
  try {
    const bodyHtml = await engine.render('register.ejs', {
      error: req.query.error
    }, req.templateSets);

    const fullHtml = await engine.render('layout.ejs', {
      title: 'Registro | DevCraft Studio',
      theme: req.theme,
      currentYear: new Date().getFullYear(),
      user: null,
      userPlan: null,
      body: bodyHtml
    }, req.templateSets);

    res.send(fullHtml);
  } catch (error) {
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p><a href="/">Volver</a>`);
  }
});

// Procesar registro
app.post('/register', isNotAuthenticated, async (req, res) => {
  try {
    const { username, email, password, confirmPassword, fullName } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.redirect('/register?error=Todos los campos son obligatorios');
    }

    if (password !== confirmPassword) {
      return res.redirect('/register?error=Las contraseñas no coinciden');
    }

    if (password.length < 6) {
      return res.redirect('/register?error=La contraseña debe tener al menos 6 caracteres');
    }

    if (username.length < 3) {
      return res.redirect('/register?error=El nombre de usuario debe tener al menos 3 caracteres');
    }

    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      return res.redirect('/register?error=El email ya está registrado');
    }

    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res.redirect('/register?error=El nombre de usuario ya está en uso');
    }

    await User.create({ username, email, password, fullName });

    console.log(`✅ Registro: ${username} (${email})`);
    res.redirect('/login?success=Cuenta creada exitosamente. Inicia sesión.');
  } catch (error) {
    console.error('Error en registro:', error);
    res.redirect('/register?error=Error al crear la cuenta');
  }
});

// Cerrar sesión
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Error al cerrar sesión:', err);
    res.redirect('/login?success=Sesión cerrada correctamente');
  });
});

// Perfil del usuario
app.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    const bodyHtml = await engine.render('profile.ejs', {
      user
    }, req.templateSets);

    const fullHtml = await engine.render('layout.ejs', {
      title: 'Mi Perfil | DevCraft Studio',
      theme: req.theme,
      currentYear: new Date().getFullYear(),
      user: user,
      userPlan: res.locals.userPlan || null,
      body: bodyHtml
    }, req.templateSets);

    res.send(fullHtml);
  } catch (error) {
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p><a href="/">Volver</a>`);
  }
});

// Actualizar perfil
app.post('/profile', isAuthenticated, async (req, res) => {
  try {
    const { githubUsername, githubToken } = req.body;

    if (githubUsername || githubToken) {
      // Guardar en la tabla config
      await Config.setGitHubCredentials(
        req.session.userId,
        githubUsername || null,
        githubToken || null
      );
      console.log(`🔑 Credenciales de GitHub actualizadas para usuario ID: ${req.session.userId}`);
    }

    res.redirect('/profile?success=Perfil y credenciales actualizados');
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.redirect('/profile?error=Error al actualizar');
  }
});

// ==========================================
// RUTAS PRINCIPALES
// ==========================================

// Página principal - Landing
app.get('/', async (req, res) => {
  try {
    const githubService = await getGitHubService(req);
    let profile = null;
    let projects = [];

    if (githubService) {
      try {
        [profile, projects] = await Promise.all([
          githubService.getProfileStats(),
          githubService.getPortfolioProjects()
        ]);
        console.log(`✅ GitHub: ${projects.length} proyectos`);
      } catch (error) {
        console.error('⚠️ Error GitHub:', error.message);
      }
    }

    // Datos de ejemplo si no hay GitHub
    if (!profile) {
      profile = {
        username: process.env.GITHUB_USERNAME || 'devcraft',
        name: res.locals.user?.full_name || 'DevCraft Studio',
        bio: 'Desarrollo de Software Profesional',
        avatar: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
        followers: 0, following: 0, totalRepos: 0, totalStars: 0, topLanguages: []
      };
    }

    if (projects.length === 0) {
      projects = [
        { id: 1, name: 'ecommerce-api', fullName: 'devcraft/ecommerce-api', description: 'API RESTful para e-commerce con Node.js y MongoDB', url: 'https://github.com', language: 'JavaScript', stars: 24, forks: 8, openIssues: 2, isPrivate: false, license: 'MIT', defaultBranch: 'main', techBadges: [{ name: 'Node.js', color: '#339933' }, { name: 'MongoDB', color: '#47a248' }, { name: 'Docker', color: '#2496ed' }] },
        { id: 2, name: 'react-dashboard', fullName: 'devcraft/react-dashboard', description: 'Dashboard con React, TypeScript y gráficos en tiempo real', url: 'https://github.com', language: 'TypeScript', stars: 18, forks: 5, openIssues: 1, isPrivate: false, license: 'MIT', defaultBranch: 'main', techBadges: [{ name: 'React', color: '#61dafb' }, { name: 'TypeScript', color: '#3178c6' }, { name: 'GraphQL', color: '#e10098' }] },
        { id: 3, name: 'ai-chatbot', fullName: 'devcraft/ai-chatbot', description: 'Chatbot con NLP y machine learning en Python', url: 'https://github.com', language: 'Python', stars: 32, forks: 12, openIssues: 3, isPrivate: true, license: 'GPL-3.0', defaultBranch: 'main', techBadges: [{ name: 'Python', color: '#3776ab' }, { name: 'AWS', color: '#ff9900' }, { name: 'Docker', color: '#2496ed' }] },
        { id: 4, name: 'mobile-app', fullName: 'devcraft/mobile-app', description: 'App móvil con React Native y Firebase', url: 'https://github.com', language: 'JavaScript', stars: 15, forks: 4, openIssues: 0, isPrivate: false, license: 'MIT', defaultBranch: 'main', techBadges: [{ name: 'React Native', color: '#61dafb' }, { name: 'Firebase', color: '#ffca28' }] },
        { id: 5, name: 'devops-tools', fullName: 'devcraft/devops-tools', description: 'Herramientas DevOps con Docker y Kubernetes', url: 'https://github.com', language: 'Go', stars: 28, forks: 10, openIssues: 2, isPrivate: false, license: 'Apache-2.0', defaultBranch: 'main', techBadges: [{ name: 'Docker', color: '#2496ed' }, { name: 'Kubernetes', color: '#326ce5' }] },
        { id: 6, name: 'landing-builder', fullName: 'devcraft/landing-builder', description: 'Constructor de landing pages con Next.js', url: 'https://github.com', language: 'TypeScript', stars: 22, forks: 7, openIssues: 1, isPrivate: true, license: 'MIT', defaultBranch: 'main', techBadges: [{ name: 'Next.js', color: '#000000' }, { name: 'Tailwind CSS', color: '#06b6d4' }] }
      ];
    }

    // Datos del usuario para el header
    const userPlan = res.locals.userPlan || { id: 'free', name: 'Gratis', icon: '🆓', maxProjects: 2, color: '#6c757d', gradient: 'linear-gradient(135deg, #6c757d, #adb5bd)' };
    const selectedProjects = res.locals.selectedProjects || [];

    // Filtrar proyectos según plan
    const filteredProjects = planService.filterProjectsByPlan(projects, userPlan.id, selectedProjects);
    console.log(`📦 Mostrando ${filteredProjects.length} proyectos (Plan: ${userPlan.name})`);

    // Stack tecnológico
    let techStack = [];
    if (githubService && filteredProjects.length > 0) {
      techStack = githubService.getFilteredTechStack(filteredProjects);
    } else if (filteredProjects.length > 0) {
      techStack = getExampleTechStack(filteredProjects);
    }
    console.log(`📊 Stack: ${techStack.length} tecnologías`);

    const data = {
      title: 'DevCraft Studio | Desarrollo de Software Profesional',
      theme: req.theme,
      currentYear: new Date().getFullYear(),
      user: res.locals.user || null,
      userPlan: userPlan,
      profile,
      projects: filteredProjects,
      allProjects: projects,
      techStack,
      selectedProjects,
      plans: planService.getAllPlans(),
      services: [
        { icon: '🖥️', title: 'Desarrollo Web', description: 'Aplicaciones web modernas con React, Vue, Angular y Node.js.', features: ['SPA/PWA', 'E-commerce', 'Dashboards'] },
        { icon: '📱', title: 'Apps Móviles', description: 'Aplicaciones nativas e híbridas para iOS y Android.', features: ['iOS & Android', 'UI/UX nativo', 'Offline-first'] },
        { icon: '☁️', title: 'Cloud & DevOps', description: 'Arquitecturas en AWS, Azure y GCP con CI/CD.', features: ['Docker/K8s', 'Serverless', 'Monitoreo'] },
        { icon: '🤖', title: 'IA & Automatización', description: 'Integración de modelos de IA y automatización.', features: ['ML/DL', 'NLP', 'RPA'] },
        { icon: '🔒', title: 'Ciberseguridad', description: 'Auditorías de seguridad y hardening.', features: ['Pentesting', 'OAuth/JWT', 'GDPR'] },
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

// Página de planes
app.get('/plans', async (req, res) => {
  try {
    const userPlan = res.locals.userPlan || { id: 'free', name: 'Gratis', icon: '🆓', maxProjects: 2, color: '#6c757d' };

    const bodyHtml = await engine.render('plans.ejs', {
      plans: planService.getAllPlans(),
      userPlan: userPlan
    }, req.templateSets);

    const fullHtml = await engine.render('layout.ejs', {
      title: 'Planes | DevCraft Studio',
      theme: req.theme,
      currentYear: new Date().getFullYear(),
      user: res.locals.user || null,
      userPlan: userPlan,
      body: bodyHtml
    }, req.templateSets);

    res.send(fullHtml);
  } catch (error) {
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

// Cambiar plan
app.get('/set-plan/:planId', isAuthenticated, async (req, res) => {
  const validPlans = ['free', 'medium', 'premium', 'platinum'];
  const { planId } = req.params;

  if (!validPlans.includes(planId)) {
    return res.redirect('/plans');
  }

  await User.updatePlan(req.session.userId, planId);
  req.session.userPlan = planId;

  console.log(`📊 Plan actualizado: ${planId}`);
  res.redirect('/plans');
});

// ==========================================
// PANEL DE ADMINISTRACIÓN
// ==========================================

app.get('/admin', isAuthenticated, async (req, res) => {
  try {
   const githubService = await getGitHubService(req);
   let allProjects = [];

    if (githubService) {
      try {
        allProjects = await githubService.getPortfolioProjects();
      } catch (error) {
        console.error('Error al obtener proyectos:', error.message);
      }
    }

    if (allProjects.length === 0) {
      allProjects = [
        { id: 1, name: 'ecommerce-api', fullName: 'devcraft/ecommerce-api', description: 'API RESTful para e-commerce', url: '#', language: 'JavaScript', stars: 24, forks: 8, isPrivate: false, techBadges: [{ name: 'Node.js', color: '#339933' }, { name: 'MongoDB', color: '#47a248' }] },
        { id: 2, name: 'react-dashboard', fullName: 'devcraft/react-dashboard', description: 'Dashboard con React y TypeScript', url: '#', language: 'TypeScript', stars: 18, forks: 5, isPrivate: false, techBadges: [{ name: 'React', color: '#61dafb' }, { name: 'TypeScript', color: '#3178c6' }] },
        { id: 3, name: 'ai-chatbot', fullName: 'devcraft/ai-chatbot', description: 'Chatbot con NLP', url: '#', language: 'Python', stars: 32, forks: 12, isPrivate: true, techBadges: [{ name: 'Python', color: '#3776ab' }] },
        { id: 4, name: 'mobile-app', fullName: 'devcraft/mobile-app', description: 'App móvil', url: '#', language: 'JavaScript', stars: 15, forks: 4, isPrivate: false, techBadges: [{ name: 'React Native', color: '#61dafb' }] },
        { id: 5, name: 'devops-tools', fullName: 'devcraft/devops-tools', description: 'Herramientas DevOps', url: '#', language: 'Go', stars: 28, forks: 10, isPrivate: false, techBadges: [{ name: 'Docker', color: '#2496ed' }] }
      ];
    }

    const user = await User.findById(req.session.userId);
    const userPlan = {
      id: user.plan,
      name: planService.getPlan(user.plan).name,
      icon: planService.getPlan(user.plan).icon,
      maxProjects: planService.getPlan(user.plan).maxProjects,
      color: planService.getPlan(user.plan).color,
      gradient: planService.getPlan(user.plan).gradient
    };

    const selectedProjects = user.selected_projects
      ? (typeof user.selected_projects === 'string' ? JSON.parse(user.selected_projects) : user.selected_projects)
      : [];

    const data = {
      title: 'Panel de Administración | DevCraft Studio',
      theme: req.theme,
      currentYear: new Date().getFullYear(),
      allProjects,
      userPlan,
      selectedProjects,
      maxProjects: userPlan.maxProjects === Infinity ? 999 : userPlan.maxProjects
    };

    const bodyHtml = await engine.render('admin.ejs', data, req.templateSets);
    const fullHtml = await engine.render('layout.ejs', {
      ...data,
      user: req.user,
      userPlan: res.locals.userPlan,
      body: bodyHtml
    }, req.templateSets);
    res.send(fullHtml);
  } catch (error) {
    console.error('❌ Error en admin:', error.message);
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p><a href="/admin">Reintentar</a>`);
  }
});

// ==========================================
// API ENDPOINTS
// ==========================================

// API para obtener README
app.get('/api/readme/:repoName', async (req, res) => {
  try {
    const githubService = await getGitHubService(req);
    if (!githubService) return res.json({ success: false, error: 'GitHub no configurado' });

    const readmeData = await githubService.getReadme(req.params.repoName);

    if (readmeData) {
      res.json({
        success: true,
        readme: readmeData.content,
        truncated: readmeData.truncated,
        totalLines: readmeData.totalLines
      });
    } else {
      res.json({ success: false, readme: null });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API de proyectos
app.get('/api/projects', async (req, res) => {
  try {
    const githubService = await getGitHubService(req);
    if (!githubService) return res.json({ success: true, projects: [] });
    const projects = await githubService.getPortfolioProjects();
    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API de perfil
app.get('/api/profile', async (req, res) => {
  try {
    const githubService = await getGitHubService(req);
    if (!githubService) return res.json({ success: true, profile: null });
    const profile = await githubService.getProfileStats();
    res.json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API de stack tecnológico
app.get('/api/tech-stack', async (req, res) => {
  try {
    const githubService = await getGitHubService(req);
    if (!githubService) return res.json({ success: true, techStack: [] });
    const techStack = await githubService.getDynamicTechStack();
    res.json({ success: true, techStack });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API para guardar selección de proyectos
app.post('/api/projects/selection', isAuthenticated, async (req, res) => {
  try {
    const { projects } = req.body;

    if (!Array.isArray(projects)) {
      return res.status(400).json({ success: false, error: 'Formato inválido' });
    }

    const user = await User.findById(req.session.userId);
    const planLimits = { free: 2, medium: 5, premium: 10, platinum: Infinity };
    const maxProjects = planLimits[user.plan] || 2;

    if (projects.length > maxProjects && maxProjects !== Infinity) {
      return res.status(400).json({
        success: false,
        error: `Tu plan permite máximo ${maxProjects} proyectos. Seleccionaste ${projects.length}.`
      });
    }

    await User.updateSelectedProjects(req.session.userId, projects);

    console.log(`📦 Proyectos guardados: ${projects.length}`);
    res.json({
      success: true,
      message: `${projects.length} proyectos guardados correctamente.`,
      selected: projects
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API para obtener selección actual
app.get('/api/projects/selection', isAuthenticated, async (req, res) => {
  try {
    const selected = await User.getSelectedProjects(req.session.userId);
    res.json({ success: true, selected });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// TEMA
// ==========================================

app.get('/toggle-theme', (req, res) => {
  const currentTheme = req.query.current || req.cookies?.theme || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  res.cookie('theme', newTheme, {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true
  });

  if (req.session.userId) {
    User.updateTheme(req.session.userId, newTheme).catch(() => {});
  }

  console.log(`🌓 Tema: ${currentTheme} → ${newTheme}`);

  const referer = req.get('referer') || '/';
  try {
    const url = new URL(referer, `http://${req.get('host')}`);
    url.searchParams.set('theme', newTheme);
    res.redirect(url.pathname + url.search);
  } catch (e) {
    res.redirect(`/?theme=${newTheme}`);
  }
});

// ==========================================
// CONTACTO
// ==========================================

app.post('/contact', (req, res) => {
  const { name, email, message } = req.body;
  console.log('📩 Contacto recibido:');
  console.log(`   Nombre: ${name}`);
  console.log(`   Email: ${email}`);
  console.log(`   Mensaje: ${message}`);
  res.json({ success: true, message: '¡Mensaje recibido! Te contactaremos pronto.' });
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    github: !!(process.env.GITHUB_TOKEN || res.locals.user?.github_token),
    authenticated: !!req.session.userId,
    theme: req.theme,
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// 404 - SIEMPRE AL FINAL
// ==========================================

app.use(async (req, res) => {
  try {
    const bodyHtml = await engine.render('404.ejs', {
      theme: req.theme
    }, req.templateSets);

    const fullHtml = await engine.render('layout.ejs', {
      title: '404 - No encontrado | DevCraft Studio',
      theme: req.theme,
      currentYear: new Date().getFullYear(),
      user: res.locals.user || null,
      userPlan: res.locals.userPlan || null,
      body: bodyHtml
    }, req.templateSets);

    res.status(404).send(fullHtml);
  } catch (error) {
    res.status(404).send(`
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"><title>404</title>
      <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8f9fa}.container{text-align:center}h1{font-size:6rem;color:#6c5ce7;margin:0}p{color:#636e72}a{color:#6c5ce7}</style>
      </head>
      <body><div class="container"><h1>404</h1><p>Página no encontrada</p><a href="/">Volver al inicio</a></div></body>
      </html>
    `);
  }
});

// ==========================================
// FUNCIÓN AUXILIAR: Stack de ejemplo
// ==========================================

function getExampleTechStack(filteredProjects) {
  const techColors = {
    'JavaScript': '#f7df1e', 'TypeScript': '#3178c6', 'Python': '#3776ab',
    'React': '#61dafb', 'Node.js': '#339933', 'Docker': '#2496ed',
    'MongoDB': '#47a248', 'GraphQL': '#e10098', 'AWS': '#ff9900',
    'Kubernetes': '#326ce5', 'Next.js': '#000000', 'Tailwind CSS': '#06b6d4',
    'React Native': '#61dafb', 'Firebase': '#ffca28', 'Go': '#00add8'
  };
  const icons = {
    'JavaScript': '📜', 'TypeScript': '🔷', 'Python': '🐍', 'React': '⚛️',
    'Node.js': '💚', 'Docker': '🐳', 'MongoDB': '🍃', 'GraphQL': '◈',
    'AWS': '☁️', 'Kubernetes': '☸️', 'Next.js': '▲', 'Tailwind CSS': '🌊',
    'React Native': '📱', 'Firebase': '🔥', 'Go': '🔵'
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
}

// ==========================================
// INICIAR SERVIDOR
// ==========================================

async function start() {
  const dbReady = await initDatabase();

  if (dbReady) {
    console.log('✅ Base de datos lista');
  } else {
    console.warn('⚠️  El sistema funcionará sin persistencia en base de datos');
    console.warn('   Los datos se guardarán solo en cookies/sesión\n');
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║   🚀 DevCraft Studio                         ║`);
    console.log(`║   Servidor: http://localhost:${PORT}             ║`);
    console.log(`║   Login:    http://localhost:${PORT}/login       ║`);
    console.log(`║   Registro: http://localhost:${PORT}/register    ║`);
    console.log(`║   Admin:    http://localhost:${PORT}/admin       ║`);
    console.log(`║   Planes:   http://localhost:${PORT}/plans       ║`);
    console.log(`╚══════════════════════════════════════════════╝\n`);
  });
}

start();