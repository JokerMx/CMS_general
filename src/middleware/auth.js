const User = require('../models/User');

async function loadUser(req, res, next) {
  res.locals.user = null;
  res.locals.userPlan = null;
  res.locals.selectedProjects = [];

  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId);

      if (user) {
        res.locals.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role || 'user',
          plan: user.plan,
          theme: user.theme,
          avatar: user.avatar,
          bio: user.bio,
          phone: user.phone,
          company: user.company,
          position: user.position,
          website: user.website,
          location: user.location,
          github_username: user.github_username
        };

        const { PlanService } = require('../planService');
        const planService = new PlanService();
        const plan = planService.getPlan(user.plan || 'free');

        res.locals.userPlan = {
          id: user.plan || 'free',
          name: plan.name,
          icon: plan.icon,
          maxProjects: plan.maxProjects,
          color: plan.color,
          gradient: plan.gradient
        };

        if (user.selected_projects) {
          try {
            const parsed = typeof user.selected_projects === 'string'
              ? JSON.parse(user.selected_projects)
              : user.selected_projects;

            res.locals.selectedProjects = Array.isArray(parsed) ? parsed : [];
            console.log(`📦 Usuario ${user.username}: ${res.locals.selectedProjects.length} proyectos seleccionados`);
          } catch (e) {
            console.error('❌ Error al parsear selected_projects:', e.message);
            res.locals.selectedProjects = [];
          }
        } else {
          res.locals.selectedProjects = [];
        }
      }
    } catch (error) {
      console.error('Error al cargar usuario:', error.message);
    }
  }
  next();
}

function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

function isNotAuthenticated(req, res, next) {
  if (req.session && req.session.userId) return res.redirect('/');
  next();
}

function isAdmin(req, res, next) {
  if (!req.session || !req.session.userId) return res.redirect('/login');
  const userRole = res.locals.user?.role || 'user';
  if (userRole === 'admin' || userRole === 'owner') return next();
  res.status(403).send('<h1>403 - Acceso denegado</h1><a href="/">Volver</a>');
}

function isOwner(req, res, next) {
  if (!req.session || !req.session.userId) return res.redirect('/login');
  const userRole = res.locals.user?.role || 'user';
  if (userRole === 'owner') return next();
  res.status(403).send('<h1>403 - Solo Owner</h1><a href="/admin/users">Volver</a>');
}

function canEditUser(req, res, next) {
  const targetUserId = parseInt(req.params.id);
  const currentUser = res.locals.user;
  if (!currentUser) return res.redirect('/login');
  if (currentUser.id === targetUserId) return next();
  if (currentUser.role === 'admin' || currentUser.role === 'owner') return next();
  res.status(403).send('<h1>403</h1><a href="/profile">Volver</a>');
}

module.exports = { loadUser, isAuthenticated, isNotAuthenticated, isAdmin, isOwner, canEditUser };
