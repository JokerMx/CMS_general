const { query, executeQuery, getPool } = require('../database');
const bcrypt = require('bcryptjs');

class User {

  // ========== BÚSQUEDAS ==========

  static async findByEmail(email) {
  if (!email) return null;
  
  // Intentar hasta 3 veces
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const pool = getPool();
      if (!pool) {
        console.log('🔄 findByEmail: Pool no disponible, esperando...');
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      
      const [rows] = await query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
      return rows[0] || null;
    } catch (error) {
      console.error(`❌ findByEmail intento ${attempt}/3:`, error.message);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }
  
  console.error('❌ findByEmail: Todos los intentos fallaron');
  return null;
}


  static async findByUsername(username) {
    if (!username) return null;
    try {
      const [rows] = await query('SELECT * FROM users WHERE username = ?', [username.toLowerCase().trim()]);
      return rows[0] || null;
    } catch (error) {
      console.error('findByUsername:', error.message);
      return null;
    }
  }

  static async findById(id) {
    if (!id) return null;
    try {
      const [rows] = await query('SELECT * FROM users WHERE id = ?', [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('findById:', error.message);
      return null;
    }
  }

  static async findAll({ page = 1, limit = 20, search = '', role = '', plan = '' } = {}) {
    try {
      let sql = 'SELECT id, username, email, full_name, role, plan, theme, last_login, created_at FROM users WHERE 1=1';
      let countSql = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
      const params = [];

      if (search) {
        const s = `%${search}%`;
        const clause = ' AND (username LIKE ? OR email LIKE ? OR full_name LIKE ?)';
        sql += clause; countSql += clause;
        params.push(s, s, s);
      }
      if (role) {
        sql += ' AND role = ?'; countSql += ' AND role = ?';
        params.push(role);
      }
      if (plan) {
        sql += ' AND plan = ?'; countSql += ' AND plan = ?';
        params.push(plan);
      }

      const offset = (page - 1) * limit;
      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

      const [[{ total }]] = await query(countSql, [...params]);
      const [users] = await query(sql, [...params, limit, offset]);

      return { users, total, page, totalPages: Math.ceil(total / limit) };
    } catch (error) {
      console.error('findAll:', error.message);
      return { users: [], total: 0, page, totalPages: 0 };
    }
  }

  static async countByRole() {
    try {
      const [rows] = await query('SELECT role, COUNT(*) as count FROM users GROUP BY role');
      const counts = {};
      rows.forEach(r => { counts[r.role] = r.count; });
      return counts;
    } catch (error) {
      return {};
    }
  }

  // ========== CREAR ==========

  static async create({ username, email, password, fullName, role = 'user', plan = 'free' }) {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await executeQuery(
        'INSERT INTO users (username, email, password, full_name, role, plan, theme, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [username.toLowerCase().trim(), email.toLowerCase().trim(), hashedPassword, fullName || null, role, plan, 'light']
      );
      return this.findById(result.insertId);
    } catch (error) {
      console.error('create:', error.message);
      throw error;
    }
  }

  // ========== ACTUALIZAR ==========

  static async update(id, data) {
    try {
      const allowed = ['username', 'email', 'full_name', 'role', 'plan', 'bio', 'phone', 'company', 'position', 'website', 'location', 'github_username', 'github_token', 'avatar'];
      const updates = [];
      const params = [];
      for (const [key, value] of Object.entries(data)) {
        if (allowed.includes(key) && value !== undefined) {
          updates.push(`${key} = ?`);
          params.push(value);
        }
      }
      if (updates.length === 0) return this.findById(id);
      updates.push('updated_at = NOW()');
      params.push(id);
      await executeQuery(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
      return this.findById(id);
    } catch (error) {
      console.error('update:', error.message);
      return null;
    }
  }

  static async updatePassword(id, newPassword) {
    try {
      const hashed = await bcrypt.hash(newPassword, 10);
      await executeQuery('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashed, id]);
      return true;
    } catch (error) {
      return false;
    }
  }

  // ========== ELIMINAR ==========

  static async delete(id) {
    try {
      const user = await this.findById(id);
      if (!user) return false;
      if (user.role === 'owner') throw new Error('No se puede eliminar al Owner');
      await executeQuery('DELETE FROM users WHERE id = ?', [id]);
      return true;
    } catch (error) {
      throw error;
    }
  }

  // ========== MÉTODOS RÁPIDOS ==========

  static async verifyPassword(plain, hashed) {
    try {
      console.log('🔑 Verificando contraseña...');
      console.log('   Plain:', plain ? 'Recibido' : 'Vacío');
      console.log('   Hashed:', hashed ? 'Recibido (' + hashed.substring(0, 10) + '...)' : 'Vacío');

      const result = await bcrypt.compare(plain, hashed);
      console.log('   Resultado:', result ? 'Coincide ✅' : 'No coincide ❌');
      return result;
    } catch (error) {
      console.error('❌ verifyPassword Error:', error.message);
      return false;
    }
  }

  static async updateLastLogin(userId) {
    try { await executeQuery('UPDATE users SET last_login = NOW() WHERE id = ?', [userId]); } catch (error) { }
  }

  static async updatePlan(userId, plan) {
    try { await executeQuery('UPDATE users SET plan = ?, updated_at = NOW() WHERE id = ?', [plan, userId]); } catch (error) { }
  }

  static async updateTheme(userId, theme) {
    try { await executeQuery('UPDATE users SET theme = ?, updated_at = NOW() WHERE id = ?', [theme, userId]); } catch (error) { }
  }

  static async updateSelectedProjects(userId, projects) {
    try { await executeQuery('UPDATE users SET selected_projects = ?, updated_at = NOW() WHERE id = ?', [JSON.stringify(projects), userId]); } catch (error) { }
  }

  static async getSelectedProjects(userId) {
    try {
      const [rows] = await query('SELECT selected_projects FROM users WHERE id = ?', [userId]);
      if (rows[0]?.selected_projects) {
        try { return typeof rows[0].selected_projects === 'string' ? JSON.parse(rows[0].selected_projects) : rows[0].selected_projects; } catch { return []; }
      }
      return [];
    } catch (error) { return []; }
  }

  static async updateGitHubCredentials(userId, githubUsername, githubToken) {
    try { await executeQuery('UPDATE users SET github_username = ?, github_token = ?, updated_at = NOW() WHERE id = ?', [githubUsername || null, githubToken || null, userId]); } catch (error) { }
  }

  static async getGitHubCredentials(userId) {
    try {
      const [rows] = await query('SELECT github_username, github_token FROM users WHERE id = ?', [userId]);
      if (rows[0]?.github_username && rows[0]?.github_token) return { username: rows[0].github_username, token: rows[0].github_token };
      return null;
    } catch (error) { return null; }
  }
}

module.exports = User;