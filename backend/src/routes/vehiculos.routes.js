// rtcs/backend/src/routes/vehiculos.routes.js
// Define los endpoints REST para gestionar los vehículos de la competencia.
// Cada ruta delega la lógica al controlador correspondiente.

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/vehiculos.ctrl');

// ── GET /api/vehiculos ─────────────────────────────────────────────────────
// Devuelve todos los vehículos ordenados por número de competidor.
router.get('/', ctrl.obtenerVehiculos);

// ── GET /api/vehiculos/:numero ─────────────────────────────────────────────
// Devuelve un único vehículo por su número de competidor.
router.get('/:numero', ctrl.obtenerVehiculoPorNumero);

// ── POST /api/vehiculos ────────────────────────────────────────────────────
// Crea un nuevo vehículo.
// Body esperado: { numero, piloto, navegante, categoria }
router.post('/', ctrl.crearVehiculo);

// ── POST /api/vehiculos/carga-masiva ──────────────────────────────────────
// Crea múltiples vehículos de una sola vez (pegado desde portapapeles).
// Body esperado: [{ numero, piloto, navegante, categoria }, ...]
router.post('/carga-masiva/lote', ctrl.cargaMasiva);

// ── PUT /api/vehiculos/:numero ─────────────────────────────────────────────
// Actualiza los datos de un vehículo existente.
// Body esperado: cualquier combinación de { piloto, navegante, categoria }
router.put('/:numero', ctrl.actualizarVehiculo);

// ── DELETE /api/vehiculos/:numero ──────────────────────────────────────────
// Elimina un vehículo por su número de competidor.
router.delete('/:numero', ctrl.eliminarVehiculo);

// ── DELETE /api/vehiculos ──────────────────────────────────────────────────
// Elimina TODOS los vehículos y sus registros asociados.
// Usado por el botón global de reinicio de competencia.
router.delete('/', ctrl.eliminarTodosLosVehiculos);

module.exports = router;