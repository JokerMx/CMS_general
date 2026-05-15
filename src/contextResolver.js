function resolveTemplateContext(req) {
  const sets = ['default'];

  // Premium desde cookie o query
  if (req.cookies?.plan === 'premium' || req.query.premium === '1') {
    sets.unshift('premium');
  }

  // Tema: primero query, luego cookie, luego default 'light'
  const theme = req.query.theme || req.cookies?.theme || 'light';

  return { sets, theme };
}

module.exports = { resolveTemplateContext };