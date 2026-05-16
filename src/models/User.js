const { getPool } = require('../database');
const bcrypt = require('bcryptjs');

class User {
  /**
   * Buscar usuario por email
   */
  static async findByEmail(email) {
    if (!email || typeof email !== 'string') {
      console.error('❌ findByEmail: email inválido o vacío:', email);
      return null;
    }

    try {
      const pool = getPool();
      if (!pool) {
        console.error('❌ findByEmail: pool no disponible');
        return null;
      }

      // ✅ MySQL usa ? en lugar de $1
      const [rows] = await pool.query(
        'SELECT * FROM users WHERE email = ?',
        [email.toLowerCase().trim()]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('❌ Error en findByEmail:', error.message);
      return null;
    }
  }

  /**
   * Buscar usuario por username
   */
  static async findByUsername(username) {
    if (!username || typeof username !== 'string') {
      console.error('❌ findByUsername: username inválido:', username);
      return null;
    }

    try {
      const pool = getPool();
      if (!pool) return null;

      const [rows] = await pool.query(
        'SELECT * FROM users WHERE username = ?',
        [username.toLowerCase().trim()]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('❌ Error en findByUsername:', error.message);
      return null;
    }
  }

  /**
   * Buscar usuario por ID
   */
  static async findById(id) {
    if (!id) {
      console.error('❌ findById: id inválido:', id);
      return null;
    }

    try {
      const pool = getPool();
      if (!pool) return null;

      const [rows] = await pool.query(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('❌ Error en findById:', error.message);
      return null;
    }
  }

  /**
   * Crear nuevo usuario
   */
  static async create({ username, email, password, fullName }) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Base de datos no disponible');

      const hashedPassword = await bcrypt.hash(password, 10);

      const [result] = await pool.query(
        `INSERT INTO users (username, email, password, full_name, plan, theme, created_at) 
         VALUES (?, ?, ?, ?, 'free', 'light', NOW())`,
        [
          username.toLowerCase().trim(),
          email.toLowerCase().trim(),
          hashedPassword,
          fullName || null
        ]
      );
      
      // Devolver el usuario creado
      return this.findById(result.insertId);
    } catch (error) {
      console.error('❌ Error en create:', error.message);
      throw error;
    }
  }

  /**
   * Verificar contraseña
   */
  static async verifyPassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      console.error('❌ Error en verifyPassword:', error.message);
      return false;
    }
  }

  /**
   * Actualizar último login
   */
  static async updateLastLogin(userId) {
    try {
      const pool = getPool();
      if (!pool) return;

      await pool.query(
        'UPDATE users SET last_login = NOW() WHERE id = ?',
        [userId]
      );
    } catch (error) {
      console.error('❌ Error en updateLastLogin:', error.message);
    }
  }

  /**
   * Actualizar plan del usuario
   */
  static async updatePlan(userId, plan) {
    try {
      const pool = getPool();
      if (!pool) return;

      await pool.query(
        'UPDATE users SET plan = ? WHERE id = ?',
        [plan, userId]
      );
    } catch (error) {
      console.error('❌ Error en updatePlan:', error.message);
    }
  }

  /**
   * Actualizar tema del usuario
   */
  static async updateTheme(userId, theme) {
    try {
      const pool = getPool();
      if (!pool) return;

      await pool.query(
        'UPDATE users SET theme = ? WHERE id = ?',
        [theme, userId]
      );
    } catch (error) {
      console.error('❌ Error en updateTheme:', error.message);
    }
  }

  /**
   * Actualizar proyectos seleccionados
   */
  static async updateSelectedProjects(userId, projects) {
    try {
      const pool = getPool();
      if (!pool) return;

      await pool.query(
        'UPDATE users SET selected_projects = ? WHERE id = ?',
        [JSON.stringify(projects), userId]
      );
    } catch (error) {
      console.error('❌ Error en updateSelectedProjects:', error.message);
    }
  }

  /**
   * Obtener proyectos seleccionados
   */
  static async getSelectedProjects(userId) {
    try {
      const pool = getPool();
      if (!pool) return [];

      const [rows] = await pool.query(
        'SELECT selected_projects FROM users WHERE id = ?',
        [userId]
      );
      
      if (rows[0] && rows[0].selected_projects) {
        try {
          return typeof rows[0].selected_projects === 'string'
            ? JSON.parse(rows[0].selected_projects)
            : rows[0].selected_projects;
        } catch {
          return [];
        }
      }
      return [];
    } catch (error) {
      console.error('❌ Error en getSelectedProjects:', error.message);
      return [];
    }
  }
}

module.exports = User;