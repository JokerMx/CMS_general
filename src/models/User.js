const bcrypt = require('bcryptjs');

// Referencia al pool que se setea después de initDatabase
let pool = null;

function setPool(p) {
  pool = p;
}

function getPool() {
  if (!pool) {
    const { getPool: gp } = require('../database');
    pool = gp();
  }
  return pool;
}

class User {
  static async create({ username, email, password, fullName }) {
    const hashedPassword = await bcrypt.hash(password, 12);
    const p = getPool();
    const [result] = await p.query(
      `INSERT INTO users (username, email, password, full_name, plan, theme)
       VALUES (?, ?, ?, ?, 'free', 'light')`,
      [username, email, hashedPassword, fullName]
    );
    return result.insertId;
  }

  static async findByEmail(email) {
    // ✅ Validación para evitar error
    if (!email || typeof email !== 'string') {
      console.error('❌ findByEmail: email inválido o vacío:', email);
      return null;
    }

    try {
      const result = await db.query(
        'SELECT * FROM users WHERE email = $1',
        [email.toLowerCase().trim()]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error en findByEmail:', error.message);
      return null;
    }
  }

  static async findByUsername(username) {
    const p = getPool();
    const [rows] = await p.query(
      'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
      [username]
    );
    return rows[0] || null;
  }

  static async findById(id) {
    const p = getPool();
    const [rows] = await p.query(
      'SELECT id, username, email, full_name, plan, selected_projects, theme, avatar_url, github_username, github_token, is_active, last_login, created_at FROM users WHERE id = ? AND is_active = TRUE',
      [id]
    );
    return rows[0] || null;
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  static async updateLastLogin(userId) {
    const p = getPool();
    await p.query('UPDATE users SET last_login = NOW() WHERE id = ?', [userId]);
  }

  static async updatePlan(userId, plan) {
    const p = getPool();
    await p.query('UPDATE users SET plan = ?, selected_projects = NULL WHERE id = ?', [plan, userId]);
  }

  static async updateSelectedProjects(userId, projects) {
    const p = getPool();
    await p.query('UPDATE users SET selected_projects = ? WHERE id = ?', [JSON.stringify(projects), userId]);
  }

  static async getSelectedProjects(userId) {
    const p = getPool();
    const [rows] = await p.query('SELECT selected_projects FROM users WHERE id = ?', [userId]);
    if (rows[0] && rows[0].selected_projects) {
      return typeof rows[0].selected_projects === 'string'
        ? JSON.parse(rows[0].selected_projects)
        : rows[0].selected_projects;
    }
    return [];
  }

  static async updateTheme(userId, theme) {
    const p = getPool();
    await p.query('UPDATE users SET theme = ? WHERE id = ?', [theme, userId]);
  }

  static async updateGitHubProfile(userId, { githubUsername, githubToken }) {
    const p = getPool();
    await p.query('UPDATE users SET github_username = ?, github_token = ? WHERE id = ?', [githubUsername, githubToken, userId]);
  }

  static async updateAvatar(userId, avatarUrl) {
    const p = getPool();
    await p.query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, userId]);
  }
}

module.exports = User;