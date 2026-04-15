// rtcs/backend/src/controllers/cronograma.ctrl.js
// Lógica de negocio para los puntos del cronograma.
// Cada función recibe (req, res) y ejecuta la query correspondiente contra PostgreSQL.

const pool = require('../../db');

// ── Tipos válidos de puntos del cronograma ─────────────────────────────────
const TIPOS_VALIDOS = ['CH', 'PE', 'FLEXI', 'ASISTENCIA', 'REGRUP'];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cronograma
// Devuelve todos los puntos ordenados por el campo `orden`.
// ─────────────────────────────────────────────────────────────────────────────
const obtenerCronograma = async (_req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT * FROM cronograma ORDER BY orden ASC'
    );
    res.json(resultado.rows);
  } catch (err) {
    console.error('❌ obtenerCronograma:', err.message);
    res.status(500).json({ error: 'Error al obtener el cronograma.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cronograma/:id
// Devuelve un único punto del cronograma por su ID.
// ─────────────────────────────────────────────────────────────────────────────
const obtenerPuntoPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(
      'SELECT * FROM cronograma WHERE id = $1',
      [id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: `No se encontró el punto con ID ${id}.` });
    }
    res.json(resultado.rows[0]);
  } catch (err) {
    console.error('❌ obtenerPuntoPorId:', err.message);
    res.status(500).json({ error: 'Error al obtener el punto.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cronograma
// Crea un nuevo punto en el cronograma.
// Body: { nombre, tipo, tiempo_enlace, no_penaliza_adelanto, orden }
// ─────────────────────────────────────────────────────────────────────────────
const crearPunto = async (req, res) => {
  const {
    nombre,
    tipo,
    tiempo_enlace       = 0,
    no_penaliza_adelanto = false,
    orden,
  } = req.body;

  // Validaciones básicas
  if (!nombre || !tipo || orden === undefined) {
    return res.status(400).json({
      error: 'Los campos nombre, tipo y orden son obligatorios.',
    });
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({
      error: `Tipo inválido. Los valores permitidos son: ${TIPOS_VALIDOS.join(', ')}.`,
    });
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO cronograma (nombre, tipo, tiempo_enlace, no_penaliza_adelanto, orden)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nombre, tipo, tiempo_enlace, no_penaliza_adelanto, orden]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (err) {
    console.error('❌ crearPunto:', err.message);
    res.status(500).json({ error: 'Error al crear el punto del cronograma.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/cronograma/:id
// Actualiza un punto existente del cronograma.
// Solo actualiza los campos que se envíen en el body.
// ─────────────────────────────────────────────────────────────────────────────
const actualizarPunto = async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo, tiempo_enlace, no_penaliza_adelanto, orden } = req.body;

  if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({
      error: `Tipo inválido. Los valores permitidos son: ${TIPOS_VALIDOS.join(', ')}.`,
    });
  }

  try {
    // Verificar que el punto existe
    const existe = await pool.query('SELECT id FROM cronograma WHERE id = $1', [id]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ error: `No se encontró el punto con ID ${id}.` });
    }

    // Construir la query dinámicamente con solo los campos enviados
    const campos  = [];
    const valores = [];
    let indice    = 1;

    if (nombre               !== undefined) { campos.push(`nombre = $${indice++}`);                valores.push(nombre); }
    if (tipo                 !== undefined) { campos.push(`tipo = $${indice++}`);                  valores.push(tipo); }
    if (tiempo_enlace        !== undefined) { campos.push(`tiempo_enlace = $${indice++}`);         valores.push(tiempo_enlace); }
    if (no_penaliza_adelanto !== undefined) { campos.push(`no_penaliza_adelanto = $${indice++}`);  valores.push(no_penaliza_adelanto); }
    if (orden                !== undefined) { campos.push(`orden = $${indice++}`);                 valores.push(orden); }

    if (campos.length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar.' });
    }

    valores.push(id);
    const resultado = await pool.query(
      `UPDATE cronograma SET ${campos.join(', ')} WHERE id = $${indice} RETURNING *`,
      valores
    );
    res.json(resultado.rows[0]);
  } catch (err) {
    console.error('❌ actualizarPunto:', err.message);
    res.status(500).json({ error: 'Error al actualizar el punto.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/cronograma/:id
// Elimina un punto del cronograma por su ID.
// ─────────────────────────────────────────────────────────────────────────────
const eliminarPunto = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(
      'DELETE FROM cronograma WHERE id = $1 RETURNING *',
      [id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: `No se encontró el punto con ID ${id}.` });
    }
    res.json({
      mensaje: `Punto "${resultado.rows[0].nombre}" eliminado correctamente.`,
      eliminado: resultado.rows[0],
    });
  } catch (err) {
    console.error('❌ eliminarPunto:', err.message);
    res.status(500).json({ error: 'Error al eliminar el punto.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/cronograma/reordenar/lote
// Actualiza el campo `orden` de múltiples puntos en una sola transacción.
// Body: [{ id, orden }, { id, orden }, ...]
// Útil cuando el usuario arrastra y suelta filas en la tabla del cronograma.
// ─────────────────────────────────────────────────────────────────────────────
const reordenarPuntos = async (req, res) => {
  const items = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Se esperaba un array de { id, orden }.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const { id, orden } of items) {
      await client.query(
        'UPDATE cronograma SET orden = $1 WHERE id = $2',
        [orden, id]
      );
    }

    await client.query('COMMIT');
    res.json({ mensaje: `${items.length} puntos reordenados correctamente.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ reordenarPuntos:', err.message);
    res.status(500).json({ error: 'Error al reordenar los puntos. Se revirtieron los cambios.' });
  } finally {
    client.release();
  }
};

module.exports = {
  obtenerCronograma,
  obtenerPuntoPorId,
  crearPunto,
  actualizarPunto,
  eliminarPunto,
  reordenarPuntos,
};