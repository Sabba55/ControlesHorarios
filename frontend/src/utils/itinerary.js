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

function obtenerSalidaItem(item, indice, valores) {
  const baseId = `${item.id}-${indice}`;

  if (item.tipo === 'CH') {
    const columnaIdeal = `${baseId}-ideal`;
    return sumarTiempo(valores[columnaIdeal] ?? '', item.tiempoOtorgado) ?? '';
  }

  if (item.tipo === 'PE') {
    const columnaPe = `${baseId}-proyectada`;
    return sumarTiempo(valores[columnaPe] ?? '', item.tiempoOtorgado) ?? '';
  }

  if (item.tipo === 'BLOQUE_ASISTENCIA') {
    const columnaDIdeal = `${baseId}-d-ideal`;
    return sumarTiempo(valores[columnaDIdeal] ?? '', item.tiempoHastaSiguiente) ?? '';
  }

  return '';
}

export function calcularPlanillaVehiculo(itinerario, valoresVehiculo = {}) {
  const valores = {};

  itinerario.forEach((item, indice) => {
    const itemAnterior = indice > 0 ? itinerario[indice - 1] : null;
    const baseColumnaId = `${item.id}-${indice}`;
    const salidaAnterior = itemAnterior
      ? obtenerSalidaItem(itemAnterior, indice - 1, valores)
      : '';

    if (item.tipo === 'CH') {
      const columnaIdeal = `${baseColumnaId}-ideal`;
      const columnaReal = `${baseColumnaId}-real`;

      if (indice === 0) {
        valores[columnaIdeal] = valoresVehiculo[columnaIdeal] ?? '';
      } else {
        valores[columnaIdeal] = salidaAnterior;
      }

      valores[columnaReal] = valoresVehiculo[columnaReal] ?? '';
      return;
    }

    if (item.tipo === 'PE') {
      const columnaPe = `${baseColumnaId}-proyectada`;
      valores[columnaPe] = sumarTiempo(salidaAnterior, item.tiempoDesdeAnterior) ?? '';
      return;
    }

    if (item.tipo === 'BLOQUE_ASISTENCIA') {
      const columnaAIdeal = `${baseColumnaId}-a-ideal`;
      const columnaAReal = `${baseColumnaId}-a-real`;
      const columnaBIdeal = `${baseColumnaId}-b-ideal`;
      const columnaBReal = `${baseColumnaId}-b-real`;
      const columnaCIdeal = `${baseColumnaId}-c-ideal`;
      const columnaCReal = `${baseColumnaId}-c-real`;
      const columnaDIdeal = `${baseColumnaId}-d-ideal`;
      const columnaDReal = `${baseColumnaId}-d-real`;

      // CH#A ideal — calculado desde el punto anterior
      valores[columnaAIdeal] = sumarTiempo(salidaAnterior, item.tiempoHastaIngreso) ?? '';

      // CH#A real — solo si el piloto usa flexi. Se bloquea en UI si CH#B real tiene valor
      valores[columnaAReal] = valoresVehiculo[columnaAReal] ?? '';

      // ¿Hubo flexi? Solo si CH#A real tiene valor cargado
      const hayFlexi = Boolean(valores[columnaAReal]);

      // CH#B ideal:
      // sin flexi → mismo horario que CH#A ideal
      // con flexi → CH#A ideal + maxFlexi (horario máximo al que puede llegar)
      valores[columnaBIdeal] = hayFlexi
        ? sumarTiempo(valores[columnaAIdeal], item.maxFlexi) ?? ''
        : valores[columnaAIdeal];

      // CH#B real — siempre editable
      valores[columnaBReal] = valoresVehiculo[columnaBReal] ?? '';

      // CH#C ideal:
      // base = CH#B real si existe, sino CH#B ideal
      // CH#C ideal = base + maxAsistencia
      const baseParaC = valores[columnaBReal] || valores[columnaBIdeal];
      valores[columnaCIdeal] = sumarTiempo(baseParaC, item.maxAsistencia) ?? '';

      // CH#C real — editable, validacion visual si difiere del ideal
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

      // CH#D real — editable, validacion visual si difiere del ideal
      valores[columnaDReal] = valoresVehiculo[columnaDReal] ?? '';
    }
  });

  return valores;
}