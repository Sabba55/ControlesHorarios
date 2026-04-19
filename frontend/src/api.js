// frontend/src/api.js
// Capa de acceso al backend RTCS.
// Todas las llamadas HTTP están acá. El resto del frontend solo importa estas funciones.

const BASE = 'http://localhost:3001/api';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

// ── Vehículos ──────────────────────────────────────────────────────────────

export const api = {
  // Devuelve todos los vehículos ordenados por número
  vehiculos: {
    listar: () => request('GET', '/vehiculos'),

    // Crea un lote de vehículos; body: [{ numero, piloto, navegante, categoria }]
    cargaMasiva: (lista) => request('POST', '/vehiculos/carga-masiva/lote', lista),

    // Elimina un vehículo y sus registros de tiempo
    eliminar: (numero) => request('DELETE', `/vehiculos/${numero}`),

    // Elimina TODOS los vehículos y reinicia la competencia
    eliminarTodos: () => request('DELETE', '/vehiculos'),
  },

  // ── Cronograma ─────────────────────────────────────────────────────────

  cronograma: {
    // Devuelve todos los puntos ordenados por `orden`
    listar: () => request('GET', '/cronograma'),

    // Crea un punto; body: { nombre, tipo, tiempo_enlace, no_penaliza_adelanto, orden }
    crear: (punto) => request('POST', '/cronograma', punto),

    // Elimina un punto por ID
    eliminar: (id) => request('DELETE', `/cronograma/${id}`),

    // Reemplaza todo el cronograma: borra todos los puntos y crea los nuevos
    sincronizar: async (puntos) => {
      // Un solo DELETE limpia todo el cronograma de una vez
      await request('DELETE', '/cronograma');
      // Luego insertamos los nuevos en orden
      const creados = [];
      for (const p of puntos) {
        const creado = await request('POST', '/cronograma', p);
        creados.push(creado);
      }
      return creados;
    },
  },

  // ── Registros de tiempos ───────────────────────────────────────────────

  registros: {
    // Devuelve la grilla estructurada por vehículo
    grilla: () => request('GET', '/registros/grilla'),

    // Genera los registros vacíos para todos los pares vehiculo × punto
    inicializar: () => request('POST', '/registros/inicializar'),

    // Guarda la hora_real de un punto y dispara cascada horizontal
    guardarHoraReal: (vehiculo_id, cronograma_id, hora_real) =>
      request('PUT', '/registros/hora-real', { vehiculo_id, cronograma_id, hora_real }),

    // Actualiza manualmente la hora_ideal (con cascada vertical opcional)
    guardarHoraIdeal: (vehiculo_id, cronograma_id, hora_ideal, propagar_offset = false) =>
      request('PUT', '/registros/hora-ideal', { vehiculo_id, cronograma_id, hora_ideal, propagar_offset }),

    // Limpia solo la tabla de registros
    limpiar: () => request('DELETE', '/registros'),

    // Aplica tiempo extra (minutos) desde un CH en adelante, para el vehículo y los posteriores
    aplicarTiempoExtra: (vehiculo_id, cronograma_id, minutos_extra) =>
      request('PUT', '/registros/tiempo-extra', { vehiculo_id, cronograma_id, minutos_extra }),
  },
};