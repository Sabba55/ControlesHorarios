import { sumarTiempo } from './time.js';

export function crearControlHorario({
  numero,
  letra = '',
  tiempoOtorgado = '00:00',
  noPenalizaAdelanto = false,
}) {
  const sufijo = letra.trim().toUpperCase();
  const nombreBase = `CH${numero}${sufijo}`;

  return {
    id: `ch-${numero}${sufijo.toLowerCase() || 'base'}`,
    tipo: 'CH',
    numero: Number(numero),
    letra: sufijo,
    nombreBase,
    tiempoOtorgado,
    noPenalizaAdelanto,
  };
}

export function crearPruebaEspecial({
  numero,
  tiempoDesdeAnterior = '00:03',
  tiempoOtorgado = '00:00',
}) {
  return {
    id: `pe-${numero}`,
    tipo: 'PE',
    numero: Number(numero),
    nombreBase: `PE${numero}`,
    tiempoDesdeAnterior,
    tiempoOtorgado,
  };
}

export function crearBloqueAsistencia({
  baseNumero,
  tiempoHastaIngreso = '00:00',
  maxFlexi = '00:00',
  maxAsistencia = '00:00',
  maxParqueCerrado = '00:00',
  tiempoHastaSiguiente = '00:00',
  noPenalizaAdelantoEnSalida = false,
}) {
  return {
    id: `bloque-asistencia-${baseNumero}`,
    tipo: 'BLOQUE_ASISTENCIA',
    baseNumero: String(baseNumero),
    tiempoHastaIngreso,
    maxFlexi,
    maxAsistencia,
    maxParqueCerrado,
    tiempoHastaSiguiente,
    noPenalizaAdelantoEnSalida,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Devuelve la hora de SALIDA de un item dado sus valores calculados.
// Esta hora es la base para calcular el ideal del item siguiente.
// ─────────────────────────────────────────────────────────────────────────────
function obtenerSalidaItem(item, indice, valores) {
  const baseId = `${item.id}-${indice}`;

  if (item.tipo === 'CH') {
    const columnaIdeal = `${baseId}-ideal`;
    // La salida de un CH es su hora ideal + su tiempoOtorgado.
    // Si tiempoOtorgado es '00:00' (CH que sigue a un PE), la salida
    // real la maneja el PE siguiente con su tiempoDesdeAnterior.
    return sumarTiempo(valores[columnaIdeal] ?? '', item.tiempoOtorgado) ?? '';
  }

  if (item.tipo === 'PE') {
    // La salida del PE = hora proyectada (largada) + tiempoOtorgado (hasta el CH siguiente)
    const columnaPe = `${baseId}-proyectada`;
    return sumarTiempo(valores[columnaPe] ?? '', item.tiempoOtorgado) ?? '';
  }

  if (item.tipo === 'BLOQUE_ASISTENCIA') {
    const columnaDIdeal = `${baseId}-d-ideal`;
    return sumarTiempo(valores[columnaDIdeal] ?? '', item.tiempoHastaSiguiente) ?? '';
  }

  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Calcula todos los valores de la planilla para un vehículo dado.
// Recibe el itinerario completo y los valores manuales ingresados (reales + CH0 ideal).
// Devuelve un mapa { columnaId → valor calculado }.
// ─────────────────────────────────────────────────────────────────────────────
export function calcularPlanillaVehiculo(itinerario, valoresVehiculo = {}) {
  const valores = {};

  itinerario.forEach((item, indice) => {
    const itemAnterior   = indice > 0 ? itinerario[indice - 1] : null;
    const baseColumnaId  = `${item.id}-${indice}`;
    const salidaAnterior = itemAnterior
      ? obtenerSalidaItem(itemAnterior, indice - 1, valores)
      : '';

    // ── CH ────────────────────────────────────────────────────────────────
    if (item.tipo === 'CH') {
      const columnaIdeal = `${baseColumnaId}-ideal`;
      const columnaReal  = `${baseColumnaId}-real`;

      if (indice === 0) {
        // CH0: el ideal es manual
        valores[columnaIdeal] = valoresVehiculo[columnaIdeal] ?? '';
      } else if (itemAnterior?.tipo === 'PE') {
        // CH que sigue a un PE: su ideal = salida del PE
        // (salida del PE ya incluye tiempoOtorgado del PE)
        valores[columnaIdeal] = salidaAnterior;
      } else {
        // CH normal: su ideal = salida del item anterior
        valores[columnaIdeal] = salidaAnterior;
      }

      valores[columnaReal] = valoresVehiculo[columnaReal] ?? '';
      return;
    }

    // ── PE ────────────────────────────────────────────────────────────────
    if (item.tipo === 'PE') {
      const columnaPe = `${baseColumnaId}-proyectada`;
      // Proyectada = salida del CH anterior + tiempoDesdeAnterior (trayecto CH → largada PE)
      valores[columnaPe] = sumarTiempo(salidaAnterior, item.tiempoDesdeAnterior) ?? '';
      return;
    }

    // ── BLOQUE_ASISTENCIA ─────────────────────────────────────────────────
    if (item.tipo === 'BLOQUE_ASISTENCIA') {
      const columnaAIdeal = `${baseColumnaId}-a-ideal`;
      const columnaAReal  = `${baseColumnaId}-a-real`;
      const columnaBIdeal = `${baseColumnaId}-b-ideal`;
      const columnaBReal  = `${baseColumnaId}-b-real`;
      const columnaCIdeal = `${baseColumnaId}-c-ideal`;
      const columnaCReal  = `${baseColumnaId}-c-real`;
      const columnaDIdeal = `${baseColumnaId}-d-ideal`;
      const columnaDReal  = `${baseColumnaId}-d-real`;

      // CH#A ideal — calculado desde el punto anterior
      valores[columnaAIdeal] = sumarTiempo(salidaAnterior, item.tiempoHastaIngreso) ?? '';

      // CH#A real — solo si el piloto usa flexi
      valores[columnaAReal] = valoresVehiculo[columnaAReal] ?? '';

      const hayFlexi = Boolean(valores[columnaAReal]);

      // CH#B ideal:
      // sin flexi → mismo que CH#A ideal
      // con flexi → CH#A ideal + maxFlexi
      valores[columnaBIdeal] = hayFlexi
        ? sumarTiempo(valores[columnaAIdeal], item.maxFlexi) ?? ''
        : valores[columnaAIdeal];

      valores[columnaBReal] = valoresVehiculo[columnaBReal] ?? '';

      // CH#C ideal = base (CH#B real si existe, sino CH#B ideal) + maxAsistencia
      const baseParaC = valores[columnaBReal] || valores[columnaBIdeal];
      valores[columnaCIdeal] = sumarTiempo(baseParaC, item.maxAsistencia) ?? '';

      valores[columnaCReal] = valoresVehiculo[columnaCReal] ?? '';

      // CH#D ideal:
      // sin flexi → CH#C ideal + maxParqueCerrado
      // con flexi → CH#A ideal + maxAsistencia + maxParqueCerrado
      if (hayFlexi) {
        const baseD = sumarTiempo(valores[columnaAIdeal], item.maxAsistencia) ?? '';
        valores[columnaDIdeal] = sumarTiempo(baseD, item.maxParqueCerrado) ?? '';
      } else {
        valores[columnaDIdeal] = sumarTiempo(valores[columnaCIdeal], item.maxParqueCerrado) ?? '';
      }

      valores[columnaDReal] = valoresVehiculo[columnaDReal] ?? '';
    }
  });

  return valores;
}