function resolveTemplateContext(req) {
  const sets = ['default']; // siempre base

  // Si solicita premium, lo ponemos al inicio (mayor prioridad)
  if (req.query.premium === '1') {
    sets.unshift('premium');
  }

  // El tema no es un conjunto, sino un dato adicional
  const theme = req.query.theme === 'dark' ? 'dark' : 'light';

  return { sets, theme };
}

module.exports = { resolveTemplateContext };