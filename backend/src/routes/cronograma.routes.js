// rtcs/backend/src/routes/cronograma.routes.js
// Define los endpoints REST para gestionar el cronograma (itinerario de la competencia).
// Cada ruta delega la lógica al controlador correspondiente.

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/cronograma.ctrl');

// ── GET /api/cronograma ────────────────────────────────────────────────────
// Devuelve todos los puntos del cronograma ordenados por su campo `orden`.
router.get('/', ctrl.obtenerCronograma);

// ── GET /api/cronograma/:id ────────────────────────────────────────────────
// Devuelve un único punto del cronograma por su ID.
router.get('/:id', ctrl.obtenerPuntoPorId);

// ── POST /api/cronograma ───────────────────────────────────────────────────
// Crea un nuevo punto en el cronograma (CH, PE, FLEXI, ASISTENCIA, REGRUP).
// Body esperado: { nombre, tipo, tiempo_enlace, no_penaliza_adelanto, orden }
router.post('/', ctrl.crearPunto);

// ── PUT /api/cronograma/:id ────────────────────────────────────────────────
// Actualiza los datos de un punto existente del cronograma.
// Body esperado: cualquier combinación de los campos de la tabla cronograma.
router.put('/:id', ctrl.actualizarPunto);

// ── DELETE /api/cronograma/:id ─────────────────────────────────────────────
// Elimina un punto del cronograma por su ID.
router.delete('/:id', ctrl.eliminarPunto);

// ── PUT /api/cronograma/reordenar ──────────────────────────────────────────
// Actualiza el campo `orden` de múltiples puntos en una sola operación.
// Body esperado: [{ id, orden }, { id, orden }, ...]
router.put('/reordenar/lote', ctrl.reordenarPuntos);

router.delete('/',                ctrl.eliminarTodoElCronograma);

module.exports = router;