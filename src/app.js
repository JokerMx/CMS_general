const express = require('express');
const TemplateEngine = require('./templateEngine');
const { resolveTemplateContext } = require('./contextResolver');

const app = express();
const engine = new TemplateEngine();

app.use((req, res, next) => {
  const context = resolveTemplateContext(req);
  req.templateSets = context.sets;   // array, ej: ['premium', 'default']
  req.theme = context.theme;         // 'light' o 'dark'
  next();
});

app.get('/', async (req, res) => {
  const user = { name: 'Usuario', plan: req.templateSets.includes('premium') ? 'premium' : 'basico' };
  // Pasamos 'theme' como dato para que las plantillas activen el modo oscuro
  const bodyHtml = await engine.render('home-content.ejs', { title: 'Bienvenido', user, theme: req.theme }, req.templateSets);
  const fullHtml = await engine.render('layout.ejs', { title: 'Inicio', body: bodyHtml, user, theme: req.theme }, req.templateSets);
  res.send(fullHtml);
});

// Selector de temas para probar combinaciones
app.get('/temas', (req, res) => {
  const actual = req.templateSets.includes('premium') ? 'Premium' : 'Estándar';
  const tema = req.theme === 'dark' ? 'Oscuro' : 'Claro';
  res.send(`
    <div style="text-align:center; padding:50px; font-family:sans-serif;">
      <h2>Combinación actual: ${actual} + ${tema}</h2>
      <p>
        <a href="/">Estándar Claro</a> |
        <a href="/?theme=dark">Estándar Oscuro</a> |
        <a href="/?premium=1">Premium Claro</a> |
        <a href="/?premium=1&theme=dark">Premium Oscuro</a>
      </p>
    </div>
  `);
});

// Plantilla de email (conjunto explícito 'emails')
app.get('/email', async (req, res) => {
  const emailHtml = await engine.render('emails:welcome.ejs', { name: 'María', activationLink: 'http://example.com/activate' }, 'emails');
  res.type('html').send(emailHtml);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Servidor adaptativo en http://localhost:${PORT}`));