const PLANS = {
  free: {
    name: 'Gratis',
    icon: '🆓',
    maxProjects: 2,
    price: 0,
    features: [
      'Hasta 2 proyectos visibles',
      'Actualización manual',
      'Soporte por email'
    ],
    color: '#6c757d',
    gradient: 'linear-gradient(135deg, #6c757d, #adb5bd)'
  },
  medium: {
    name: 'Medio',
    icon: '⭐',
    maxProjects: 5,
    price: 9.99,
    features: [
      'Hasta 5 proyectos visibles',
      'Actualización diaria',
      'Soporte prioritario',
      'Estadísticas básicas'
    ],
    color: '#0d6efd',
    gradient: 'linear-gradient(135deg, #0d6efd, #6610f2)'
  },
  premium: {
    name: 'Premium',
    icon: '💎',
    maxProjects: 10,
    price: 19.99,
    features: [
      'Hasta 10 proyectos visibles',
      'Actualización cada 6 horas',
      'Soporte VIP 24/7',
      'Estadísticas avanzadas',
      'README en modal',
      'Temas personalizables'
    ],
    color: '#d23669',
    gradient: 'linear-gradient(135deg, #d23669, #ff6b6b)'
  },
  platinum: {
    name: 'Platinum',
    icon: '👑',
    maxProjects: Infinity,
    price: 49.99,
    features: [
      'Proyectos ilimitados',
      'Actualización en tiempo real',
      'Soporte dedicado',
      'Estadísticas completas',
      'README en modal',
      'Temas ilimitados',
      'API personalizada',
      'Dominio personalizado'
    ],
    color: '#ffd700',
    gradient: 'linear-gradient(135deg, #ffd700, #ffaa00, #ff8c00)'
  }
};

class PlanService {
  constructor() {
    this.plans = PLANS;
  }

  getAllPlans() {
    return Object.entries(this.plans).map(([key, plan]) => ({
      id: key,
      ...plan
    }));
  }

  getPlan(planId) {
    return this.plans[planId] || this.plans.free;
  }

  getUserPlan(req) {
    // Si el middleware loadUser ya asignó userPlan, usarlo
    if (req.userPlan) return req.userPlan;

    // Si no, obtener desde sesión o query
    const planId = req.session?.userPlan || req.query.plan || 'free';
    return {
      id: planId,
      ...this.getPlan(planId)
    };
  }

  filterProjectsByPlan(projects, planId, selectedProjects = []) {
    // Si hay proyectos seleccionados, filtrar por esos nombres
    if (selectedProjects.length > 0) {
      const filtered = projects.filter(p => selectedProjects.includes(p.name));
      return filtered;
    }

    // Si no, limitar por cantidad del plan
    const plan = this.getPlan(planId);
    if (plan.maxProjects === Infinity) return projects;
    return projects.slice(0, plan.maxProjects);
  }
  getSelectedProjects(req) {
    try {
      const selected = req.cookies?.selectedProjects;
      return selected ? JSON.parse(selected) : [];
    } catch {
      return [];
    }
  }

  setSelectedProjectsCookie(res, projects) {
    res.cookie('selectedProjects', JSON.stringify(projects), {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true
    });
  }
}

module.exports = { PlanService, PLANS };