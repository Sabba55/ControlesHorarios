import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useHotkeys } from 'react-hotkeys-hook';
import './App.css';
import ModalCreacionCH from './components/ModalCreacionCH.jsx';
import ModalCreacionPE from './components/ModalCreacionPE.jsx';
import ModalCreacionVehiculo from './components/ModalCreacionVehiculo.jsx';
import ModalZonaTiempo from './components/ModalZonaTiempo.jsx';
import ModalConfirmacion from './components/ModalConfirmacion.jsx';
import ModalTiempoExtra from './components/ModalTiempoExtra.jsx';
import { api } from './api.js';
import {
  calcularPlanillaVehiculo,
  crearBloqueAsistencia,
  crearControlHorario,
  crearPruebaEspecial,
} from './utils/itinerary.js';
import { esTiempoValido, normalizarTiempo } from './utils/time.js';

// ─────────────────────────────────────────────────────────────────────────────
// Convierte el itinerario en memoria al formato plano que espera el backend.
// Cada item del itinerario puede generar uno o varios puntos del cronograma.
// Devuelve: [{ nombre, tipo, tiempo_enlace, no_penaliza_adelanto, orden }, ...]
// ─────────────────────────────────────────────────────────────────────────────
function itinerarioABackend(itinerario) {
  const puntos = [];
  let orden = 1;

  for (let i = 0; i < itinerario.length; i++) {
    const item = itinerario[i];

    if (item.tipo === 'CH') {
      // Si el item anterior fue un PE, el tiempo_enlace de este CH
      // debe ser el tiempoOtorgado del PE (tiempo desde la meta hasta el siguiente CH)
      const itemAnterior = itinerario[i - 1];
      let tiempoEnlace;
      if (itemAnterior?.tipo === 'PE') {
        const [hh, mm] = itemAnterior.tiempoOtorgado.split(':').map(Number);
        tiempoEnlace = hh * 60 + mm;
      } else {
        const [hh, mm] = item.tiempoOtorgado.split(':').map(Number);
        tiempoEnlace = hh * 60 + mm;
      }

      puntos.push({
        nombre: item.nombreBase,
        tipo: 'CH',
        tiempo_enlace: tiempoEnlace,
        no_penaliza_adelanto: item.noPenalizaAdelanto ?? false,
        orden: orden++,
      });
      continue;
    }

    if (item.tipo === 'PE') {
      // tiempo_enlace del PE = tiempoDesdeAnterior (CH anterior → largada PE)
      const [hh1, mm1] = item.tiempoDesdeAnterior.split(':').map(Number);
      puntos.push({
        nombre: item.nombreBase,
        tipo: 'PE',
        tiempo_enlace: hh1 * 60 + mm1,
        no_penaliza_adelanto: false,
        orden: orden++,
      });
      continue;
    }

    if (item.tipo === 'BLOQUE_ASISTENCIA') {
      const n = item.baseNumero;

      const parsear = (t) => {
        const [hh, mm] = (t || '00:00').split(':').map(Number);
        return hh * 60 + mm;
      };

      puntos.push({
        nombre: `CH${n}A`,
        tipo: 'FLEXI',
        tiempo_enlace: parsear(item.tiempoHastaIngreso),
        no_penaliza_adelanto: false,
        orden: orden++,
      });

      puntos.push({
        nombre: `CH${n}B`,
        tipo: 'ASISTENCIA',
        tiempo_enlace: parsear(item.maxFlexi),
        no_penaliza_adelanto: false,
        orden: orden++,
      });

      puntos.push({
        nombre: `CH${n}C`,
        tipo: 'CH',
        tiempo_enlace: parsear(item.maxAsistencia),
        no_penaliza_adelanto: false,
        orden: orden++,
      });

      puntos.push({
        nombre: `CH${n}D`,
        tipo: 'REGRUP',
        tiempo_enlace: parsear(item.maxParqueCerrado),
        no_penaliza_adelanto: item.noPenalizaAdelantoEnSalida ?? false,
        orden: orden++,
      });
    }
  }

  return puntos;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generación de columnas (sin cambios respecto al original)
// ─────────────────────────────────────────────────────────────────────────────
function crearColumnasDesdeItinerario(itinerario) {
  return itinerario.flatMap((item, indice) => {
    if (item.tipo === 'CH') {
      const baseId = `${item.id}-${indice}`;
      return [
        {
          id: `${baseId}-ideal`,
          tipo: 'CH',
          nombreBase: item.nombreBase,
          variante: 'ideal',
          editable: indice === 0,
          // La columna ideal del CH0 necesita su propio idPunto para poder ser editada manualmente
          idPunto: item.nombreBase,
        },
        {
          id: `${baseId}-real`,
          tipo: 'CH',
          nombreBase: item.nombreBase,
          variante: 'real',
          editable: true,
          // Clave de la columna ideal correspondiente para validar igualdad
          validarIgualACH: `${baseId}-ideal`,
          // Si no penaliza adelanto, se permite hora_real < hora_ideal (solo validar llegada tardía)
          noPenalizaAdelanto: item.noPenalizaAdelanto ?? false,
        },
      ];
    }

    if (item.tipo === 'PE') {
      return [
        {
          id: `${item.id}-${indice}-proyectada`,
          tipo: 'PE',
          nombreBase: item.nombreBase,
          variante: 'proyectada',
          editable: false,
        },
      ];
    }

    if (item.tipo === 'BLOQUE_ASISTENCIA') {
      const baseId = `${item.id}-${indice}`;
      const n = item.baseNumero;

      return [
        {
          id: `${baseId}-a-ideal`,
          tipo: 'CH',
          subtipo: 'ZONA_FLEXI',
          nombreBase: `CH${n}A`,
          variante: 'ideal',
          editable: false,
          maxLabel: null,
        },
        {
          id: `${baseId}-a-real`,
          tipo: 'CH',
          subtipo: 'ZONA_FLEXI',
          nombreBase: `CH${n}A`,
          variante: 'real',
          editable: true,
          maxLabelKey: `${baseId}-a-ideal`,
          maxLabelTipo: 'flexi',
          bloqueadoPorKey: `${baseId}-b-real`,
          // Error si llegó DESPUÉS del máximo flexi (real > ideal)
          validarMaximo: `${baseId}-a-ideal`,
        },
        {
          id: `${baseId}-b-ideal`,
          tipo: 'CH',
          subtipo: 'ZONA_ENTRADA',
          nombreBase: `CH${n}B`,
          variante: 'ideal',
          editable: false,
        },
        {
          id: `${baseId}-b-real`,
          tipo: 'CH',
          subtipo: 'ZONA_ENTRADA',
          nombreBase: `CH${n}B`,
          variante: 'real',
          editable: true,
          maxLabelKey: `${baseId}-b-ideal`,
          maxLabelTipo: 'asistencia',
        },
        {
          id: `${baseId}-c-ideal`,
          tipo: 'CH',
          subtipo: 'ZONA_SALIDA',
          nombreBase: `CH${n}C`,
          variante: 'ideal',
          editable: false,
        },
        {
          id: `${baseId}-c-real`,
          tipo: 'CH',
          subtipo: 'ZONA_SALIDA',
          nombreBase: `CH${n}C`,
          variante: 'real',
          editable: true,
          validarIgual: `${baseId}-c-ideal`,
          maxLabelKey: `${baseId}-c-ideal`,
          maxLabelTipo: 'parque',
        },
        {
          id: `${baseId}-d-ideal`,
          tipo: 'CH',
          subtipo: 'ZONA_PARQUE',
          nombreBase: `CH${n}D`,
          variante: 'ideal',
          editable: false,
        },
        {
          id: `${baseId}-d-real`,
          tipo: 'CH',
          subtipo: 'ZONA_PARQUE',
          nombreBase: `CH${n}D`,
          variante: 'real',
          editable: true,
          validarIgual: `${baseId}-d-ideal`,
        },
      ];
    }

    return [];
  });
}

function obtenerTituloColumna(columna) {
  if (columna.tipo === 'PE') return 'PROYECTADA';
  if (columna.variante === 'ideal') {
    if (columna.subtipo) return 'IDEAL AUTO';
    return columna.editable ? 'IDEAL MANUAL' : 'IDEAL AUTO';
  }
  if (columna.maxLabelTipo === 'flexi') return 'MÁX FLEXI / REAL';
  if (columna.maxLabelTipo === 'asistencia') return 'MÁX ASIST / REAL';
  if (columna.maxLabelTipo === 'parque') return 'MÁX PARQUE / REAL';
  return 'REAL';
}

function obtenerClaseEncabezado(columna) {
  if (columna.tipo === 'PE') return 'encabezado-pe';
  const subtipoClase = {
    ZONA_FLEXI: 'encabezado-zona encabezado-zona--flexi',
    ZONA_ENTRADA: 'encabezado-zona encabezado-zona--entrada',
    ZONA_SALIDA: 'encabezado-zona encabezado-zona--salida',
    ZONA_PARQUE: 'encabezado-zona encabezado-zona--parque',
  };
  if (columna.subtipo && subtipoClase[columna.subtipo]) return subtipoClase[columna.subtipo];
  return columna.variante === 'ideal'
    ? 'encabezado-ch encabezado-ch--ideal'
    : 'encabezado-ch encabezado-ch--real';
}

function obtenerClaseCelda(columna) {
  if (columna.tipo === 'PE') return 'celda-rally celda-rally--pe';
  const subtipoClase = {
    ZONA_FLEXI: 'celda-rally celda-rally--zona-flexi',
    ZONA_ENTRADA: 'celda-rally celda-rally--zona-entrada',
    ZONA_SALIDA: 'celda-rally celda-rally--zona-salida',
    ZONA_PARQUE: 'celda-rally celda-rally--zona-parque',
  };
  if (columna.subtipo && subtipoClase[columna.subtipo]) return subtipoClase[columna.subtipo];
  return columna.variante === 'ideal'
    ? 'celda-rally celda-rally--ideal'
    : 'celda-rally celda-rally--real';
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [vehiculos, setVehiculos] = useState([]);
  const [itinerario, setItinerario] = useState([]);
  const [mostrarModalVehiculo, setMostrarModalVehiculo] = useState(false);
  const [mostrarModalCh, setMostrarModalCh] = useState(false);
  const [mostrarModalPe, setMostrarModalPe] = useState(false);
  const [mostrarModalZona, setMostrarModalZona] = useState(false);
  const [mostrarModalReinicio, setMostrarModalReinicio] = useState(false);
  const [mostrarModalTiempoExtra, setMostrarModalTiempoExtra] = useState(false);
  const [erroresVehiculo, setErroresVehiculo] = useState({});
  const [erroresCh, setErroresCh] = useState({});
  const [erroresPe, setErroresPe] = useState({});
  const [erroresZona, setErroresZona] = useState({});
  const [valoresCeldas, setValoresCeldas] = useState({});
  const [celdaActiva, setCeldaActiva] = useState(null);
  // mapeo columnaId → cronograma_id del backend (para guardar hora_real)
  const [mapaCronogramaIds, setMapaCronogramaIds] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [errorApi, setErrorApi] = useState(null);
  const refsCeldas = useRef(new Map());

  // ── Carga inicial desde el backend ──────────────────────────────────────
  useEffect(() => {
    async function cargarEstadoInicial() {
      try {
        const vehsBackend = await api.vehiculos.listar();
        if (vehsBackend.length > 0) {
          // El backend ya devuelve ordenado por orden_ingreso ASC
          setVehiculos(vehsBackend.map((v) => ({
            numero:    v.numero,
            piloto:    v.piloto,
            navegante: v.navegante ?? '',
            categoria: v.categoria,
          })));
        }

        const cronogramaBackend = await api.cronograma.listar();
        if (cronogramaBackend.length > 0) {
          // Reconstruir el itinerario en memoria desde el cronograma del backend.
          // Los puntos con tipo FLEXI/ASISTENCIA/REGRUP forman un BLOQUE_ASISTENCIA.
          const itinerarioReconstruido = reconstruirItinerario(cronogramaBackend);
          setItinerario(itinerarioReconstruido);

          // Construir el mapa columnaId → id del backend
          const mapa = construirMapaCronogramaIds(itinerarioReconstruido, cronogramaBackend);
          setMapaCronogramaIds(mapa);
        }

        // Cargar horas ideales y reales desde la grilla del backend
        if (vehsBackend.length > 0) {
          const grilla = await api.registros.grilla();
          const valoresIniciales = {};
          for (const entrada of grilla) {
            const numVehiculo = entrada.vehiculo.numero;
            valoresIniciales[numVehiculo] = valoresIniciales[numVehiculo] ?? {};
            for (const tiempo of entrada.tiempos) {
              if (tiempo.hora_real) {
                // hora_real viene como "HH:mm:ss" desde PostgreSQL TIME
                const horaReal = tiempo.hora_real.slice(0, 5);
                // Necesitamos el columnaId local que corresponde a este cronograma_id
                // Lo encontramos al revés: buscar en el mapa
                // (se completa después de setMapaCronogramaIds, acá lo calculamos inline)
              }
            }
          }
        }
      } catch (err) {
        console.warn('No se pudo cargar el estado inicial:', err.message);
      }
    }
    cargarEstadoInicial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Segunda pasada: cuando ya tenemos itinerario Y vehículos, cargamos los tiempos
  useEffect(() => {
    if (itinerario.length === 0 || vehiculos.length === 0) return;

    async function cargarTiempos() {
      try {
        const grilla = await api.registros.grilla();
        const colPorNombre = construirMapaNombreAColumnaId(itinerario);

        const valoresIniciales = {};
        for (const entrada of grilla) {
          const numVehiculo = entrada.vehiculo.numero;
          valoresIniciales[numVehiculo] = {};

          for (const tiempo of entrada.tiempos) {
            // Restaurar hora_real en la columna "real" correspondiente
            if (tiempo.hora_real) {
              const colId = colPorNombre[`real:${tiempo.punto_nombre}`];
              if (colId) valoresIniciales[numVehiculo][colId] = tiempo.hora_real.slice(0, 5);
            }
            // Restaurar hora_ideal solo para el CH0 (columna ideal editable)
            if (tiempo.hora_ideal) {
              const colIdeal = colPorNombre[`ideal:${tiempo.punto_nombre}`];
              if (colIdeal) valoresIniciales[numVehiculo][colIdeal] = tiempo.hora_ideal.slice(0, 5);
            }
          }
        }

        setValoresCeldas(valoresIniciales);
      } catch (err) {
        console.warn('No se pudieron cargar los tiempos:', err.message);
      }
    }

    cargarTiempos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itinerario, vehiculos]);

  // ── Valores calculados (igual que antes) ──────────────────────────────
  const columnasItinerario = useMemo(
    () => crearColumnasDesdeItinerario(itinerario),
    [itinerario],
  );

  const valoresCalculados = useMemo(() => {
    const mapa = {};
    vehiculos.forEach((vehiculo) => {
      mapa[vehiculo.numero] = calcularPlanillaVehiculo(
        itinerario,
        valoresCeldas[vehiculo.numero] ?? {},
      );
    });
    return mapa;
  }, [itinerario, valoresCeldas, vehiculos]);

  const columnasTabla = useMemo(() => {
    const columnasFijas = [
      {
        id: 'numero',
        header: () => 'N°',
        cell: ({ row }) => row.original.numero,
        meta: {
          tipo: 'FIJA',
          claseEncabezado: 'columna-fija columna-fija--numero encabezado-fijo',
          claseCelda: 'columna-fija columna-fija--numero columna-fija--cuerpo colmn-nro text-center fw-bold',
        },
      },
      {
        id: 'piloto',
        header: () => 'Piloto',
        cell: ({ row }) => row.original,
        meta: {
          tipo: 'FIJA',
          claseEncabezado: 'columna-fija columna-fija--piloto encabezado-fijo',
          claseCelda: 'columna-fija columna-fija--piloto columna-fija--cuerpo',
        },
      },
    ];

    const columnasDinamicas = columnasItinerario.map((columna) => ({
      id: columna.id,
      header: () => columna.nombreBase,
      cell: ({ row }) => ({ vehiculo: row.original, columna }),
      meta: {
        tipo: columna.tipo,
        claseEncabezado: obtenerClaseEncabezado(columna),
        claseCelda: obtenerClaseCelda(columna),
        columna,
      },
    }));

    return [...columnasFijas, ...columnasDinamicas];
  }, [columnasItinerario]);

  const tabla = useReactTable({
    data: vehiculos,
    columns: columnasTabla,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalFilas = vehiculos.length;
  const totalColumnasNavegables = columnasItinerario.length;

  // ── Navegación con teclado (sin cambios) ────────────────────────────────
  function registrarCelda(clave, nodo) {
    if (nodo) { refsCeldas.current.set(clave, nodo); return; }
    refsCeldas.current.delete(clave);
  }

  function enfocarCelda(fila, columna) {
    const nodo = refsCeldas.current.get(`${fila}:${columna}`);
    if (nodo) { nodo.focus(); setCeldaActiva({ fila, columna }); }
  }

  function moverCeldaDesdeTeclado(evento, fila, columna) {
    const esTab = evento.key === 'Tab';
    const esEnter = evento.key === 'Enter';
    if (!esTab && !esEnter) return;
    evento.preventDefault();
    if (totalFilas === 0 || totalColumnasNavegables === 0) return;

    if (esEnter) {
      const siguienteFila = evento.shiftKey
        ? Math.max(0, fila - 1)
        : Math.min(totalFilas - 1, fila + 1);
      enfocarCelda(siguienteFila, columna);
      return;
    }

    const siguienteColumna = evento.shiftKey
      ? Math.max(0, columna - 1)
      : Math.min(totalColumnasNavegables - 1, columna + 1);
    enfocarCelda(fila, siguienteColumna);
  }

  useEffect(() => {
    if (
      celdaActiva &&
      (celdaActiva.fila >= totalFilas || celdaActiva.columna >= totalColumnasNavegables)
    ) {
      setCeldaActiva(null);
    }
  }, [celdaActiva, totalColumnasNavegables, totalFilas]);

  useHotkeys(
    'up,down,left,right',
    (evento, handler) => {
      if (!celdaActiva || totalFilas === 0 || totalColumnasNavegables === 0) return;
      evento.preventDefault();
      const siguiente = { ...celdaActiva };
      if (handler.keys?.includes('up')) siguiente.fila = Math.max(0, celdaActiva.fila - 1);
      if (handler.keys?.includes('down')) siguiente.fila = Math.min(totalFilas - 1, celdaActiva.fila + 1);
      if (handler.keys?.includes('left')) siguiente.columna = Math.max(0, celdaActiva.columna - 1);
      if (handler.keys?.includes('right')) siguiente.columna = Math.min(totalColumnasNavegables - 1, celdaActiva.columna + 1);
      enfocarCelda(siguiente.fila, siguiente.columna);
    },
    { enableOnFormTags: true, preventDefault: true },
    [celdaActiva, totalFilas, totalColumnasNavegables],
  );

  // ── Modales ────────────────────────────────────────────────────────────
  function abrirModalVehiculo() { setErroresVehiculo({}); setMostrarModalVehiculo(true); }
  function cerrarModalVehiculo() { setMostrarModalVehiculo(false); setErroresVehiculo({}); }
  function abrirModalCh() { setErroresCh({}); setMostrarModalCh(true); }
  function cerrarModalCh() { setMostrarModalCh(false); setErroresCh({}); }
  function abrirModalPe() { setErroresPe({}); setMostrarModalPe(true); }
  function cerrarModalPe() { setMostrarModalPe(false); setErroresPe({}); }
  function abrirModalZona() { setErroresZona({}); setMostrarModalZona(true); }
  function cerrarModalZona() { setMostrarModalZona(false); setErroresZona({}); }

  // ── Creación de puntos del itinerario ──────────────────────────────────
  async function crearCh(datosFormulario) {
    const numeroLimpio = datosFormulario.numero.trim();
    const letraLimpia = datosFormulario.letra.trim().toUpperCase();
    const tiempoLimpio = datosFormulario.tiempoOtorgado.trim() || '00:00';
    const nuevosErrores = {};

    if (!numeroLimpio || !/^\d+$/.test(numeroLimpio) || Number(numeroLimpio) < 0)
      nuevosErrores.numero = 'Ingresá un numero entero valido.';
    if (letraLimpia && !/^[A-Z]$/.test(letraLimpia))
      nuevosErrores.letra = 'La letra opcional debe ser una sola letra.';
    if (!esTiempoValido(tiempoLimpio))
      nuevosErrores.tiempoOtorgado = 'El tiempo otorgado debe tener formato 00:00.';

    const nombreBase = `CH${numeroLimpio}${letraLimpia}`;
    if (itinerario.some((item) => item.nombreBase === nombreBase))
      nuevosErrores.repetido = `El ${nombreBase} ya existe en la grilla.`;

    if (Object.values(nuevosErrores).some(Boolean)) { setErroresCh(nuevosErrores); return; }

    const nuevoItem = crearControlHorario({
      numero: numeroLimpio,
      letra: letraLimpia,
      tiempoOtorgado: tiempoLimpio,
      noPenalizaAdelanto: datosFormulario.noPenalizaAdelanto,
    });

    const nuevoItinerario = [...itinerario, nuevoItem];
    setItinerario(nuevoItinerario);
    cerrarModalCh();

    // Sincronizar con el backend
    await sincronizarCronograma(nuevoItinerario);
  }

  async function crearPe(datosFormulario) {
    const numeroLimpio = datosFormulario.numero.trim();
    const tiempoDesdeAnterior = datosFormulario.tiempoDesdeAnterior.trim();
    const tiempoOtorgado = datosFormulario.tiempoOtorgado.trim();
    const nuevosErrores = {};

    if (itinerario.length === 0)
      nuevosErrores.base = 'Primero tenés que cargar al menos un CH antes de agregar un PE.';
    if (!numeroLimpio || !/^\d+$/.test(numeroLimpio) || Number(numeroLimpio) <= 0)
      nuevosErrores.numero = 'Ingresá un numero entero valido para el PE.';
    if (!esTiempoValido(tiempoDesdeAnterior))
      nuevosErrores.tiempoDesdeAnterior = 'El tiempo desde el punto anterior debe tener formato 00:00.';
    if (!esTiempoValido(tiempoOtorgado))
      nuevosErrores.tiempoOtorgado = 'El tiempo otorgado al siguiente CH debe tener formato 00:00.';

    const nombreBase = `PE${numeroLimpio}`;
    if (itinerario.some((item) => item.nombreBase === nombreBase))
      nuevosErrores.repetido = `El ${nombreBase} ya existe en la grilla.`;
    if (itinerario[itinerario.length - 1]?.tipo === 'PE')
      nuevosErrores.secuencia = 'No se puede agregar un PE inmediatamente despues de otro PE.';

    if (Object.values(nuevosErrores).some(Boolean)) { setErroresPe(nuevosErrores); return; }

    const nuevoItem = crearPruebaEspecial({ numero: numeroLimpio, tiempoDesdeAnterior, tiempoOtorgado });
    const nuevoItinerario = [...itinerario, nuevoItem];
    setItinerario(nuevoItinerario);
    cerrarModalPe();

    await sincronizarCronograma(nuevoItinerario);
  }

  async function crearZonaTiempo(datosFormulario) {
    const baseNumero = datosFormulario.baseNumero.trim();
    const nuevosErrores = {};
    const camposTiempo = ['tiempoHastaIngreso', 'maxFlexi', 'maxAsistencia', 'maxParqueCerrado', 'tiempoHastaSiguiente'];

    if (!baseNumero || !/^\d+$/.test(baseNumero))
      nuevosErrores.baseNumero = 'Ingresá el numero base del bloque.';

    camposTiempo.forEach((campo) => {
      if (!esTiempoValido(datosFormulario[campo]))
        nuevosErrores[campo] = 'Este campo debe tener formato 00:00.';
    });

    if (itinerario.some((item) => item.tipo === 'BLOQUE_ASISTENCIA' && item.baseNumero === baseNumero))
      nuevosErrores.general = `Ya existe una zona de tiempo con base ${baseNumero}.`;

    if (Object.values(nuevosErrores).some(Boolean)) { setErroresZona(nuevosErrores); return; }

    const nuevoItem = crearBloqueAsistencia({
      baseNumero,
      tiempoHastaIngreso: datosFormulario.tiempoHastaIngreso,
      maxFlexi: datosFormulario.maxFlexi,
      maxAsistencia: datosFormulario.maxAsistencia,
      maxParqueCerrado: datosFormulario.maxParqueCerrado,
      tiempoHastaSiguiente: datosFormulario.tiempoHastaSiguiente,
      noPenalizaAdelantoEnSalida: datosFormulario.noPenalizaAdelantoEnSalida,
    });

    const nuevoItinerario = [...itinerario, nuevoItem];
    setItinerario(nuevoItinerario);
    cerrarModalZona();

    await sincronizarCronograma(nuevoItinerario);
  }

  // ── Sincronización del cronograma con el backend ─────────────────────
  const sincronizarCronograma = useCallback(async (nuevoItinerario) => {
    try {
      const puntos = itinerarioABackend(nuevoItinerario);
      const puntosCreados = await api.cronograma.sincronizar(puntos);

      // Reconstruir el mapa columnaId → cronograma_id
      const mapa = construirMapaCronogramaIds(nuevoItinerario, puntosCreados);
      setMapaCronogramaIds(mapa);

      // Si hay vehículos, re-inicializar registros para incluir nuevos puntos
      if (vehiculos.length > 0) {
        await api.registros.inicializar();
      }
    } catch (err) {
      setErrorApi(`Error al sincronizar el cronograma: ${err.message}`);
    }
  }, [vehiculos.length]);

  // ── Creación de vehículos ────────────────────────────────────────────
  async function crearVehiculos({ modo, vehiculos: nuevosVehiculos }) {
    const errores = {};
    const numerosExistentes = new Set(vehiculos.map((item) => item.numero));
    const numerosNuevos = new Set();
    const vehiculosNormalizados = [];

    if (!Array.isArray(nuevosVehiculos) || nuevosVehiculos.length === 0) {
      errores.general = 'No se detectaron vehiculos para agregar.';
      setErroresVehiculo(errores);
      return;
    }

    nuevosVehiculos.forEach((vehiculo, indice) => {
      const numero = String(vehiculo.numero ?? '').trim();
      const piloto = String(vehiculo.piloto ?? '').trim();
      const navegante = String(vehiculo.navegante ?? '').trim();
      const categoria = String(vehiculo.categoria ?? '').trim().toUpperCase();
      const etiquetaFila = modo === 'masivo' ? `Fila ${indice + 1}` : 'Vehiculo';

      if (!/^\d+$/.test(numero) || Number(numero) <= 0) {
        errores.general = `${etiquetaFila}: el numero del vehiculo debe ser un entero positivo.`; return;
      }
      const numeroEntero = Number(numero);
      if (numerosExistentes.has(numeroEntero) || numerosNuevos.has(numeroEntero)) {
        errores.general = `${etiquetaFila}: el numero ${numeroEntero} ya existe y no se puede repetir.`; return;
      }
      if (!piloto) { errores.general = `${etiquetaFila}: falta el nombre del piloto.`; return; }
      if (!navegante) { errores.general = `${etiquetaFila}: falta el nombre del navegante.`; return; }
      if (!categoria) { errores.general = `${etiquetaFila}: falta la categoria.`; return; }

      numerosNuevos.add(numeroEntero);
      vehiculosNormalizados.push({ numero: numeroEntero, piloto, navegante, categoria });
    });

    if (errores.general) { setErroresVehiculo(errores); return; }

    try {
      setGuardando(true);
      await api.vehiculos.cargaMasiva(vehiculosNormalizados);

      // Si ya hay cronograma, inicializar registros para los nuevos vehículos
      if (itinerario.length > 0) {
        await api.registros.inicializar();
      }

      setVehiculos((actuales) => [...actuales, ...vehiculosNormalizados]);
      cerrarModalVehiculo();
    } catch (err) {
      setErroresVehiculo({ general: `Error al guardar en el servidor: ${err.message}` });
    } finally {
      setGuardando(false);
    }
  }

  // ── Actualización de celdas con persistencia ─────────────────────────
  const actualizarCelda = useCallback(async (vehiculoNumero, columnaId, valor) => {
    const formateado = normalizarTiempo(valor);

    // Actualizar estado local inmediatamente (UX fluida)
    setValoresCeldas((actual) => ({
      ...actual,
      [vehiculoNumero]: {
        ...(actual[vehiculoNumero] ?? {}),
        [columnaId]: formateado,
      },
    }));

    // Solo persistir cuando el valor tiene formato completo HH:mm o está vacío
    const esCompleto = esTiempoValido(formateado);
    const esBorrado = formateado === '';
    if (!esCompleto && !esBorrado) return;

    const cronogramaId = mapaCronogramaIds[columnaId];
    if (!cronogramaId) return; // Columnas calculadas (ideal auto, PE) no se persisten

    // Solo persistir columnas "real" — las ideales las calcula el backend en cascada
    const columnasDef = crearColumnasDesdeItinerario(itinerario);
    const colDef = columnasDef.find((c) => c.id === columnaId);
    if (!colDef) return;

    const esIdealManual = colDef.variante === 'ideal' && colDef.editable;
    const esReal = colDef.variante === 'real';

    if (!esReal && !esIdealManual) return;

    try {
      if (esReal) {
        await api.registros.guardarHoraReal(
          vehiculoNumero,
          cronogramaId,
          esBorrado ? null : formateado,
        );
      } else if (esIdealManual) {
        await api.registros.guardarHoraIdeal(
          vehiculoNumero,
          cronogramaId,
          formateado,
          true, // propagar_offset a vehículos posteriores
        );
      }
    } catch (err) {
      console.error('Error al guardar hora:', err.message);
      setErrorApi(`No se pudo guardar: ${err.message}`);
      // Revertir el valor en caso de error
      setValoresCeldas((actual) => ({
        ...actual,
        [vehiculoNumero]: {
          ...(actual[vehiculoNumero] ?? {}),
          [columnaId]: '',
        },
      }));
    }
  }, [mapaCronogramaIds, itinerario]);

  function obtenerValorCelda(vehiculoNumero, columnaId) {
    return valoresCalculados[vehiculoNumero]?.[columnaId] ?? '';
  }

  // ── Reinicio total ───────────────────────────────────────────────────
  async function reiniciarRally() {
    try {
      // Orden correcto: registros → vehículos → cronograma
      // (los registros tienen FK a ambos, hay que borrarlos primero)
      await api.registros.limpiar();
      await api.vehiculos.eliminarTodos();
      await api.cronograma.sincronizar([]);
    } catch (err) {
      console.error('Error al reiniciar en el servidor:', err.message);
    }
    setVehiculos([]);
    setItinerario([]);
    setValoresCeldas({});
    setMapaCronogramaIds({});
    setCeldaActiva(null);
    setMostrarModalReinicio(false);
  }

  // Lista de todos los CHs (incluye zonas) persistidos en BD para el selector del modal de tiempo extra.
  const todosLosPuntosChParaSelector = useMemo(() => {
    return columnasItinerario
      .filter((col) => col.variante === 'real' && col.tipo === 'CH')
      .map((col) => ({
        cronograma_id: mapaCronogramaIds[col.id],
        nombre: col.nombreBase,
      }))
      .filter((p) => p.cronograma_id);
  }, [columnasItinerario, mapaCronogramaIds]);

  async function aplicarTiempoExtra({ vehiculo_id, cronograma_id, minutos_extra }) {
    await api.registros.aplicarTiempoExtra(vehiculo_id, cronograma_id, minutos_extra);

    // Recargar los tiempos desde el backend para reflejar los nuevos ideales
    const grilla = await api.registros.grilla();
    const colPorNombre = construirMapaNombreAColumnaId(itinerario);
    const valoresActualizados = {};
    for (const entrada of grilla) {
      const numVehiculo = entrada.vehiculo.numero;
      valoresActualizados[numVehiculo] = { ...(valoresCeldas[numVehiculo] ?? {}) };
      for (const tiempo of entrada.tiempos) {
        if (tiempo.hora_real) {
          const colId = colPorNombre[`real:${tiempo.punto_nombre}`];
          if (colId) valoresActualizados[numVehiculo][colId] = tiempo.hora_real.slice(0, 5);
        }
        if (tiempo.hora_ideal) {
          const colIdeal = colPorNombre[`ideal:${tiempo.punto_nombre}`];
          if (colIdeal) valoresActualizados[numVehiculo][colIdeal] = tiempo.hora_ideal.slice(0, 5);
        }
      }
    }
    setValoresCeldas(valoresActualizados);
    setMostrarModalTiempoExtra(false);
  }

  const cantidadCh = itinerario.filter((item) => item.tipo === 'CH').length;
  const textoAyuda =
    itinerario.length === 0
      ? 'Todavia no cargaste ningun punto del itinerario. Empezá con +CH y el primer alta se toma como base desde CH0.'
      : `Ya cargaste ${itinerario.length} punto(s) del itinerario. El primer CH ideal es manual; los PE, las zonas y los siguientes CH ideal se proyectan automáticamente.`;

  return (
    <div className="pantalla">
      <header className="encabezado border-bottom border-secondary-subtle">
        <div className="container-fluid py-3 py-lg-4">
          <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
            <div>
              <h1 className="encabezado__marca mb-2">
                RTCS<span className="subencabezado__marca"> SYSTEM</span>
              </h1>
              <p className="encabezado__titulo mb-2">Control Horario del Rally</p>
            </div>
            <div className="d-flex align-items-start align-items-lg-center gap-2">
              {guardando && (
                <span className="text-warning small d-flex align-items-center gap-1">
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  Guardando…
                </span>
              )}
              <button type="button" className="btn btn-danger btn-sm encabezado__boton" onClick={() => setMostrarModalReinicio(true)}>
                Reiniciar rally
              </button>
            </div>
          </div>
        </div>

        <div className="encabezado__acciones border-top border-secondary-subtle">
          <div className="container-fluid py-3 d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={abrirModalVehiculo}>+ Vehiculo</button>
            <button type="button" className="btn btn-success btn-sm" onClick={abrirModalCh}>+ CH</button>
            <button type="button" className="btn btn-indigo btn-sm" onClick={abrirModalPe}>+ PE</button>
            <button type="button" className="btn btn-warning btn-sm text-dark" onClick={abrirModalZona}>+ Zona de tiempo</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMostrarModalTiempoExtra(true)}>⏱ Tiempo extra</button>
          </div>
        </div>
      </header>

      <main className="contenido container-fluid py-3 py-lg-4">
        {errorApi && (
          <div className="alert alert-danger alert-dismissible mb-3" role="alert">
            {errorApi}
            <button type="button" className="btn-close" onClick={() => setErrorApi(null)} aria-label="Cerrar" />
          </div>
        )}

        <div className="alert alert-secondary mb-3 sombra-panel" role="status">
          {textoAyuda}
        </div>

        <section className="tabla-panel card border-0 sombra-panel">
          <div className="card-body p-0">
            <div className="tabla-scroll">
              <table className="table table-bordered align-middle mb-0 tabla-rally">
                <thead>
                  {tabla.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        const meta = header.column.columnDef.meta ?? {};
                        if (meta.tipo === 'FIJA') {
                          return (
                            <th key={header.id} className={meta.claseEncabezado}>
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          );
                        }
                        return (
                          <th key={header.id} className={meta.claseEncabezado}>
                            <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                            <small>{obtenerTituloColumna(meta.columna)}</small>
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>

                <tbody>
                  {vehiculos.length === 0 ? (
                    <tr>
                      <td colSpan={columnasTabla.length || 2} className="text-center text-secondary py-5">
                        Cargá vehículos para empezar a trabajar la planilla.
                      </td>
                    </tr>
                  ) : tabla.getRowModel().rows.map((row, filaIndex) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell, columnaIndex) => {
                        const meta = cell.column.columnDef.meta ?? {};

                        if (meta.tipo === 'FIJA' && cell.column.id === 'numero') {
                          const cat = row.original.categoria?.toUpperCase() ?? '';
                          const claseCategoria =
                            cat === 'RC2' || cat === 'COPA RC2' ? ' col-nro--rc2' :
                            cat === 'RCMR'                      ? ' col-nro--rcmr' :
                            cat === 'RC4'                       ? ' col-nro--rc4' :
                            cat === 'RC5'                       ? ' col-nro--rc5' :
                            '';
                          return (
                            <td key={cell.id} className={`${meta.claseCelda}${claseCategoria}`}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          );
                        }

                        if (meta.tipo === 'FIJA' && cell.column.id === 'piloto') {
                          const vehiculo = row.original;
                          return (
                            <td key={cell.id} className={meta.claseCelda}>
                              <div className="d-flex flex-column gap-1">
                                <strong className="texto-piloto">{vehiculo.piloto}</strong>
                                <span className="texto-secundario">{vehiculo.navegante}</span>
                                <span className="badge rounded-pill text-bg-danger align-self-start">
                                  {vehiculo.categoria}
                                </span>
                              </div>
                            </td>
                          );
                        }

                        const columnaNavegable = columnaIndex - 2;
                        const claveRef = `${filaIndex}:${columnaNavegable}`;
                        const estaActiva = celdaActiva?.fila === filaIndex && celdaActiva?.columna === columnaNavegable;
                        const vehiculo = row.original;
                        const columna = meta.columna;

                        if (columna.tipo === 'PE') {
                          return (
                            <td key={cell.id} className={`${meta.claseCelda} ${estaActiva ? 'celda-activa' : ''}`}>
                              <div
                                ref={(nodo) => registrarCelda(claveRef, nodo)}
                                className="texto-pe texto-enfocable"
                                tabIndex={0}
                                onFocus={() => setCeldaActiva({ fila: filaIndex, columna: columnaNavegable })}
                                onClick={() => enfocarCelda(filaIndex, columnaNavegable)}
                                onKeyDown={(evento) => moverCeldaDesdeTeclado(evento, filaIndex, columnaNavegable)}
                              >
                                {obtenerValorCelda(vehiculo.numero, columna.id) || '--:--'}
                              </div>
                            </td>
                          );
                        }

                        if (columna.variante === 'ideal' && !columna.editable) {
                          return (
                            <td key={cell.id} className={`${meta.claseCelda} ${estaActiva ? 'celda-activa' : ''}`}>
                              <div
                                ref={(nodo) => registrarCelda(claveRef, nodo)}
                                className="texto-calculado texto-enfocable"
                                tabIndex={0}
                                onFocus={() => setCeldaActiva({ fila: filaIndex, columna: columnaNavegable })}
                                onClick={() => enfocarCelda(filaIndex, columnaNavegable)}
                                onKeyDown={(evento) => moverCeldaDesdeTeclado(evento, filaIndex, columnaNavegable)}
                              >
                                {obtenerValorCelda(vehiculo.numero, columna.id) || '--:--'}
                              </div>
                            </td>
                          );
                        }

                        const valorMax = columna.maxLabelKey
                          ? obtenerValorCelda(vehiculo.numero, columna.maxLabelKey)
                          : null;

                        const labelMax = valorMax
                          ? (() => {
                              const tipos = {
                                flexi: 'MÁX FLEXI',
                                asistencia: 'MÁX ASIST',
                                parque: 'MÁX PARQUE',
                              };
                              return `${tipos[columna.maxLabelTipo] ?? 'MÁX'} ${valorMax}`;
                            })()
                          : null;

                        const estaBloqueada = columna.bloqueadoPorKey
                          ? Boolean(valoresCeldas[vehiculo.numero]?.[columna.bloqueadoPorKey])
                          : false;

                        const valorRealActual = valoresCeldas[vehiculo.numero]?.[columna.id] ?? '';

                        // ── Validación zona de servicio (CHC / CHD): real debe == ideal ──
                        const valorIdealParaValidar = columna.validarIgual
                          ? obtenerValorCelda(vehiculo.numero, columna.validarIgual)
                          : null;
                        const tieneErrorZona =
                          valorIdealParaValidar &&
                          valorRealActual &&
                          esTiempoValido(valorRealActual) &&
                          valorRealActual !== valorIdealParaValidar;

                        // ── Validación CH#A flexi: real no puede superar el máximo ────
                        const valorMaxFlexi = columna.validarMaximo
                          ? obtenerValorCelda(vehiculo.numero, columna.validarMaximo)
                          : null;
                        let tieneErrorMaximo = false;
                        if (valorMaxFlexi && valorRealActual && esTiempoValido(valorRealActual) && esTiempoValido(valorMaxFlexi)) {
                          const [hM, mM] = valorMaxFlexi.split(':').map(Number);
                          const [hR, mR] = valorRealActual.split(':').map(Number);
                          tieneErrorMaximo = (hR * 60 + mR) > (hM * 60 + mM);
                        }

                        // ── Validación CH normal: real debe == ideal ──────────────────
                        // Excepción: si noPenalizaAdelanto=true, solo es error si llega DESPUÉS
                        const valorIdealCH = columna.validarIgualACH
                          ? obtenerValorCelda(vehiculo.numero, columna.validarIgualACH)
                          : null;
                        let tieneErrorCH = false;
                        if (
                          valorIdealCH &&
                          valorRealActual &&
                          esTiempoValido(valorRealActual) &&
                          esTiempoValido(valorIdealCH)
                        ) {
                          if (columna.noPenalizaAdelanto) {
                            // Solo error si llegó tarde (real > ideal)
                            const [hI, mI] = valorIdealCH.split(':').map(Number);
                            const [hR, mR] = valorRealActual.split(':').map(Number);
                            tieneErrorCH = (hR * 60 + mR) > (hI * 60 + mI);
                          } else {
                            // Error si real ≠ ideal (exacto)
                            tieneErrorCH = valorRealActual !== valorIdealCH;
                          }
                        }

                        const tieneError = tieneErrorZona || tieneErrorCH || tieneErrorMaximo;

                        // Clase extra en el <td> cuando hay error
                        const claseErrorTd = tieneError ? ' celda-rally--error' : '';

                        return (
                          <td key={cell.id} className={`${meta.claseCelda}${claseErrorTd} ${estaActiva ? 'celda-activa' : ''}`}>
                            {labelMax ? (
                              <div className="celda-zona__label">{labelMax}</div>
                            ) : null}
                            <input
                              ref={(nodo) => registrarCelda(claveRef, nodo)}
                              type="text"
                              className="form-control form-control-sm input-hora"
                              inputMode="numeric"
                              placeholder="--:--"
                              disabled={estaBloqueada}
                              value={valorRealActual}
                              onFocus={() => setCeldaActiva({ fila: filaIndex, columna: columnaNavegable })}
                              onClick={() => enfocarCelda(filaIndex, columnaNavegable)}
                              onKeyDown={(evento) => moverCeldaDesdeTeclado(evento, filaIndex, columnaNavegable)}
                              onChange={(evento) => actualizarCelda(vehiculo.numero, columna.id, evento.target.value)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {mostrarModalVehiculo ? (
        <ModalCreacionVehiculo errores={erroresVehiculo} onCancelar={cerrarModalVehiculo} onCrear={crearVehiculos} />
      ) : null}
      {mostrarModalCh ? (
        <ModalCreacionCH cantidadCh={cantidadCh} errores={erroresCh} onCancelar={cerrarModalCh} onCrear={crearCh} onCerrarErrores={() => setErroresCh({})} onNormalizarTiempo={normalizarTiempo} />
      ) : null}
      {mostrarModalPe ? (
        <ModalCreacionPE errores={erroresPe} onCancelar={cerrarModalPe} onCrear={crearPe} onCerrarErrores={() => setErroresPe({})} onNormalizarTiempo={normalizarTiempo} />
      ) : null}
      {mostrarModalZona ? (
        <ModalZonaTiempo errores={erroresZona} onCancelar={cerrarModalZona} onCrear={crearZonaTiempo} onCerrarErrores={() => setErroresZona({})} onNormalizarTiempo={normalizarTiempo} />
      ) : null}
      {mostrarModalTiempoExtra ? (
        <ModalTiempoExtra
          vehiculos={vehiculos}
          cronogramaIdCH0={todosLosPuntosChParaSelector[0]?.cronograma_id ?? null}
          onCancelar={() => setMostrarModalTiempoExtra(false)}
          onAplicar={aplicarTiempoExtra}
        />
      ) : null}
      {mostrarModalReinicio ? (
        <ModalConfirmacion
          titulo="¿Reiniciar el rally?"
          descripcion="Se borrarán todos los vehículos, el itinerario y los tiempos cargados. Esta acción no se puede deshacer."
          textoCancelar="Cancelar"
          textoConfirmar="Sí, reiniciar"
          variante="danger"
          onCancelar={() => setMostrarModalReinicio(false)}
          onConfirmar={reiniciarRally}
        />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de reconstrucción
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reconstruye el itinerario en memoria a partir de los puntos del backend.
 * Los tipos FLEXI/ASISTENCIA/REGRUP consecutivos con el mismo prefijo de nombre
 * se agrupan en un BLOQUE_ASISTENCIA.
 */
function reconstruirItinerario(puntosBackend) {
  const itinerario = [];
  let i = 0;

  while (i < puntosBackend.length) {
    const p = puntosBackend[i];

    // Detectar inicio de BLOQUE_ASISTENCIA: el primer punto es FLEXI
    if (p.tipo === 'FLEXI') {
      // Los siguientes 3 puntos deben ser ASISTENCIA, CH y REGRUP
      const pA = p;                          // CH#A — FLEXI
      const pB = puntosBackend[i + 1];       // CH#B — ASISTENCIA
      const pC = puntosBackend[i + 2];       // CH#C — CH (entrada parque cerrado)
      const pD = puntosBackend[i + 3];       // CH#D — REGRUP

      if (pB && pC && pD) {
        // Extraer baseNumero del nombre (ej: "CH3A" → "3")
        const match = pA.nombre.match(/CH(\d+)A/);
        const baseNumero = match ? match[1] : String(pA.orden);

        const minutosATiempo = (min) => {
          const hh = String(Math.floor(min / 60)).padStart(2, '0');
          const mm = String(min % 60).padStart(2, '0');
          return `${hh}:${mm}`;
        };

        itinerario.push(crearBloqueAsistencia({
          baseNumero,
          tiempoHastaIngreso:    minutosATiempo(pA.tiempo_enlace),
          maxFlexi:              minutosATiempo(pB.tiempo_enlace),
          maxAsistencia:         minutosATiempo(pC.tiempo_enlace),
          maxParqueCerrado:      minutosATiempo(pD.tiempo_enlace),
          tiempoHastaSiguiente:  '00:00', // no se guarda en BD directamente
          noPenalizaAdelantoEnSalida: pD.no_penaliza_adelanto,
        }));

        i += 4;
        continue;
      }
    }

    // CH normal
    if (p.tipo === 'CH') {
      const minutosATiempo = (min) => {
        const hh = String(Math.floor(min / 60)).padStart(2, '0');
        const mm = String(min % 60).padStart(2, '0');
        return `${hh}:${mm}`;
      };

      const match = p.nombre.match(/^CH(\d+)([A-Z]?)$/);
      const numero = match ? match[1] : String(p.orden);
      const letra = match ? match[2] : '';

      // Si el item anterior en el itinerario reconstruido fue un PE,
      // este CH tiene el tiempoOtorgado del PE como su tiempo_enlace.
      // Lo transferimos al PE y ponemos 00:00 en el CH.
      const itemAnteriorReconstruido = itinerario[itinerario.length - 1];
      if (itemAnteriorReconstruido?.tipo === 'PE') {
        itemAnteriorReconstruido.tiempoOtorgado = minutosATiempo(p.tiempo_enlace);
        itinerario.push(crearControlHorario({
          numero,
          letra,
          tiempoOtorgado: '00:00',
          noPenalizaAdelanto: p.no_penaliza_adelanto,
        }));
      } else {
        itinerario.push(crearControlHorario({
          numero,
          letra,
          tiempoOtorgado: minutosATiempo(p.tiempo_enlace),
          noPenalizaAdelanto: p.no_penaliza_adelanto,
        }));
      }
    }

    // PE — tiempoOtorgado se completará cuando se procese el CH siguiente
    if (p.tipo === 'PE') {
      const minutosATiempo = (min) => {
        const hh = String(Math.floor(min / 60)).padStart(2, '0');
        const mm = String(min % 60).padStart(2, '0');
        return `${hh}:${mm}`;
      };

      const match = p.nombre.match(/^PE(\d+)$/);
      const numero = match ? match[1] : String(p.orden);

      itinerario.push(crearPruebaEspecial({
        numero,
        tiempoDesdeAnterior: minutosATiempo(p.tiempo_enlace),
        tiempoOtorgado: '00:00', // se actualiza al procesar el CH siguiente
      }));
    }

    i++;
  }

  return itinerario;
}

/**
 * Construye el mapa { columnaId → cronograma_id } para poder persistir
 * los tiempos reales. Relaciona las columnas del itinerario en memoria
 * con los IDs de los puntos del backend por nombre y posición.
 */
function construirMapaCronogramaIds(itinerario, puntosBackend) {
  const porNombre = {};
  for (const p of puntosBackend) {
    porNombre[p.nombre] = p.id;
  }

  const mapa = {};

  itinerario.forEach((item, indice) => {
    const baseId = `${item.id}-${indice}`;

    if (item.tipo === 'CH') {
      // Hora real — siempre persistible
      mapa[`${baseId}-real`] = porNombre[item.nombreBase];
      // Hora ideal — solo el CH0 (indice 0) es editable manualmente
      if (indice === 0) {
        mapa[`${baseId}-ideal`] = porNombre[item.nombreBase];
      }
    }

    if (item.tipo === 'BLOQUE_ASISTENCIA') {
      const n = item.baseNumero;
      mapa[`${baseId}-a-real`] = porNombre[`CH${n}A`];
      mapa[`${baseId}-b-real`] = porNombre[`CH${n}B`];
      mapa[`${baseId}-c-real`] = porNombre[`CH${n}C`];
      mapa[`${baseId}-d-real`] = porNombre[`CH${n}D`];
    }
  });

  return mapa;
}

/**
 * Construye el mapa { nombrePunto → columnaId } para cargar los tiempos
 * desde la BD al arrancar y mapearlos a las columnas del frontend.
 */
function construirMapaNombreAColumnaId(itinerario) {
  const mapa = {};

  itinerario.forEach((item, indice) => {
    const baseId = `${item.id}-${indice}`;

    if (item.tipo === 'CH') {
      // Prefijo "real:" para horas reales, "ideal:" para ideales editables
      mapa[`real:${item.nombreBase}`] = `${baseId}-real`;
      if (indice === 0) {
        mapa[`ideal:${item.nombreBase}`] = `${baseId}-ideal`;
      }
    }

    if (item.tipo === 'BLOQUE_ASISTENCIA') {
      const n = item.baseNumero;
      mapa[`real:CH${n}A`] = `${baseId}-a-real`;
      mapa[`real:CH${n}B`] = `${baseId}-b-real`;
      mapa[`real:CH${n}C`] = `${baseId}-c-real`;
      mapa[`real:CH${n}D`] = `${baseId}-d-real`;
    }
  });

  return mapa;
}