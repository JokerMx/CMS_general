const mysql = require('mysql2/promise');

let pool = null;

/**
 * Inicializa el pool de conexiones a MySQL
 */
async function initDatabase() {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME || 'devcraft',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      waitForConnections: true,
      connectionLimit: 5, // Límite de Vercel
      queueLimit: 0,
      // Tiempo máximo de inactividad antes de cerrar
      idleTimeout: 10000, // 10 segundos
      // Tiempo máximo de conexión
      connectTimeout: 10000,
      // Cerrar conexiones inactivas
      enableKeepAlive: false
    });

    // Probar conexión y liberar inmediatamente
    const connection = await pool.getConnection();
    console.log('✅ Conectado a MySQL');
    
    // Crear tablas si no existen
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
    
    // Liberar conexión inmediatamente
    connection.release();
    console.log('✅ Tablas verificadas, conexión liberada');
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
 * 🆕 Ejecutar query y liberar conexión automáticamente
 */
async function executeQuery(sql, params = []) {
  const pool = getPool();
  if (!pool) throw new Error('Base de datos no disponible');
  
  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query(sql, params);
    return result;
  } catch (error) {
    throw error;
  } finally {
    // Liberar conexión siempre
    if (connection) {
      connection.release();
    }
  }
}

/**
 * 🆕 Ejecutar query que devuelve filas
 */
async function query(sql, params = []) {
  const pool = getPool();
  if (!pool) return [[], []];
  
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows, fields] = await connection.query(sql, params);
    return [rows, fields];
  } catch (error) {
    console.error('❌ Error en query:', error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * 🆕 Cerrar el pool completamente (para graceful shutdown)
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('🔌 Pool de conexiones cerrado');
  }
}

module.exports = { getPool, initDatabase, executeQuery, query, closePool };