// rtcs/backend/db.js
// Conexión central a PostgreSQL usando el pool de pg.
// Todos los controladores importan este módulo para hacer queries.

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'rtcs_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// Verificación de conexión al iniciar
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error al conectar con PostgreSQL:', err.message);
    return;
  }
  release();
  console.log('✅ Conexión a PostgreSQL establecida correctamente.');
});

module.exports = pool;