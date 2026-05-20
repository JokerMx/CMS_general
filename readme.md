# 🚀 Devfree Studio - Sistema de Portafolio Adaptativo

Sistema completo de portafolio para desarrolladores y agencias de software, construido con **Node.js + Express + EJS**. Se conecta a la **API de GitHub** para mostrar tus repositorios como proyectos, con un sistema de **plantillas adaptativas**, **temas claro/oscuro**, **planes de suscripción** y **panel de administración** para seleccionar qué proyectos mostrar.

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Tecnologías](#-tecnologías)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [URLs de Acceso](#-urls-de-acceso)
- [Sistema de Plantillas Adaptativas](#-sistema-de-plantillas-adaptativas)
- [Sistema de Planes](#-sistema-de-planes)
- [Panel de Administración](#-panel-de-administración)
- [API Endpoints](#-api-endpoints)
- [Personalización](#-personalización)
- [Despliegue en Producción](#-despliegue-en-producción)
- [Solución de Problemas](#-solución-de-problemas)
- [Licencia](#-licencia)

---

## ✨ Características

### 🎨 Diseño
- **Landing page profesional** con hero animado, servicios, portafolio y contacto
- **Tema Claro/Oscuro** con transición suave y persistencia en cookies
- **Tema Premium** con diseño exclusivo (glassmorphism, gradientes dorados)
- **Modo Premium + Oscuro** combinados correctamente
- **Responsive design** adaptable a móviles, tablets y desktop
- **Animaciones CSS** (fadeIn, float, bounce, draw SVG, pulse)

### 📦 Portafolio
- **Conexión a GitHub API** para mostrar repositorios públicos y privados
- **Modal con README.md** renderizado desde GitHub (limitado a 40 líneas)
- **Markdown renderizado** con `marked.js` (títulos, código, tablas, imágenes)
- **Badges tecnológicos** con colores oficiales de cada tecnología
- **Estadísticas** (estrellas, forks, issues, licencia)

### 📊 Stack Tecnológico
- **Generación dinámica** basada SOLO en los proyectos visibles del portafolio
- **Niveles calculados** por frecuencia de uso (50%) + estrellas (30%) + repositorios (20%)
- **Barras de progreso** con colores oficiales y efectos de brillo
- **Estadísticas detalladas** (proyectos, porcentaje, estrellas, repos)

### 💰 Sistema de Planes
- **4 planes**: Gratis (2 proyectos), Medio (5), Premium (10), Platinum (ilimitados)
- **Página de planes** con comparativa visual
- **Cambio de plan** con un clic, persistente en cookies
- **Límite de proyectos** según el plan activo

### ⚙️ Panel de Administración
- **Selección manual** de proyectos a mostrar en el portafolio
- **Interfaz visual** con checkmarks animados y contador en tiempo real
- **Modal de éxito** con animación SVG (círculo + checkmark dibujándose)
- **Validación de límites** según el plan contratado

### 🧩 Arquitectura
- **Motor de plantillas adaptativas** con fallback automático entre conjuntos
- **Caché de plantillas** compiladas para máximo rendimiento
- **Datos de ejemplo** si no se configura GitHub Token
- **Middleware de contexto** que resuelve tema, plan y conjunto de plantillas

---

## 🛠️ Tecnologías

| Tecnología | Uso |
|------------|-----|
| **Node.js** | Entorno de ejecución |
| **Express** | Framework web |
| **EJS** | Motor de plantillas |
| **Axios** | Cliente HTTP para GitHub API |
| **Marked** | Renderizado de Markdown |
| **cookie-parser** | Manejo de cookies |
| **dotenv** | Variables de entorno |

---

## 📝 Requisitos Previos

- **Node.js** v16 o superior
- **npm** v8 o superior
- **Token de GitHub** (classic) con permisos `repo` y `read:user`
- (Opcional) Cuenta de GitHub con repositorios

---

## 🚀 Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/Devfree-studio.git
cd Devfree-studio

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tu token de GitHub

# 4. Iniciar servidor
npm start

# 5. Abrir navegador
# http://localhost:3000