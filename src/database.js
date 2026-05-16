const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuración de conexión (sin base de datos específica para poder crearla)
const initConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const dbName = process.env.DB_NAME || 'devcraft_studio';

// Pool con la base de datos ya seleccionada
let pool = null;

/**
 * Inicializa la base de datos creándola si no existe
 */
async function initDatabase() {
  let connection;
  try {
    // 1. Conectar sin especificar base de datos
    console.log(`🔌 Conectando a MariaDB en ${initConfig.host}:${initConfig.port}...`);
    connection = await mysql.createConnection(initConfig);
    console.log('✅ Conexión a MariaDB establecida');

    // 2. Crear base de datos si no existe
    console.log(`📦 Verificando base de datos "${dbName}"...`);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`✅ Base de datos "${dbName}" lista`);

    // 3. Usar la base de datos
    await connection.query(`USE \`${dbName}\``);

    // 4. Crear tablas si no existen
    console.log('📋 Creando tablas...');

    // Tabla de usuarios
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100),
        plan VARCHAR(20) DEFAULT 'free',
        selected_projects JSON DEFAULT NULL,
        theme VARCHAR(10) DEFAULT 'light',
        avatar_url VARCHAR(255) DEFAULT NULL,
        github_username VARCHAR(50) DEFAULT NULL,
        github_token VARCHAR(255) DEFAULT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_username (username),
        INDEX idx_plan (plan)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ Tabla "users" lista');

    // Tabla de sesiones
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(128) PRIMARY KEY,
        expires INT UNSIGNED NOT NULL,
        data TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ Tabla "sessions" lista');
    // Tabla de configuración por usuario (NUEVA)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        config_key VARCHAR(100) NOT NULL,
        config_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_config (user_id, config_key),
        INDEX idx_user_id (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ Tabla "config" lista');


    console.log('✅ Base de datos inicializada correctamente\n');

    // 5. Cerrar conexión temporal
    await connection.end();

    // 6. Crear el pool con la base de datos seleccionada
    pool = mysql.createPool({
      ...initConfig,
      database: dbName
    });

    return true;
  } catch (error) {
    console.error('\n❌ Error al inicializar la base de datos:');
    console.error(`   ${error.message}\n`);
    console.error('   Verifica que:');
    console.error('   1. MariaDB esté instalado y corriendo');
    console.error('   2. Las credenciales en .env sean correctas');
    console.error('   3. El puerto 3306 esté accesible\n');
    return false;
  }
}

/**
 * Obtiene el pool de conexiones (inicializado o null)
 */
function getPool() {
  return pool;
}

module.exports = { getPool, initDatabase };