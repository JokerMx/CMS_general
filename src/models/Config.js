const { getPool } = require('../database');

class Config {
  /**
   * Obtener un valor de configuración para un usuario
   */
  static async get(userId, key) {
    const pool = getPool();
    if (!pool) return null;

    const [rows] = await pool.query(
      'SELECT config_value FROM config WHERE user_id = ? AND config_key = ?',
      [userId, key]
    );
    return rows[0] ? rows[0].config_value : null;
  }

  /**
   * Establecer un valor de configuración para un usuario
   */
  static async set(userId, key, value) {
    const pool = getPool();
    if (!pool) return false;

    await pool.query(
      `INSERT INTO config (user_id, config_key, config_value) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
      [userId, key, value]
    );
    return true;
  }

  /**
   * Obtener todas las configuraciones de un usuario
   */
  static async getAll(userId) {
    const pool = getPool();
    if (!pool) return {};

    const [rows] = await pool.query(
      'SELECT config_key, config_value FROM config WHERE user_id = ?',
      [userId]
    );

    const config = {};
    rows.forEach(row => {
      config[row.config_key] = row.config_value;
    });
    return config;
  }

  /**
   * Eliminar una configuración
   */
  static async delete(userId, key) {
    const pool = getPool();
    if (!pool) return false;

    await pool.query(
      'DELETE FROM config WHERE user_id = ? AND config_key = ?',
      [userId, key]
    );
    return true;
  }

  /**
   * Obtener credenciales de GitHub del usuario
   * Si no tiene, devolver las del .env
   */
  static async getGitHubCredentials(userId) {
    const githubUsername = await this.get(userId, 'github_username');
    const githubToken = await this.get(userId, 'github_token');

    return {
      username: githubUsername || process.env.GITHUB_USERNAME || null,
      token: githubToken || process.env.GITHUB_TOKEN || null
    };
  }

  /**
   * Guardar credenciales de GitHub del usuario
   */
  static async setGitHubCredentials(userId, username, token) {
    await this.set(userId, 'github_username', username);
    await this.set(userId, 'github_token', token);
    return true;
  }

  /**
   * Obtener todas las configuraciones del sitio
   */
  static async getSiteSettings() {
    const pool = getPool();
    if (!pool) return {};

    const [rows] = await pool.query('SELECT setting_key, setting_value FROM site_settings');
    const settings = {};
    rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    return settings;
  }
}
module.exports = Config;