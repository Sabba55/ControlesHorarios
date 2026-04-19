// rtcs/backend/src/controllers/cronograma.ctrl.js
const pool = require('../../db');

const TIPOS_VALIDOS = ['CH', 'PE', 'FLEXI', 'ASISTENCIA', 'REGRUP'];

const obtenerCronograma = async (_req, res) => {
  try {
    const resultado = await pool.query('SELECT * FROM cronograma ORDER BY orden ASC');
    res.json(resultado.rows);
  } catch (err) {
    console.error('❌ obtenerCronograma:', err.message);
    res.status(500).json({ error: 'Error al obtener el cronograma.' });
  }
};

const obtenerPuntoPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query('SELECT * FROM cronograma WHERE id = $1', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: `No se encontró el punto con ID ${id}.` });
    }
    res.json(resultado.rows[0]);
  } catch (err) {
    console.error('❌ obtenerPuntoPorId:', err.message);
    res.status(500).json({ error: 'Error al obtener el punto.' });
  }
};

const crearPunto = async (req, res) => {
  const {
    nombre,
    tipo,
    tiempo_enlace       = 0,
    no_penaliza_adelanto = false,
    orden,
  } = req.body;

  if (!nombre || !tipo || orden === undefined) {
    return res.status(400).json({ error: 'Los campos nombre, tipo y orden son obligatorios.' });
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({
      error: `Tipo inválido. Los valores permitidos son: ${TIPOS_VALIDOS.join(', ')}.`,
    });
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO cronograma (nombre, tipo, tiempo_enlace, no_penaliza_adelanto, orden)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, tipo, tiempo_enlace, no_penaliza_adelanto, orden]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (err) {
    console.error('❌ crearPunto:', err.message);
    res.status(500).json({ error: 'Error al crear el punto del cronograma.' });
  }
};

const actualizarPunto = async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo, tiempo_enlace, no_penaliza_adelanto, orden } = req.body;

  if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({
      error: `Tipo inválido. Los valores permitidos son: ${TIPOS_VALIDOS.join(', ')}.`,
    });
  }

  try {
    const existe = await pool.query('SELECT id FROM cronograma WHERE id = $1', [id]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ error: `No se encontró el punto con ID ${id}.` });
    }

    const campos  = [];
    const valores = [];
    let indice    = 1;

    if (nombre               !== undefined) { campos.push(`nombre = $${indice++}`);               valores.push(nombre); }
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
// DELETE /api/cronograma
// Elimina TODOS los puntos del cronograma.
// Los registros_tiempos se borran en cascada por la FK con ON DELETE CASCADE.
// ─────────────────────────────────────────────────────────────────────────────
const eliminarTodoElCronograma = async (_req, res) => {
  try {
    await pool.query('DELETE FROM cronograma');
    res.json({ mensaje: 'Cronograma limpiado correctamente.' });
  } catch (err) {
    console.error('❌ eliminarTodoElCronograma:', err.message);
    res.status(500).json({ error: 'Error al limpiar el cronograma.' });
  }
};

const reordenarPuntos = async (req, res) => {
  const items = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Se esperaba un array de { id, orden }.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { id, orden } of items) {
      await client.query('UPDATE cronograma SET orden = $1 WHERE id = $2', [orden, id]);
    }
    await client.query('COMMIT');
    res.json({ mensaje: `${items.length} puntos reordenados correctamente.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ reordenarPuntos:', err.message);
    res.status(500).json({ error: 'Error al reordenar los puntos.' });
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
  eliminarTodoElCronograma,
  reordenarPuntos,
};