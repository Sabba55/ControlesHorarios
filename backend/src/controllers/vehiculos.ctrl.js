// rtcs/backend/src/controllers/vehiculos.ctrl.js
const pool = require('../../db');

const CATEGORIAS_VALIDAS = ['RC1', 'RC2', 'RC3', 'RC4', 'RC5', 'RCMR', 'COPA RC2', 'GENERAL'];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vehiculos
// Devuelve todos los vehículos ordenados por orden de ingreso.
// ─────────────────────────────────────────────────────────────────────────────
const obtenerVehiculos = async (_req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT * FROM vehiculos ORDER BY orden_ingreso ASC'
    );
    res.json(resultado.rows);
  } catch (err) {
    console.error('❌ obtenerVehiculos:', err.message);
    res.status(500).json({ error: 'Error al obtener los vehículos.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vehiculos/:numero
// ─────────────────────────────────────────────────────────────────────────────
const obtenerVehiculoPorNumero = async (req, res) => {
  const { numero } = req.params;
  try {
    const resultado = await pool.query(
      'SELECT * FROM vehiculos WHERE numero = $1',
      [numero]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: `No se encontró el vehículo N° ${numero}.` });
    }
    res.json(resultado.rows[0]);
  } catch (err) {
    console.error('❌ obtenerVehiculoPorNumero:', err.message);
    res.status(500).json({ error: 'Error al obtener el vehículo.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vehiculos
// ─────────────────────────────────────────────────────────────────────────────
const crearVehiculo = async (req, res) => {
  const { numero, piloto, navegante, categoria } = req.body;

  const error = validarVehiculo({ numero, piloto, navegante, categoria });
  if (error) return res.status(400).json({ error });

  try {
    const resultado = await pool.query(
      `INSERT INTO vehiculos (numero, piloto, navegante, categoria)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [numero, piloto, navegante || null, categoria]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: `Ya existe un vehículo con el número ${numero}.` });
    }
    console.error('❌ crearVehiculo:', err.message);
    res.status(500).json({ error: 'Error al crear el vehículo.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vehiculos/carga-masiva/lote
// Inserta en el orden exacto del array recibido.
// ─────────────────────────────────────────────────────────────────────────────
const cargaMasiva = async (req, res) => {
  const vehiculos = req.body;

  if (!Array.isArray(vehiculos) || vehiculos.length === 0) {
    return res.status(400).json({ error: 'Se esperaba un array de vehículos.' });
  }

  const insertados = [];
  const errores    = [];

  // Pre-validar todos
  const validos = [];
  for (const v of vehiculos) {
    const error = validarVehiculo(v);
    if (error) {
      errores.push({ vehiculo: v, motivo: error });
    } else {
      validos.push(v);
    }
  }

  if (validos.length === 0) {
    return res.status(400).json({ error: 'Ningún vehículo pasó la validación.', errores });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const v of validos) {
      try {
        const resultado = await client.query(
          `INSERT INTO vehiculos (numero, piloto, navegante, categoria)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (numero) DO NOTHING
           RETURNING *`,
          [v.numero, v.piloto, v.navegante || null, v.categoria]
        );

        if (resultado.rows.length > 0) {
          insertados.push(resultado.rows[0]);
        } else {
          errores.push({ vehiculo: v, motivo: `El número ${v.numero} ya existe, se omitió.` });
        }
      } catch (err) {
        errores.push({ vehiculo: v, motivo: err.message });
      }
    }

    await client.query('COMMIT');
    res.status(201).json({
      mensaje:   `${insertados.length} vehículo(s) insertado(s). ${errores.length} omitido(s).`,
      insertados,
      errores,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ cargaMasiva:', err.message);
    res.status(500).json({ error: 'Error en la carga masiva. Se revirtieron todos los cambios.' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/vehiculos/:numero
// ─────────────────────────────────────────────────────────────────────────────
const actualizarVehiculo = async (req, res) => {
  const { numero }                       = req.params;
  const { piloto, navegante, categoria } = req.body;

  try {
    const existe = await pool.query('SELECT numero FROM vehiculos WHERE numero = $1', [numero]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ error: `No se encontró el vehículo N° ${numero}.` });
    }

    const campos  = [];
    const valores = [];
    let indice    = 1;

    if (piloto    !== undefined) { campos.push(`piloto = $${indice++}`);    valores.push(piloto); }
    if (navegante !== undefined) { campos.push(`navegante = $${indice++}`); valores.push(navegante); }
    if (categoria !== undefined) { campos.push(`categoria = $${indice++}`); valores.push(categoria); }

    if (campos.length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar.' });
    }

    valores.push(numero);
    const resultado = await pool.query(
      `UPDATE vehiculos SET ${campos.join(', ')} WHERE numero = $${indice} RETURNING *`,
      valores
    );
    res.json(resultado.rows[0]);
  } catch (err) {
    console.error('❌ actualizarVehiculo:', err.message);
    res.status(500).json({ error: 'Error al actualizar el vehículo.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/vehiculos/:numero
// ─────────────────────────────────────────────────────────────────────────────
const eliminarVehiculo = async (req, res) => {
  const { numero } = req.params;
  const client     = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM registros_tiempos WHERE vehiculo_id = $1', [numero]);
    const resultado = await client.query(
      'DELETE FROM vehiculos WHERE numero = $1 RETURNING *',
      [numero]
    );
    if (resultado.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `No se encontró el vehículo N° ${numero}.` });
    }
    await client.query('COMMIT');
    res.json({
      mensaje:   `Vehículo N° ${numero} eliminado correctamente.`,
      eliminado: resultado.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ eliminarVehiculo:', err.message);
    res.status(500).json({ error: 'Error al eliminar el vehículo.' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/vehiculos
// ─────────────────────────────────────────────────────────────────────────────
const eliminarTodosLosVehiculos = async (_req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM registros_tiempos');
    await client.query('DELETE FROM vehiculos');
    await client.query('COMMIT');
    res.json({ mensaje: 'Todos los vehículos y registros eliminados.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ eliminarTodosLosVehiculos:', err.message);
    res.status(500).json({ error: 'Error al reiniciar la competencia.' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Validación
// ─────────────────────────────────────────────────────────────────────────────
const validarVehiculo = ({ numero, piloto, categoria }) => {
  if (!numero || isNaN(Number(numero)) || Number(numero) <= 0) {
    return 'El número de vehículo debe ser un entero positivo.';
  }
  if (!piloto || piloto.trim().length === 0) {
    return 'El nombre del piloto es obligatorio.';
  }
  if (!categoria || !CATEGORIAS_VALIDAS.includes(categoria)) {
    return `Categoría inválida. Las categorías permitidas son: ${CATEGORIAS_VALIDAS.join(', ')}.`;
  }
  return null;
};

module.exports = {
  obtenerVehiculos,
  obtenerVehiculoPorNumero,
  crearVehiculo,
  cargaMasiva,
  actualizarVehiculo,
  eliminarVehiculo,
  eliminarTodosLosVehiculos,
};