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

function calcularBloqueAsistencia(bloque, cursor, datosVehiculo = {}) {
  const ch3AIdeal = sumarTiempo(cursor, bloque.tiempoHastaIngreso);
  const limiteFlexi = sumarTiempo(ch3AIdeal, bloque.maxFlexi);
  const ch3AReal = datosVehiculo.ch3AReal ?? '';
  const ch3BReal = datosVehiculo.ch3BReal ?? '';
  const baseServicio = ch3AReal || ch3BReal || ch3AIdeal;
  const ch3CIdeal = sumarTiempo(baseServicio, bloque.maxAsistencia);
  const ch3DIdeal = sumarTiempo(ch3CIdeal, bloque.maxParqueCerrado);

  return {
    cursorFinal: ch3DIdeal,
    filas: [
      {
        id: `${bloque.id}-a`,
        punto: `CH${bloque.baseNumero}A`,
        tipo: 'CH',
        horario: ch3AIdeal,
        regla: `Entrada flexi opcional. Puede entrar antes; si usa flexi no puede pasar de ${limiteFlexi}.`,
      },
      {
        id: `${bloque.id}-b`,
        punto: `CH${bloque.baseNumero}B`,
        tipo: 'CH',
        horario: ch3AIdeal,
        regla: 'Entrada sin flexi. Comparte el mismo ideal que CHA.',
      },
      {
        id: `${bloque.id}-c`,
        punto: `CH${bloque.baseNumero}C`,
        tipo: 'CH',
        horario: ch3CIdeal,
        regla: `Salida de asistencia. Se calcula con la hora real elegida + ${bloque.maxAsistencia}.`,
      },
      {
        id: `${bloque.id}-d`,
        punto: `CH${bloque.baseNumero}D`,
        tipo: 'CH',
        horario: ch3DIdeal,
        regla: bloque.noPenalizaAdelantoEnSalida
          ? `Salida de parque cerrado. Permite adelanto y suma ${bloque.maxParqueCerrado} a CHC ideal.`
          : `Salida de parque cerrado. Debe cumplirse exacto y suma ${bloque.maxParqueCerrado} a CHC ideal.`,
      },
    ],
  };
}

export function calcularProyeccionItinerario({
  horaBaseCh0,
  definiciones,
  datosVehiculo = {},
}) {
  const filas = [];
  let cursor = horaBaseCh0;

  definiciones.forEach((item) => {
    if (item.tipo === 'CH') {
      filas.push({
        id: item.id,
        punto: item.nombreBase,
        tipo: item.tipo,
        horario: cursor,
        regla: item.nombreBase === 'CH0'
          ? `Base manual de largada. Desde aca se suma ${item.tiempoOtorgado} para obtener el siguiente control.`
          : `Control horario. Desde aca se otorgan ${item.tiempoOtorgado} hasta el siguiente punto.`,
      });

      cursor = sumarTiempo(cursor, item.tiempoOtorgado);
      return;
    }

    if (item.tipo === 'PE') {
      const largadaPE = sumarTiempo(cursor, item.tiempoDesdeAnterior);

      filas.push({
        id: item.id,
        punto: item.nombreBase,
        tipo: item.tipo,
        horario: largadaPE,
        regla: `Largada proyectada. Desde el PE se otorgan ${item.tiempoOtorgado} para llegar al siguiente CH.`,
      });

      cursor = sumarTiempo(largadaPE, item.tiempoOtorgado);
      return;
    }

    if (item.tipo === 'BLOQUE_ASISTENCIA') {
      const bloqueCalculado = calcularBloqueAsistencia(
        item,
        cursor,
        datosVehiculo[item.id],
      );

      filas.push(...bloqueCalculado.filas);
      cursor = bloqueCalculado.cursorFinal;
    }
  });

  return filas;
}

export function crearEscenarioDemo() {
  const definiciones = [
    crearControlHorario({ numero: 0, tiempoOtorgado: '01:15' }),
    crearControlHorario({ numero: 1, tiempoOtorgado: '00:00' }),
    crearPruebaEspecial({ numero: 1, tiempoDesdeAnterior: '00:03', tiempoOtorgado: '00:25' }),
    crearControlHorario({ numero: 2, tiempoOtorgado: '00:00' }),
    crearPruebaEspecial({ numero: 2, tiempoDesdeAnterior: '00:03', tiempoOtorgado: '00:35' }),
    crearControlHorario({ numero: 3, tiempoOtorgado: '00:00' }),
    crearPruebaEspecial({ numero: 3, tiempoDesdeAnterior: '00:03', tiempoOtorgado: '00:45' }),
    crearBloqueAsistencia({
      baseNumero: '3',
      tiempoHastaIngreso: '00:00',
      maxFlexi: '00:15',
      maxAsistencia: '00:40',
      maxParqueCerrado: '00:10',
      tiempoHastaSiguiente: '00:20',
      noPenalizaAdelantoEnSalida: true,
    }),
    crearControlHorario({ numero: 4, tiempoOtorgado: '00:00' }),
  ];

  const filas = calcularProyeccionItinerario({
    horaBaseCh0: '08:00',
    definiciones,
    datosVehiculo: {
      'bloque-asistencia-3': {
        ch3BReal: '11:09',
      },
    },
  });

  return { definiciones, filas };
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

      valores[columnaAIdeal] = sumarTiempo(salidaAnterior, item.tiempoHastaIngreso) ?? '';
      valores[columnaAReal] = valoresVehiculo[columnaAReal] ?? '';
      valores[columnaBIdeal] = valores[columnaAIdeal];
      valores[columnaBReal] = valoresVehiculo[columnaBReal] ?? '';

      const baseServicio = valores[columnaAReal] || valores[columnaBReal] || valores[columnaAIdeal];
      valores[columnaCIdeal] = sumarTiempo(baseServicio, item.maxAsistencia) ?? '';
      valores[columnaCReal] = valoresVehiculo[columnaCReal] ?? '';
      valores[columnaDIdeal] = sumarTiempo(valores[columnaCIdeal], item.maxParqueCerrado) ?? '';
      valores[columnaDReal] = valoresVehiculo[columnaDReal] ?? '';
    }
  });

  return valores;
}
