const mysql = require('mysql2/promise');

let pool = null;

/**
 * Inicializa el pool de conexiones a MySQL
 */
async function initDatabase() {
  try {
    if (pool) {
      try {
        await pool.end();
      } catch (e) { }
      pool = null;
    }
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME || 'Devfree',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      idleTimeout: 10000,
      connectTimeout: 10000,
      enableKeepAlive: false
    });

    const connection = await pool.getConnection();
    console.log('✅ Conectado a MySQL');

    // ==========================================
    // TABLA: users
    // ==========================================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100),
        role VARCHAR(20) DEFAULT 'user',
        plan VARCHAR(20) DEFAULT 'free',
        theme VARCHAR(10) DEFAULT 'light',
        avatar VARCHAR(255) DEFAULT NULL,
        bio TEXT DEFAULT NULL,
        phone VARCHAR(20) DEFAULT NULL,
        company VARCHAR(100) DEFAULT NULL,
        position VARCHAR(100) DEFAULT NULL,
        website VARCHAR(255) DEFAULT NULL,
        location VARCHAR(255) DEFAULT NULL,
        github_username VARCHAR(100) DEFAULT NULL,
        github_token VARCHAR(255) DEFAULT NULL,
        selected_projects JSON DEFAULT NULL,
        last_login DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla users verificada');

    // ==========================================
    // TABLA: config
    // ==========================================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS config (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          config_key VARCHAR(100) NOT NULL,
          config_value TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_key (user_id, config_key),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla config verificada');

    // ==========================================
    // TABLA: projects (proyectos guardados)
    // ==========================================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        full_name VARCHAR(255),
        description TEXT,
        url VARCHAR(255),
        language VARCHAR(50),
        stars INT DEFAULT 0,
        forks INT DEFAULT 0,
        is_private TINYINT(1) DEFAULT 0,
        topics JSON DEFAULT NULL,
        selected TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla projects verificada');

    // ==========================================
    // TABLA: contact_messages
    // ==========================================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        subject VARCHAR(255),
        message TEXT NOT NULL,
        readed TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_readed (readed)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla contact_messages verificada');

    // ==========================================
    // TABLA: site_settings
    // ==========================================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) NOT NULL UNIQUE,
        setting_value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla site_settings verificada');

    // ==========================================
    // INSERTAR configuración por defecto
    // ==========================================
    await connection.query(`
      INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES
      ('site_name', 'Devfree Studio'),
      ('site_description', 'Desarrollo de Software Profesional'),
      ('contact_email', 'hello@Devfreestudio.dev'),
      ('contact_phone', '+1 (555) 123-4567'),
      ('contact_address', 'San Francisco, CA');
    `);
    console.log('✅ Configuración por defecto insertada');

    // ==========================================
    // ACTUALIZAR primer usuario como Owner
    // ==========================================
    await connection.query(`
      UPDATE users SET role = 'owner' WHERE id = 1 AND role = 'user';
    `);

    connection.release();
    console.log('✅ Todas las tablas verificadas, conexión liberada');
    return true;
  } catch (error) {
    console.error('❌ Error de conexión a MySQL:', error.message);
    pool = null;
    return false;
  }
}

/**
 * Obtener el pool de conexiones
 */
function getPool() {
  return pool;
}

/**
 * Ejecutar query y liberar conexión automáticamente
 */
/**
 * Ejecutar query que no devuelve filas, con reintentos
 */
async function executeQuery(sql, params = [], retries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const pool = getPool();
    if (!pool) {
      console.log('🔄 Pool no disponible, reintentando...');
      const { initDatabase } = require('./database');
      await initDatabase();
      if (!getPool()) throw new Error('Base de datos no disponible');
    }

    let connection;
    try {
      connection = await getPool().getConnection();
      const [result] = await connection.query(sql, params);
      return result;
    } catch (error) {
      lastError = error;

      if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ETIMEDOUT') {
        console.log(`⚠️ Intento ${attempt}/${retries} falló: ${error.code}. Reintentando...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
        continue;
      }

      throw error;
    } finally {
      if (connection) {
        try { connection.release(); } catch (e) { }
      }
    }
  }

  throw lastError || new Error('Error en executeQuery');
}

/**
 * Ejecutar query que devuelve filas
 */
/**
 * Ejecutar query con reintentos automáticos
 */
async function query(sql, params = [], retries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const pool = getPool();
    if (!pool) {
      // Intentar reconectar
      console.log('🔄 Pool no disponible, intentando reconectar...');
      const { initDatabase } = require('./database');
      await initDatabase();
      if (!getPool()) return [[], []];
    }

    let connection;
    try {
      connection = await getPool().getConnection();
      const [rows, fields] = await connection.query(sql, params);
      return [rows, fields];
    } catch (error) {
      lastError = error;

      if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ETIMEDOUT') {
        console.log(`⚠️ Intento ${attempt}/${retries} falló: ${error.code}. Reintentando en ${attempt * 500}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
        continue;
      }

      console.error('❌ Error en query:', error.message);
      throw error;
    } finally {
      if (connection) {
        try { connection.release(); } catch (e) { }
      }
    }
  }

  console.error('❌ Todos los reintentos fallaron:', lastError.message);
  return [[], []];
}

/**
 * Cerrar el pool completamente
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('🔌 Pool de conexiones cerrado');
  }
}

module.exports = { getPool, initDatabase, executeQuery, query, closePool };