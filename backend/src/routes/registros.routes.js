// rtcs/backend/src/routes/registros.routes.js
// Define los endpoints REST para gestionar los registros de tiempos.
// Es el módulo más crítico: maneja hora_ideal, hora_real y el efecto cascada.

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/registros.ctrl');

// ── GET /api/registros ─────────────────────────────────────────────────────
// Devuelve todos los registros con datos de vehículo y cronograma unidos.
// Es la query principal que alimenta la grilla completa.
router.get('/', ctrl.obtenerTodosLosRegistros);

// ── GET /api/registros/vehiculo/:numero ────────────────────────────────────
// Devuelve todos los registros de un vehículo específico, ordenados por
// el campo `orden` del cronograma. Útil para ver la fila completa de un auto.
router.get('/vehiculo/:numero', ctrl.obtenerRegistrosPorVehiculo);

// ── GET /api/registros/grilla ──────────────────────────────────────────────
// Devuelve la grilla completa estructurada como:
// { vehiculo, cronograma_id, hora_ideal, hora_real }
// Optimizada para el renderizado de la tabla tipo Excel del frontend.
router.get('/grilla', ctrl.obtenerGrilla);

// ── POST /api/registros/inicializar ───────────────────────────────────────
// Genera los registros vacíos (hora_ideal e hora_real = NULL) para todos
// los vehículos × todos los puntos del cronograma.
// Se llama una vez al comenzar la competencia, después de cargar vehículos.
router.post('/inicializar', ctrl.inicializarRegistros);

// ── PUT /api/registros/hora-real ──────────────────────────────────────────
// Actualiza la hora_real de un registro puntual y recalcula en cascada
// las horas_ideales de los puntos siguientes para ese vehículo.
// Body esperado: { vehiculo_id, cronograma_id, hora_real }
router.put('/hora-real', ctrl.actualizarHoraReal);

// ── PUT /api/registros/hora-ideal ─────────────────────────────────────────
// Actualiza manualmente la hora_ideal de un vehículo en un punto.
// Propaga el offset a todos los vehículos que largan después (cascada vertical).
// Body esperado: { vehiculo_id, cronograma_id, hora_ideal, propagar_offset }
router.put('/hora-ideal', ctrl.actualizarHoraIdeal);

// PUT /api/registros/tiempo-extra
router.put('/tiempo-extra', ctrl.aplicarTiempoExtra);

// ── DELETE /api/registros ──────────────────────────────────────────────────
// Limpia SOLO la tabla registros_tiempos.
// El cronograma y los vehículos se mantienen intactos.
router.delete('/', ctrl.limpiarRegistros);

module.exports = router;