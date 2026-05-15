#!/bin/bash

# Crear directorios
mkdir -p src/templates/default src/templates/premium src/templates/emails

# package.json
cat > package.json << 'EOF'
{
  "name": "mi-sistema",
  "version": "1.0.0",
  "description": "Sistema de templates con EJS",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js"
  },
  "dependencies": {
    "ejs": "^3.1.9"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}
EOF

# src/app.js
cat > src/app.js << 'EOF'
// Punto de entrada principal
const TemplateEngine = require('./templateEngine');
const contextResolver = require('./contextResolver');

console.log('Sistema de templates iniciado');
// Ejemplo de uso
// const engine = new TemplateEngine();
// engine.render('home-content', { user: { name: 'Juan' } }, 'default')
//   .then(html => console.log(html))
//   .catch(err => console.error(err));
EOF

# src/templateEngine.js
cat > src/templateEngine.js << 'EOF'
const ejs = require('ejs');
const path = require('path');

class TemplateEngine {
  constructor(templateDir = 'templates') {
    this.templateDir = path.join(__dirname, templateDir);
  }

  render(templateName, data, theme = 'default') {
    const filePath = path.join(this.templateDir, theme, `${templateName}.ejs`);
    return new Promise((resolve, reject) => {
      ejs.renderFile(filePath, data, (err, html) => {
        if (err) reject(err);
        else resolve(html);
      });
    });
  }
}

module.exports = TemplateEngine;
EOF

# src/contextResolver.js
cat > src/contextResolver.js << 'EOF'
// Resuelve el contexto para las plantillas (datos comunes)
function resolveContext(req = {}) {
  return {
    siteName: 'Mi Sistema',
    user: req.user || null,
    year: new Date().getFullYear()
  };
}

module.exports = resolveContext;
EOF

# templates/default/layout.ejs
cat > src/templates/default/layout.ejs << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title><%= title || 'Mi Sistema' %></title>
</head>
<body>
    <%- include('header', { user: user }) %>
    <main>
        <%- body %>
    </main>
    <%- include('footer') %>
</body>
</html>
EOF

# templates/default/header.ejs
cat > src/templates/default/header.ejs << 'EOF'
<header>
    <h1>Mi Sistema - Default Theme</h1>
    <% if (user) { %>
        <p>Bienvenido, <%= user.name %></p>
    <% } else { %>
        <p>Invitado</p>
    <% } %>
</header>
EOF

# templates/default/footer.ejs
cat > src/templates/default/footer.ejs << 'EOF'
<footer>
    <p>&copy; <%= new Date().getFullYear() %> Mi Sistema</p>
</footer>
EOF

# templates/default/home-content.ejs
cat > src/templates/default/home-content.ejs << 'EOF'
<section>
    <h2>Contenido principal - Default</h2>
    <p>Bienvenido a la página de inicio.</p>
</section>
EOF

# templates/premium/layout.ejs
cat > src/templates/premium/layout.ejs << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title><%= title || 'Mi Sistema Premium' %></title>
    <style>
        body { font-family: Arial, sans-serif; background: #f4f4f9; }
        header { background: #2c3e50; color: white; padding: 1rem; }
        main { padding: 2rem; }
        footer { background: #2c3e50; color: white; text-align: center; padding: 1rem; }
    </style>
</head>
<body>
    <%- include('header', { user: user }) %>
    <main>
        <%- body %>
    </main>
    <footer>Premium Footer</footer>
</body>
</html>
EOF

# templates/premium/header.ejs
cat > src/templates/premium/header.ejs << 'EOF'
<header>
    <h1>✨ Sistema Premium ✨</h1>
    <nav>Inicio | Perfil | Dashboard</nav>
    <% if (user) { %>
        <p>Hola <%= user.name %> (Premium)</p>
    <% } %>
</header>
EOF

# templates/premium/home-content.ejs
cat > src/templates/premium/home-content.ejs << 'EOF'
<section>
    <h2>Contenido exclusivo Premium</h2>
    <p>Disfruta de funciones avanzadas y soporte prioritario.</p>
</section>
EOF

# templates/emails/welcome.ejs
cat > src/templates/emails/welcome.ejs << 'EOF'
<h1>Bienvenido, <%= user.name %>!</h1>
<p>Gracias por registrarte en Mi Sistema.</p>
<p>Esperamos que disfrutes de la experiencia.</p>
EOF

echo "✅ Estructura de proyecto generada exitosamente."
echo "📦 Ejecuta 'npm install' para instalar dependencias."
echo "🚀 Luego ejecuta 'npm start' para iniciar."