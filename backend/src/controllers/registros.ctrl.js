// rtcs/backend/src/controllers/registros.ctrl.js
const pool  = require('../../db');
const dayjs = require('dayjs');

const FORMATO_HORA = 'HH:mm';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/registros
// ─────────────────────────────────────────────────────────────────────────────
const obtenerTodosLosRegistros = async (_req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        rt.vehiculo_id,
        rt.cronograma_id,
        rt.hora_ideal,
        rt.hora_real,
        v.piloto,
        v.navegante,
        v.categoria,
        c.nombre   AS punto_nombre,
        c.tipo     AS punto_tipo,
        c.orden    AS punto_orden,
        c.no_penaliza_adelanto
      FROM registros_tiempos rt
      JOIN vehiculos  v ON rt.vehiculo_id   = v.numero
      JOIN cronograma c ON rt.cronograma_id = c.id
      ORDER BY v.numero ASC, c.orden ASC
    `);
    res.json(resultado.rows);
  } catch (err) {
    console.error('❌ obtenerTodosLosRegistros:', err.message);
    res.status(500).json({ error: 'Error al obtener los registros.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/registros/vehiculo/:numero
// ─────────────────────────────────────────────────────────────────────────────
const obtenerRegistrosPorVehiculo = async (req, res) => {
  const { numero } = req.params;
  try {
    const resultado = await pool.query(`
      SELECT
        rt.vehiculo_id,
        rt.cronograma_id,
        rt.hora_ideal,
        rt.hora_real,
        c.nombre AS punto_nombre,
        c.tipo   AS punto_tipo,
        c.orden  AS punto_orden,
        c.tiempo_enlace,
        c.no_penaliza_adelanto
      FROM registros_tiempos rt
      JOIN cronograma c ON rt.cronograma_id = c.id
      WHERE rt.vehiculo_id = $1
      ORDER BY c.orden ASC
    `, [numero]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: `No se encontraron registros para el vehículo N° ${numero}.` });
    }
    res.json(resultado.rows);
  } catch (err) {
    console.error('❌ obtenerRegistrosPorVehiculo:', err.message);
    res.status(500).json({ error: 'Error al obtener los registros del vehículo.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/registros/grilla
// ─────────────────────────────────────────────────────────────────────────────
const obtenerGrilla = async (_req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        v.numero,
        v.piloto,
        v.navegante,
        v.categoria,
        rt.cronograma_id,
        rt.hora_ideal,
        rt.hora_real,
        c.nombre             AS punto_nombre,
        c.tipo               AS punto_tipo,
        c.orden              AS punto_orden,
        c.tiempo_enlace,
        c.no_penaliza_adelanto
      FROM vehiculos v
      LEFT JOIN registros_tiempos rt ON rt.vehiculo_id = v.numero
      LEFT JOIN cronograma c         ON rt.cronograma_id = c.id
      ORDER BY v.numero ASC, c.orden ASC
    `);

    const mapa = new Map();
    for (const fila of resultado.rows) {
      if (!mapa.has(fila.numero)) {
        mapa.set(fila.numero, {
          vehiculo: {
            numero:    fila.numero,
            piloto:    fila.piloto,
            navegante: fila.navegante,
            categoria: fila.categoria,
          },
          tiempos: [],
        });
      }
      if (fila.cronograma_id) {
        mapa.get(fila.numero).tiempos.push({
          cronograma_id:        fila.cronograma_id,
          punto_nombre:         fila.punto_nombre,
          punto_tipo:           fila.punto_tipo,
          punto_orden:          fila.punto_orden,
          tiempo_enlace:        fila.tiempo_enlace,
          hora_ideal:           fila.hora_ideal,
          hora_real:            fila.hora_real,
          no_penaliza_adelanto: fila.no_penaliza_adelanto,
        });
      }
    }

    res.json(Array.from(mapa.values()));
  } catch (err) {
    console.error('❌ obtenerGrilla:', err.message);
    res.status(500).json({ error: 'Error al obtener la grilla.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/registros/inicializar
// ─────────────────────────────────────────────────────────────────────────────
const inicializarRegistros = async (_req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const vehiculos  = await client.query('SELECT numero FROM vehiculos ORDER BY numero ASC');
    const cronograma = await client.query('SELECT id FROM cronograma ORDER BY orden ASC');

    if (vehiculos.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No hay vehículos cargados. Cargá los vehículos primero.' });
    }
    if (cronograma.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No hay puntos en el cronograma. Configurá el cronograma primero.' });
    }

    let insertados = 0;
    for (const v of vehiculos.rows) {
      for (const c of cronograma.rows) {
        const resultado = await client.query(
          `INSERT INTO registros_tiempos (vehiculo_id, cronograma_id)
           VALUES ($1, $2)
           ON CONFLICT (vehiculo_id, cronograma_id) DO NOTHING`,
          [v.numero, c.id]
        );
        insertados += resultado.rowCount;
      }
    }

    await client.query('COMMIT');
    res.status(201).json({
      mensaje:   `Grilla inicializada con ${insertados} registro(s).`,
      vehiculos: vehiculos.rows.length,
      puntos:    cronograma.rows.length,
      insertados,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ inicializarRegistros:', err.message);
    res.status(500).json({ error: 'Error al inicializar los registros.' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/registros/hora-real
// ─────────────────────────────────────────────────────────────────────────────
const actualizarHoraReal = async (req, res) => {
  const { vehiculo_id, cronograma_id, hora_real } = req.body;

  if (!vehiculo_id || !cronograma_id) {
    return res.status(400).json({ error: 'vehiculo_id y cronograma_id son obligatorios.' });
  }
  if (hora_real !== null && hora_real !== undefined) {
    if (!esHoraValida(hora_real)) {
      return res.status(400).json({ error: 'Formato de hora inválido. Usá HH:mm.' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE registros_tiempos SET hora_real = $1
       WHERE vehiculo_id = $2 AND cronograma_id = $3`,
      [hora_real || null, vehiculo_id, cronograma_id]
    );

    if (!hora_real) {
      await client.query('COMMIT');
      return res.json({ mensaje: 'Hora real eliminada. Sin recálculo de cascada.' });
    }

    const puntos = await client.query(
      `SELECT c.id, c.orden, c.tipo, c.tiempo_enlace,
              rt.hora_ideal, rt.hora_real
       FROM cronograma c
       LEFT JOIN registros_tiempos rt
             ON rt.cronograma_id = c.id AND rt.vehiculo_id = $1
       ORDER BY c.orden ASC`,
      [vehiculo_id]
    );

    const filas        = puntos.rows;
    const indiceActual = filas.findIndex(f => f.id === parseInt(cronograma_id));

    if (indiceActual === -1 || indiceActual === filas.length - 1) {
      await client.query('COMMIT');
      return res.json({ mensaje: 'Hora real guardada. Es el último punto, sin cascada.' });
    }

    const actualizados  = [];
    const tiposParque   = ['FLEXI', 'ASISTENCIA', 'REGRUP'];

    for (let i = indiceActual + 1; i < filas.length; i++) {
      const puntoAnterior = filas[i - 1];
      const puntoActual   = filas[i];
      let nuevaHoraIdeal;

      if (tiposParque.includes(puntoAnterior.tipo)) {
        const horaRealParque = puntoAnterior.hora_real ||
          (i - 1 === indiceActual ? hora_real : null);
        if (!horaRealParque) break;

        nuevaHoraIdeal = dayjs(`1970-01-01 ${horaRealParque}`, 'YYYY-MM-DD HH:mm')
          .add(puntoActual.tiempo_enlace, 'minute')
          .format(FORMATO_HORA);
      } else {
        const baseHora = puntoAnterior.hora_ideal;
        if (!baseHora) break;

        nuevaHoraIdeal = dayjs(`1970-01-01 ${baseHora}`, 'YYYY-MM-DD HH:mm')
          .add(puntoActual.tiempo_enlace, 'minute')
          .format(FORMATO_HORA);
      }

      await client.query(
        `UPDATE registros_tiempos SET hora_ideal = $1
         WHERE vehiculo_id = $2 AND cronograma_id = $3`,
        [nuevaHoraIdeal, vehiculo_id, puntoActual.id]
      );

      filas[i].hora_ideal = nuevaHoraIdeal;
      actualizados.push({ cronograma_id: puntoActual.id, nueva_hora_ideal: nuevaHoraIdeal });
    }

    await client.query('COMMIT');
    res.json({ mensaje: 'Hora real guardada y cascada horizontal aplicada.', actualizados });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ actualizarHoraReal:', err.message);
    res.status(500).json({ error: 'Error al actualizar la hora real.' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/registros/hora-ideal
// ─────────────────────────────────────────────────────────────────────────────
const actualizarHoraIdeal = async (req, res) => {
  const { vehiculo_id, cronograma_id, hora_ideal, propagar_offset = false } = req.body;

  if (!vehiculo_id || !cronograma_id || !hora_ideal) {
    return res.status(400).json({ error: 'vehiculo_id, cronograma_id y hora_ideal son obligatorios.' });
  }
  if (!esHoraValida(hora_ideal)) {
    return res.status(400).json({ error: 'Formato de hora inválido. Usá HH:mm.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const original = await client.query(
      `SELECT hora_ideal FROM registros_tiempos
       WHERE vehiculo_id = $1 AND cronograma_id = $2`,
      [vehiculo_id, cronograma_id]
    );

    if (original.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Registro no encontrado.' });
    }

    const horaOriginal = original.rows[0].hora_ideal;

    await client.query(
      `UPDATE registros_tiempos SET hora_ideal = $1
       WHERE vehiculo_id = $2 AND cronograma_id = $3`,
      [hora_ideal, vehiculo_id, cronograma_id]
    );

    const propagados = [];

    if (propagar_offset && horaOriginal) {
      const offsetMinutos = calcularOffsetMinutos(horaOriginal, hora_ideal);

      if (offsetMinutos !== 0) {
        const vehiculosPosteriores = await client.query(
          `SELECT numero FROM vehiculos
           WHERE orden_ingreso > (SELECT orden_ingreso FROM vehiculos WHERE numero = $1)
           ORDER BY orden_ingreso ASC`,
          [vehiculo_id]
        );

        for (const v of vehiculosPosteriores.rows) {
          const registroActual = await client.query(
            `SELECT hora_ideal FROM registros_tiempos
             WHERE vehiculo_id = $1 AND cronograma_id = $2`,
            [v.numero, cronograma_id]
          );

          if (registroActual.rows.length === 0 || !registroActual.rows[0].hora_ideal) continue;

          const nuevaHora = dayjs(
            `1970-01-01 ${registroActual.rows[0].hora_ideal}`,
            'YYYY-MM-DD HH:mm'
          )
            .add(offsetMinutos, 'minute')
            .format(FORMATO_HORA);

          await client.query(
            `UPDATE registros_tiempos SET hora_ideal = $1
             WHERE vehiculo_id = $2 AND cronograma_id = $3`,
            [nuevaHora, v.numero, cronograma_id]
          );

          propagados.push({ vehiculo_id: v.numero, nueva_hora_ideal: nuevaHora });
        }
      }
    }

    await client.query('COMMIT');
    res.json({
      mensaje: `Hora ideal actualizada${propagar_offset ? ' con cascada vertical' : ''}.`,
      offset_aplicado_minutos: propagar_offset && horaOriginal
        ? calcularOffsetMinutos(horaOriginal, hora_ideal)
        : 0,
      propagados,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ actualizarHoraIdeal:', err.message);
    res.status(500).json({ error: 'Error al actualizar la hora ideal.' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/registros/tiempo-extra
// Suma minutos_extra a hora_ideal desde cronograma_id en adelante,
// para vehiculo_id y todos los vehículos con número mayor.
// ─────────────────────────────────────────────────────────────────────────────
const aplicarTiempoExtra = async (req, res) => {
  const { vehiculo_id, cronograma_id, minutos_extra } = req.body;

  if (!vehiculo_id || !cronograma_id || minutos_extra === undefined) {
    return res.status(400).json({
      error: 'vehiculo_id, cronograma_id y minutos_extra son obligatorios.',
    });
  }

  const minutos = Number(minutos_extra);
  if (isNaN(minutos) || minutos === 0) {
    return res.status(400).json({ error: 'minutos_extra debe ser un número distinto de cero.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Orden del punto desde donde aplicar
    const puntoRes = await client.query(
      'SELECT orden FROM cronograma WHERE id = $1',
      [cronograma_id]
    );
    if (puntoRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `No se encontró el punto con ID ${cronograma_id}.` });
    }
    const ordenDesde = puntoRes.rows[0].orden;

    // Todos los puntos desde ese orden en adelante
    const puntosRes = await client.query(
      'SELECT id FROM cronograma WHERE orden >= $1 ORDER BY orden ASC',
      [ordenDesde]
    );
    const puntosIds = puntosRes.rows.map(r => r.id);

    if (puntosIds.length === 0) {
      await client.query('ROLLBACK');
      return res.json({ mensaje: 'No hay puntos para actualizar desde ese CH.', actualizados: 0 });
    }

    // Todos los vehículos desde vehiculo_id en adelante según orden de ingreso
    const vehiculosRes = await client.query(
      `SELECT numero FROM vehiculos
       WHERE orden_ingreso >= (SELECT orden_ingreso FROM vehiculos WHERE numero = $1)
       ORDER BY orden_ingreso ASC`,
      [vehiculo_id]
    );
    const vehiculosIds = vehiculosRes.rows.map(r => r.numero);

    if (vehiculosIds.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `No se encontró el vehículo N° ${vehiculo_id}.` });
    }

    // Sumar minutos a cada hora_ideal existente
    let actualizados = 0;
    for (const vid of vehiculosIds) {
      for (const pid of puntosIds) {
        const reg = await client.query(
          'SELECT hora_ideal FROM registros_tiempos WHERE vehiculo_id = $1 AND cronograma_id = $2',
          [vid, pid]
        );
        if (reg.rows.length === 0 || !reg.rows[0].hora_ideal) continue;

        const horaActual = reg.rows[0].hora_ideal.slice(0, 5);
        const nuevaHora = dayjs(`1970-01-01 ${horaActual}`, 'YYYY-MM-DD HH:mm')
          .add(minutos, 'minute')
          .format(FORMATO_HORA);

        await client.query(
          `UPDATE registros_tiempos SET hora_ideal = $1
           WHERE vehiculo_id = $2 AND cronograma_id = $3`,
          [nuevaHora, vid, pid]
        );
        actualizados++;
      }
    }

    await client.query('COMMIT');
    res.json({
      mensaje: `Tiempo extra de ${minutos} min aplicado desde CH ID ${cronograma_id} en adelante.`,
      vehiculos_afectados: vehiculosIds.length,
      puntos_afectados:    puntosIds.length,
      actualizados,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ aplicarTiempoExtra:', err.message);
    res.status(500).json({ error: 'Error al aplicar el tiempo extra.' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/registros
// ─────────────────────────────────────────────────────────────────────────────
const limpiarRegistros = async (_req, res) => {
  try {
    await pool.query('DELETE FROM registros_tiempos');
    res.json({ mensaje: 'Tabla de registros limpiada correctamente.' });
  } catch (err) {
    console.error('❌ limpiarRegistros:', err.message);
    res.status(500).json({ error: 'Error al limpiar los registros.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const esHoraValida = (hora) => /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);

const calcularOffsetMinutos = (horaOriginal, horaNueva) => {
  const base  = dayjs(`1970-01-01 ${horaOriginal}`, 'YYYY-MM-DD HH:mm');
  const nueva = dayjs(`1970-01-01 ${horaNueva}`,    'YYYY-MM-DD HH:mm');
  return nueva.diff(base, 'minute');
};

module.exports = {
  obtenerTodosLosRegistros,
  obtenerRegistrosPorVehiculo,
  obtenerGrilla,
  inicializarRegistros,
  actualizarHoraReal,
  actualizarHoraIdeal,
  limpiarRegistros,
  aplicarTiempoExtra,
};