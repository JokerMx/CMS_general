require('dotenv').config();
const mysql = require('mysql2/promise');

async function test() {
  console.log('Probando conexión...');
  console.log('Host:', process.env.DB_HOST);
  console.log('User:', process.env.DB_USER);
  console.log('DB:', process.env.DB_NAME);
  
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      connectTimeout: 100000
    });
    console.log('✅ CONECTADO');
    const [rows] = await conn.query('SELECT 1+1 AS r');
    console.log('Query:', rows[0].r);
    await conn.end();
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Código:', error.code);
  }
}

test();