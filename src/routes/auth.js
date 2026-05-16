const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAuthenticated, isNotAuthenticated } = require('../middleware/auth');

// Página de login
router.get('/login', isNotAuthenticated, (req, res) => {
  res.render('login', { 
    title: 'Iniciar Sesión | DevCraft Studio',
    error: req.query.error,
    success: req.query.success
  });
});

// Procesar login
router.post('/login', isNotAuthenticated, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validar campos
    if (!email || !password) {
      return res.redirect('/login?error=Todos los campos son obligatorios');
    }
    
    // Buscar usuario
    const user = await User.findByEmail(email);
    if (!user) {
      return res.redirect('/login?error=Email o contraseña incorrectos');
    }
    
    // Verificar contraseña
    const isValid = await User.verifyPassword(password, user.password);
    if (!isValid) {
      return res.redirect('/login?error=Email o contraseña incorrectos');
    }
    
    // Crear sesión
    req.session.userId = user.id;
    req.session.userPlan = user.plan;
    
    // Actualizar último login
    await User.updateLastLogin(user.id);
    
    // Redirigir a la página que intentaba acceder o al inicio
    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    
    console.log(`✅ Login exitoso: ${user.username} (${user.email})`);
    res.redirect(returnTo);
    
  } catch (error) {
    console.error('Error en login:', error);
    res.redirect('/login?error=Error al iniciar sesión');
  }
});

// Página de registro
router.get('/register', isNotAuthenticated, (req, res) => {
  res.render('register', { 
    title: 'Registro | DevCraft Studio',
    error: req.query.error
  });
});

// Procesar registro
router.post('/register', isNotAuthenticated, async (req, res) => {
  try {
    const { username, email, password, confirmPassword, fullName } = req.body;
    
    // Validaciones
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
    
    // Verificar si el email ya existe
    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      return res.redirect('/register?error=El email ya está registrado');
    }
    
    // Verificar si el username ya existe
    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res.redirect('/register?error=El nombre de usuario ya está en uso');
    }
    
    // Crear usuario
    await User.create({ username, email, password, fullName });
    
    console.log(`✅ Usuario registrado: ${username} (${email})`);
    res.redirect('/login?success=Cuenta creada exitosamente. Inicia sesión.');
    
  } catch (error) {
    console.error('Error en registro:', error);
    res.redirect('/register?error=Error al crear la cuenta');
  }
});

// Cerrar sesión
router.get('/logout', isAuthenticated, (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Error al cerrar sesión:', err);
    res.redirect('/login?success=Sesión cerrada correctamente');
  });
});

// Perfil del usuario
router.get('/profile', isAuthenticated, async (req, res) => {
  const user = await User.findById(req.session.userId);
  res.render('profile', { 
    title: 'Mi Perfil | DevCraft Studio',
    user
  });
});

// Actualizar perfil
router.post('/profile', isAuthenticated, async (req, res) => {
  try {
    const { fullName, githubUsername, githubToken } = req.body;
    
    if (githubUsername || githubToken) {
      await User.updateGitHubProfile(req.session.userId, { githubUsername, githubToken });
    }
    
    res.redirect('/profile?success=Perfil actualizado');
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.redirect('/profile?error=Error al actualizar');
  }
});

// Actualizar plan (desde la página de planes)
router.get('/set-plan/:planId', isAuthenticated, async (req, res) => {
  const validPlans = ['free', 'medium', 'premium', 'platinum'];
  const { planId } = req.params;
  
  if (!validPlans.includes(planId)) {
    return res.redirect('/plans');
  }
  
  await User.updatePlan(req.session.userId, planId);
  req.session.userPlan = planId;
  
  console.log(`📊 Plan actualizado a: ${planId}`);
  res.redirect('/plans');
});

// Actualizar tema
router.get('/set-theme/:theme', isAuthenticated, async (req, res) => {
  const { theme } = req.params;
  
  if (['light', 'dark'].includes(theme)) {
    await User.updateTheme(req.session.userId, theme);
  }
  
  const backUrl = req.get('referer') || '/';
  res.redirect(backUrl);
});

// Guardar selección de proyectos
router.post('/api/projects/selection', isAuthenticated, async (req, res) => {
  try {
    const { projects } = req.body;
    
    if (!Array.isArray(projects)) {
      return res.status(400).json({ success: false, error: 'Formato inválido' });
    }
    
    // Validar contra el plan
    const user = await User.findById(req.session.userId);
    const planLimits = { free: 2, medium: 5, premium: 10, platinum: Infinity };
    const maxProjects = planLimits[user.plan] || 2;
    
    if (projects.length > maxProjects && maxProjects !== Infinity) {
      return res.status(400).json({
        success: false,
        error: `Tu plan permite máximo ${maxProjects} proyectos`
      });
    }
    
    await User.updateSelectedProjects(req.session.userId, projects);
    
    res.json({
      success: true,
      message: `${projects.length} proyectos guardados`,
      selected: projects
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;