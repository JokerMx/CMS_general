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
const { loadUser, isAuthenticated, isNotAuthenticated, isAdmin, isOwner, canEditUser } = require('./middleware/auth');
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

// Middleware de contexto de plantillas
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
      if (credentials && credentials.token && credentials.username) {
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
// FUNCIÓN AUXILIAR: Validar campos de login
// ==========================================
function validateLoginFields(req, res, next) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.redirect('/login?error=Todos los campos son obligatorios');
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.redirect('/login?error=Ingresa un email válido');
  }

  if (password.length < 6) {
    return res.redirect('/login?error=La contraseña debe tener al menos 6 caracteres');
  }

  next();
}

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

  const total = filteredProjects.length || 1;
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
// RUTAS DE AUTENTICACIÓN
// ==========================================

// Página de login
app.get('/login', isNotAuthenticated, async (req, res) => {
  try {
    const bodyHtml = await engine.render('login.ejs', {
      error: req.query.error || null,
      success: req.query.success || null,
      email: ''
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
    console.error('❌ Error en login:', error.message);
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p><a href="/">Volver</a>`);
  }
});

app.post('/login', isNotAuthenticated, async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('\n🔐 INTENTO DE LOGIN');
    console.log('   Email:', email);
    console.log('   Password:', password ? 'Recibido' : 'Vacío');

    if (!email || !password) {
      console.log('❌ Campos vacíos');
      return res.redirect('/login?error=Todos los campos son obligatorios');
    }

    // Verificar conexión a BD
    const pool = require('./database').getPool();
    console.log('   Pool BD:', pool ? 'Disponible ✅' : 'NO DISPONIBLE ❌');

    if (!pool) {
      return res.redirect('/login?error=Error de conexión a la base de datos');
    }

    const user = await User.findByEmail(email);

    if (!user) {
      console.log('❌ Usuario no encontrado:', email);
      return res.redirect('/login?error=Email o contraseña incorrectos');
    }

    console.log('✅ Usuario encontrado:', user.username);

    const isValid = await User.verifyPassword(password, user.password);

    if (!isValid) {
      console.log('❌ Contraseña incorrecta');
      return res.redirect('/login?error=Email o contraseña incorrectos');
    }

    // Login exitoso
    req.session.userId = user.id;
    req.session.userPlan = user.plan || 'free';
    req.session.userEmail = user.email;
    req.session.userName = user.full_name || user.username;
    req.session.justLoggedIn = true;

    await User.updateLastLogin(user.id);
    console.log('✅ Login exitoso:', user.username);
    // Redirigir según el rol
    if (user.role === 'admin' || user.role === 'owner') {
      res.redirect('/admin/users');
    } else {
      res.redirect('/welcome');
    }

  } catch (error) {
    console.error('❌ Error en login:', error.message);
    res.redirect('/login?error=Error al iniciar sesión');
  }
});

// Página de bienvenida después del login
app.get('/welcome', isAuthenticated, async (req, res) => {
  try {
    const showModal = req.session.justLoggedIn || false;
    req.session.justLoggedIn = false;

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
    console.error('❌ Error en welcome:', error.message);
    res.redirect('/');
  }
});

// Página de registro
app.get('/register', isNotAuthenticated, async (req, res) => {
  try {
    const bodyHtml = await engine.render('register.ejs', {
      error: req.query.error || null
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
    console.error('❌ Error en registro:', error.message);
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.redirect('/register?error=Ingresa un email válido');
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
    console.error('❌ Error en registro:', error.message);
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
    console.error('❌ Error en perfil:', error.message);
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p><a href="/">Volver</a>`);
  }
});

// Actualizar perfil
app.post('/profile', isAuthenticated, async (req, res) => {
  try {
    const { githubUsername, githubToken } = req.body;

    if (githubUsername || githubToken) {
      await Config.setGitHubCredentials(
        req.session.userId,
        githubUsername || null,
        githubToken || null
      );
      console.log(`🔑 Credenciales de GitHub actualizadas para usuario ID: ${req.session.userId}`);
    }

    res.redirect('/profile?success=Perfil actualizado correctamente');
  } catch (error) {
    console.error('❌ Error al actualizar perfil:', error.message);
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
      try {
        techStack = await githubService.getDynamicTechStack();
      } catch (e) {
        techStack = getExampleTechStack(filteredProjects);
      }
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
    console.error('❌ Error en planes:', error.message);
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

  try {
    await User.updatePlan(req.session.userId, planId);
    req.session.userPlan = planId;
    console.log(`📊 Plan actualizado: ${planId}`);
  } catch (error) {
    console.error('❌ Error al cambiar plan:', error.message);
  }

  res.redirect('/plans');
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

  if (req.session && req.session.userId) {
    User.updateTheme(req.session.userId, newTheme).catch(() => { });
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
      id: user.plan || 'free',
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
      user: res.locals.user,
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

app.get('/api/projects/selection', isAuthenticated, async (req, res) => {
  try {
    const selected = await User.getSelectedProjects(req.session.userId);
    res.json({ success: true, selected });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
// API PARA SPA - Cargar secciones parciales
// ==========================================

// Hero section
app.get('/api/section/hero', async (req, res) => {
  try {
    const githubService = await getGitHubService(req);
    let profile = null;
    if (githubService) {
      try { profile = await githubService.getProfileStats(); } catch (e) { }
    }
    if (!profile) {
      profile = {
        username: process.env.GITHUB_USERNAME || 'devcraft',
        name: 'DevCraft Studio',
        totalRepos: 0, totalStars: 0, followers: 0
      };
    }
    const html = await engine.render('partials/hero.ejs', { profile, theme: req.theme }, req.templateSets);
    res.send(html);
  } catch (error) {
    res.status(500).send(`<p>Error: ${error.message}</p>`);
  }
});

// Services section
app.get('/api/section/services', async (req, res) => {
  try {
    const services = [
      { icon: '🖥️', title: 'Desarrollo Web', description: 'Aplicaciones web modernas con React, Vue, Angular y Node.js.', features: ['SPA/PWA', 'E-commerce', 'Dashboards'] },
      { icon: '📱', title: 'Apps Móviles', description: 'Aplicaciones nativas e híbridas para iOS y Android.', features: ['iOS & Android', 'UI/UX nativo', 'Offline-first'] },
      { icon: '☁️', title: 'Cloud & DevOps', description: 'Arquitecturas en AWS, Azure y GCP con CI/CD.', features: ['Docker/K8s', 'Serverless', 'Monitoreo'] },
      { icon: '🤖', title: 'IA & Automatización', description: 'Integración de modelos de IA y automatización.', features: ['ML/DL', 'NLP', 'RPA'] },
      { icon: '🔒', title: 'Ciberseguridad', description: 'Auditorías de seguridad y hardening.', features: ['Pentesting', 'OAuth/JWT', 'GDPR'] },
      { icon: '🎯', title: 'Consultoría Tech', description: 'Asesoría en arquitectura de software y migraciones.', features: ['Auditorías', 'Roadmaps', 'MVP'] }
    ];
    const html = await engine.render('partials/services-3d.ejs', { services, theme: req.theme }, req.templateSets);
    res.send(html);
  } catch (error) {
    res.status(500).send(`<p>Error: ${error.message}</p>`);
  }
});

// Portfolio section
app.get('/api/section/portfolio', async (req, res) => {
  try {
    const githubService = await getGitHubService(req);
    let projects = [];
    if (githubService) {
      try { projects = await githubService.getPortfolioProjects(); } catch (e) { }
    }
    if (projects.length === 0) {
      projects = [
        { id: 1, name: 'ecommerce-api', description: 'API RESTful para e-commerce', url: '#', language: 'JavaScript', stars: 24, forks: 8, isPrivate: false, techBadges: [{ name: 'Node.js', color: '#339933' }] },
        { id: 2, name: 'react-dashboard', description: 'Dashboard con React y TypeScript', url: '#', language: 'TypeScript', stars: 18, forks: 5, isPrivate: false, techBadges: [{ name: 'React', color: '#61dafb' }] },
        { id: 3, name: 'ai-chatbot', description: 'Chatbot con NLP', url: '#', language: 'Python', stars: 32, forks: 12, isPrivate: true, techBadges: [{ name: 'Python', color: '#3776ab' }] }
      ];
    }
    const userPlan = res.locals.userPlan || { id: 'free', maxProjects: 2 };
    const selectedProjects = res.locals.selectedProjects || [];
    const planService = new PlanService();
    const filteredProjects = planService.filterProjectsByPlan(projects, userPlan.id, selectedProjects);

    const html = await engine.render('partials/portfolio.ejs', { projects: filteredProjects, theme: req.theme }, req.templateSets);
    res.send(html);
  } catch (error) {
    res.status(500).send(`<p>Error: ${error.message}</p>`);
  }
});

// Tech Stack section
app.get('/api/section/tech-stack', async (req, res) => {
  try {
    const githubService = await getGitHubService(req);
    let techStack = [];
    if (githubService) {
      try { techStack = await githubService.getDynamicTechStack(); } catch (e) { }
    }
    if (techStack.length === 0) {
      techStack = [
        { name: 'JavaScript', level: 95, color: '#f7df1e', icon: '📜', count: 15, stars: 120 },
        { name: 'TypeScript', level: 88, color: '#3178c6', icon: '🔷', count: 10, stars: 85 },
        { name: 'React', level: 90, color: '#61dafb', icon: '⚛️', count: 8, stars: 95 },
        { name: 'Node.js', level: 85, color: '#339933', icon: '💚', count: 12, stars: 70 }
      ];
    }
    const html = await engine.render('partials/tech-stack.ejs', { techStack, theme: req.theme }, req.templateSets);
    res.send(html);
  } catch (error) {
    res.status(500).send(`<p>Error: ${error.message}</p>`);
  }
});

// Contact section
app.get('/api/section/contact', async (req, res) => {
  try {
    const html = await engine.render('partials/contact.ejs', { theme: req.theme }, req.templateSets);
    res.send(html);
  } catch (error) {
    res.status(500).send(`<p>Error: ${error.message}</p>`);
  }
});

// ==========================================
// GESTIÓN DE USUARIOS (ADMIN)
// ==========================================

// Lista de usuarios
app.get('/admin/users', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const { users, total, totalPages } = await User.findAll({
      page, limit: 15,
      search: req.query.search || '',
      role: req.query.role || '',
      plan: req.query.plan || ''
    });
    const roleCounts = await User.countByRole();

    const data = {
      title: 'Gestión de Usuarios | DevCraft Studio',
      theme: req.theme, currentYear: new Date().getFullYear(),
      user: res.locals.user, userPlan: res.locals.userPlan,
      users, pagination: { page, total, totalPages, search: req.query.search || '', role: req.query.role || '', plan: req.query.plan || '' },
      roleCounts
    };

    const bodyHtml = await engine.render('admin/users.ejs', data, req.templateSets);
    const fullHtml = await engine.render('layout.ejs', { ...data, body: bodyHtml }, req.templateSets);
    res.send(fullHtml);
  } catch (error) {
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

// Formulario crear usuario
app.get('/admin/users/create', isAuthenticated, isOwner, async (req, res) => {
  const data = {
    title: 'Crear Usuario | DevCraft Studio',
    theme: req.theme, currentYear: new Date().getFullYear(),
    user: res.locals.user, userPlan: res.locals.userPlan,
    formUser: {}, errors: {}, isEdit: false
  };
  const bodyHtml = await engine.render('admin/user-form.ejs', data, req.templateSets);
  const fullHtml = await engine.render('layout.ejs', { ...data, body: bodyHtml }, req.templateSets);
  res.send(fullHtml);
});

// Procesar crear usuario
app.post('/admin/users/create', isAuthenticated, isOwner, async (req, res) => {
  try {
    const { username, email, password, fullName, role, plan } = req.body;
    const errors = {};
    if (!username || username.length < 3) errors.username = 'Mínimo 3 caracteres';
    if (!email) errors.email = 'Email requerido';
    if (!password || password.length < 6) errors.password = 'Mínimo 6 caracteres';
    if (!errors.email && await User.findByEmail(email)) errors.email = 'Email ya registrado';
    if (!errors.username && await User.findByUsername(username)) errors.username = 'Usuario ya existe';

    if (Object.keys(errors).length > 0) {
      const data = {
        title: 'Crear Usuario', theme: req.theme, currentYear: new Date().getFullYear(),
        user: res.locals.user, userPlan: res.locals.userPlan,
        formUser: { username, email, fullName, role: role || 'user', plan: plan || 'free' },
        errors, isEdit: false
      };
      const bodyHtml = await engine.render('admin/user-form.ejs', data, req.templateSets);
      const fullHtml = await engine.render('layout.ejs', { ...data, body: bodyHtml }, req.templateSets);
      return res.send(fullHtml);
    }

    await User.create({ username, email, password, fullName, role: role || 'user', plan: plan || 'free' });
    res.redirect('/admin/users?success=Usuario creado');
  } catch (error) {
    res.redirect('/admin/users?error=Error al crear');
  }
});

// Editar usuario
app.get('/admin/users/:id/edit', isAuthenticated, canEditUser, async (req, res) => {
  const formUser = await User.findById(req.params.id);
  if (!formUser) return res.redirect('/admin/users?error=No encontrado');
  const data = {
    title: 'Editar Usuario', theme: req.theme, currentYear: new Date().getFullYear(),
    user: res.locals.user, userPlan: res.locals.userPlan,
    formUser, errors: {}, isEdit: true
  };
  const bodyHtml = await engine.render('admin/user-form.ejs', data, req.templateSets);
  const fullHtml = await engine.render('layout.ejs', { ...data, body: bodyHtml }, req.templateSets);
  res.send(fullHtml);
});

// Procesar editar usuario
app.post('/admin/users/:id/edit', isAuthenticated, canEditUser, async (req, res) => {
  try {
    const { username, email, fullName, role, plan, bio, phone, company, position, website, location, github_username, newPassword } = req.body;
    const updateData = { username, email, full_name: fullName, bio, phone, company, position, website, location, github_username };
    if (res.locals.user.role === 'owner') { updateData.role = role; updateData.plan = plan; }
    await User.update(req.params.id, updateData);
    if (newPassword && newPassword.length >= 6) await User.updatePassword(req.params.id, newPassword);
    res.redirect('/admin/users?success=Usuario actualizado');
  } catch (error) {
    res.redirect(`/admin/users/${req.params.id}/edit?error=Error`);
  }
});

// Ver detalle
app.get('/admin/users/:id', isAuthenticated, isAdmin, async (req, res) => {
  const detailUser = await User.findById(req.params.id);
  if (!detailUser) return res.redirect('/admin/users');
  const data = {
    title: `${detailUser.username} | DevCraft Studio`,
    theme: req.theme, currentYear: new Date().getFullYear(),
    user: res.locals.user, userPlan: res.locals.userPlan, detailUser
  };
  const bodyHtml = await engine.render('admin/user-detail.ejs', data, req.templateSets);
  const fullHtml = await engine.render('layout.ejs', { ...data, body: bodyHtml }, req.templateSets);
  res.send(fullHtml);
});

// Eliminar usuario
app.post('/admin/users/:id/delete', isAuthenticated, isOwner, async (req, res) => {
  try {
    await User.delete(req.params.id);
    res.redirect('/admin/users?success=Usuario eliminado');
  } catch (error) {
    res.redirect(`/admin/users?error=${encodeURIComponent(error.message)}`);
  }
});

// ==========================================
// PERFIL PROPIO
// ==========================================

app.get('/profile', isAuthenticated, async (req, res) => {
  const profileUser = await User.findById(req.session.userId);
  const data = {
    title: 'Mi Perfil | DevCraft Studio',
    theme: req.theme, currentYear: new Date().getFullYear(),
    user: res.locals.user, userPlan: res.locals.userPlan, profileUser
  };
  const bodyHtml = await engine.render('profile.ejs', data, req.templateSets);
  const fullHtml = await engine.render('layout.ejs', { ...data, body: bodyHtml }, req.templateSets);
  res.send(fullHtml);
});

app.get('/profile/edit', isAuthenticated, async (req, res) => {
  const formUser = await User.findById(req.session.userId);
  const data = {
    title: 'Editar Perfil', theme: req.theme, currentYear: new Date().getFullYear(),
    user: res.locals.user, userPlan: res.locals.userPlan,
    formUser, errors: {}, isOwnProfile: true
  };
  const bodyHtml = await engine.render('edit-profile.ejs', data, req.templateSets);
  const fullHtml = await engine.render('layout.ejs', { ...data, body: bodyHtml }, req.templateSets);
  res.send(fullHtml);
});

app.post('/profile/edit', isAuthenticated, async (req, res) => {
  try {
    const { fullName, bio, phone, company, position, website, location, github_username, github_token, currentPassword, newPassword } = req.body;
    const updateData = { full_name: fullName, bio, phone, company, position, website, location, github_username };
    if (github_token) updateData.github_token = github_token;
    await User.update(req.session.userId, updateData);
    if (currentPassword && newPassword && newPassword.length >= 6) {
      const user = await User.findById(req.session.userId);
      const valid = await User.verifyPassword(currentPassword, user.password);
      if (valid) await User.updatePassword(req.session.userId, newPassword);
    }
    res.redirect('/profile?success=Perfil actualizado');
  } catch (error) {
    res.redirect('/profile/edit?error=Error');
  }
});

app.get('/debug-db', (req, res) => {
  res.json({
    DB_HOST: process.env.DB_HOST || 'NO CONFIGURADO',
    DB_PORT: process.env.DB_PORT || 'NO CONFIGURADO',
    DB_NAME: process.env.DB_NAME || 'NO CONFIGURADO',
    DB_USER: process.env.DB_USER || 'NO CONFIGURADO',
    DB_PASS: process.env.DB_PASS ? '✅ Configurado (' + process.env.DB_PASS.substring(0, 3) + '***)' : '❌ NO CONFIGURADO',
    DB_SSL: process.env.DB_SSL || 'NO CONFIGURADO'
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
// INICIAR CONEXIÓN (Adaptado para Vercel)
// ==========================================

// Middleware para asegurar que la base de datos se inicialice antes de procesar cualquier ruta
app.use(async (req, res, next) => {
  try {
    // initDatabase() debe estar preparado para no duplicar conexiones si ya está lista
    const dbReady = await initDatabase();
    if (!dbReady) {
      console.warn('⚠️ El sistema funciona sin persistencia en base de datos');
    }
  } catch (error) {
    console.error('❌ Error crítico al conectar la base de datos:', error);
  }
  next();
});

// VERSION VERCEL - El servidor se inicia automáticamente al exportar la app, no necesitamos llamar a app.listen() ni manejar SIGINT/SIGTERM
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
};

// ==========================================
// EXPORTAR APLICACIÓN
// ==========================================

// Eliminamos app.listen() y process.on() ya que Vercel maneja el ciclo de vida
start(); 
module.exports = app;















/* Inicio para windows o linux
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

  // ==========================================
  // GRACEFUL SHUTDOWN - Cerrar pool al salir
  // ==========================================
  process.on('SIGINT', async () => {
    console.log('\n🛑 Cerrando servidor...');
    const { closePool } = require('./database');
    await closePool();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Cerrando servidor...');
    const { closePool } = require('./database');
    await closePool();
    process.exit(0);
  });
}

start();
*/