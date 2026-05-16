const User = require('../models/User');

/**
 * Middleware para verificar si el usuario está autenticado
 */
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

/**
 * Middleware para verificar si el usuario NO está autenticado
 */
function isNotAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  next();
}

/**
 * Middleware para cargar datos del usuario en res.locals
 */
async function loadUser(req, res, next) {
  res.locals.user = null;
  res.locals.userPlan = null;
  res.locals.selectedProjects = [];

  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId);
      if (user) {
        res.locals.user = user;
        res.locals.userPlan = {
          id: user.plan,
          name: getPlanName(user.plan),
          icon: getPlanIcon(user.plan),
          maxProjects: getPlanMaxProjects(user.plan),
          color: getPlanColor(user.plan),
          gradient: getPlanGradient(user.plan)
        };
        res.locals.selectedProjects = user.selected_projects
          ? (typeof user.selected_projects === 'string'
            ? JSON.parse(user.selected_projects)
            : user.selected_projects)
          : [];

        req.user = user;
        req.userPlan = res.locals.userPlan;
        req.selectedProjects = res.locals.selectedProjects;
      }
    } catch (error) {
      console.error('Error al cargar usuario:', error.message);
    }
  }
  next();
}

// ✅ Nuevo middleware para validar campos de login
function validateLoginFields(req, res, next) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).render('login', {
      error: 'Por favor, completa todos los campos.',
      email: email || '',
      theme: req.theme || 'light'
    });
  }

  // Validar formato de email básico
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).render('login', {
      error: 'Por favor, ingresa un email válido.',
      email: email,
      theme: req.theme || 'light'
    });
  }

  next();
}



// Funciones auxiliares
function getPlanName(plan) {
  const names = { free: 'Gratis', medium: 'Medio', premium: 'Premium', platinum: 'Platinum' };
  return names[plan] || 'Gratis';
}

function getPlanIcon(plan) {
  const icons = { free: '🆓', medium: '⭐', premium: '💎', platinum: '👑' };
  return icons[plan] || '🆓';
}

function getPlanMaxProjects(plan) {
  const limits = { free: 2, medium: 5, premium: 10, platinum: Infinity };
  return limits[plan] || 2;
}

function getPlanColor(plan) {
  const colors = { free: '#6c757d', medium: '#0d6efd', premium: '#d23669', platinum: '#ffd700' };
  return colors[plan] || '#6c757d';
}

function getPlanGradient(plan) {
  const gradients = {
    free: 'linear-gradient(135deg, #6c757d, #adb5bd)',
    medium: 'linear-gradient(135deg, #0d6efd, #6610f2)',
    premium: 'linear-gradient(135deg, #d23669, #ff6b6b)',
    platinum: 'linear-gradient(135deg, #ffd700, #ffaa00)'
  };
  return gradients[plan] || gradients.free;
}

module.exports = { isAuthenticated, isNotAuthenticated, loadUser };