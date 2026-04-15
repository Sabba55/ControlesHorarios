// rtcs/backend/index.js
// Punto de entrada del servidor Express.
// Monta todas las rutas de la API y levanta el servidor en el puerto configurado.

const express    = require('express');
const cors       = require('cors');
require('dotenv').config();

// ── Rutas ──────────────────────────────────────────────────────────────────
const cronogramaRoutes = require('./src/routes/cronograma.routes');
const vehiculosRoutes  = require('./src/routes/vehiculos.routes');
const registrosRoutes  = require('./src/routes/registros.routes');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares ────────────────────────────────────────────────────────────
app.use(cors());                  // Permite peticiones desde el frontend (localhost:5173)
app.use(express.json());          // Parsea el body de las requests como JSON

// ── Montaje de rutas ───────────────────────────────────────────────────────
app.use('/api/cronograma', cronogramaRoutes);
app.use('/api/vehiculos',  vehiculosRoutes);
app.use('/api/registros',  registrosRoutes);

// ── Ruta de salud (health check) ───────────────────────────────────────────
app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, mensaje: 'Servidor RTCS funcionando correctamente.' });
});

// ── Manejo de rutas inexistentes ───────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

// ── Manejo global de errores ───────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('❌ Error interno:', err.message);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// ── Inicio del servidor ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Servidor RTCS corriendo en http://localhost:${PORT}`);
});