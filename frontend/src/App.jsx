import { useEffect, useMemo, useRef, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useHotkeys } from 'react-hotkeys-hook';
import './App.css';
import ModalCreacionCH from './components/ModalCreacionCH.jsx';
import ModalCreacionPE from './components/ModalCreacionPE.jsx';
import ModalCreacionVehiculo from './components/ModalCreacionVehiculo.jsx';
import ModalZonaTiempo from './components/ModalZonaTiempo.jsx';
import {
  calcularPlanillaVehiculo,
  crearBloqueAsistencia,
  crearControlHorario,
  crearEscenarioDemo,
  crearPruebaEspecial,
} from './utils/itinerary.js';
import { esTiempoValido, normalizarTiempo } from './utils/time.js';

const vehiculosIniciales = [];

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
        },
        {
          id: `${baseId}-real`,
          tipo: 'CH',
          nombreBase: item.nombreBase,
          variante: 'real',
          editable: true,
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
      const letras = ['A', 'B', 'C', 'D'];

      return letras.flatMap((letra) => [
        {
          id: `${baseId}-${letra.toLowerCase()}-ideal`,
          tipo: 'CH',
          subtipo: 'ZONA',
          nombreBase: `CH${item.baseNumero}${letra}`,
          variante: 'ideal',
          editable: false,
        },
        {
          id: `${baseId}-${letra.toLowerCase()}-real`,
          tipo: 'CH',
          subtipo: 'ZONA',
          nombreBase: `CH${item.baseNumero}${letra}`,
          variante: 'real',
          editable: true,
        },
      ]);
    }

    return [];
  });
}

function obtenerTituloColumna(columna) {
  if (columna.tipo === 'PE') {
    return 'PROYECTADA';
  }

  if (columna.variante === 'ideal') {
    return columna.editable ? 'IDEAL MANUAL' : 'IDEAL AUTO';
  }

  return 'REAL';
}

function obtenerClaseEncabezado(columna) {
  if (columna.tipo === 'PE') {
    return 'encabezado-pe';
  }

  return columna.variante === 'ideal'
    ? 'encabezado-ch encabezado-ch--ideal'
    : 'encabezado-ch encabezado-ch--real';
}

function obtenerClaseCelda(columna) {
  if (columna.tipo === 'PE') {
    return 'celda-rally celda-rally--pe';
  }

  return columna.variante === 'ideal'
    ? 'celda-rally celda-rally--ideal'
    : 'celda-rally celda-rally--real';
}

export default function App() {
  const [vehiculos, setVehiculos] = useState(vehiculosIniciales);
  const [itinerario, setItinerario] = useState([]);
  const [mostrarModalVehiculo, setMostrarModalVehiculo] = useState(false);
  const [mostrarModalCh, setMostrarModalCh] = useState(false);
  const [mostrarModalPe, setMostrarModalPe] = useState(false);
  const [mostrarModalZona, setMostrarModalZona] = useState(false);
  const [erroresVehiculo, setErroresVehiculo] = useState({});
  const [erroresCh, setErroresCh] = useState({});
  const [erroresPe, setErroresPe] = useState({});
  const [erroresZona, setErroresZona] = useState({});
  const [valoresCeldas, setValoresCeldas] = useState({});
  const [celdaActiva, setCeldaActiva] = useState(null);
  const refsCeldas = useRef(new Map());
  const escenarioDemo = useMemo(() => crearEscenarioDemo(), []);

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
      cell: ({ row }) => ({
        vehiculo: row.original,
        columna,
      }),
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

  function registrarCelda(clave, nodo) {
    if (nodo) {
      refsCeldas.current.set(clave, nodo);
      return;
    }

    refsCeldas.current.delete(clave);
  }

  function enfocarCelda(fila, columna) {
    const nodo = refsCeldas.current.get(`${fila}:${columna}`);

    if (nodo) {
      nodo.focus();
      setCeldaActiva({ fila, columna });
    }
  }

  function moverCeldaDesdeTeclado(evento, fila, columna) {
    const esTab = evento.key === 'Tab';
    const esEnter = evento.key === 'Enter';

    if (!esTab && !esEnter) {
      return;
    }

    evento.preventDefault();

    if (totalFilas === 0 || totalColumnasNavegables === 0) {
      return;
    }

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
    if (celdaActiva && (celdaActiva.fila >= totalFilas || celdaActiva.columna >= totalColumnasNavegables)) {
      setCeldaActiva(null);
    }
  }, [celdaActiva, totalColumnasNavegables, totalFilas]);

  useHotkeys(
    'up,down,left,right',
    (evento, handler) => {
      if (!celdaActiva || totalFilas === 0 || totalColumnasNavegables === 0) {
        return;
      }

      evento.preventDefault();
      const siguiente = { ...celdaActiva };

      if (handler.keys?.includes('up')) {
        siguiente.fila = Math.max(0, celdaActiva.fila - 1);
      }

      if (handler.keys?.includes('down')) {
        siguiente.fila = Math.min(totalFilas - 1, celdaActiva.fila + 1);
      }

      if (handler.keys?.includes('left')) {
        siguiente.columna = Math.max(0, celdaActiva.columna - 1);
      }

      if (handler.keys?.includes('right')) {
        siguiente.columna = Math.min(totalColumnasNavegables - 1, celdaActiva.columna + 1);
      }

      enfocarCelda(siguiente.fila, siguiente.columna);
    },
    {
      enableOnFormTags: true,
      preventDefault: true,
    },
    [celdaActiva, totalFilas, totalColumnasNavegables],
  );

  function abrirModalVehiculo() {
    setErroresVehiculo({});
    setMostrarModalVehiculo(true);
  }

  function cerrarModalVehiculo() {
    setMostrarModalVehiculo(false);
    setErroresVehiculo({});
  }

  function abrirModalCh() {
    setErroresCh({});
    setMostrarModalCh(true);
  }

  function cerrarModalCh() {
    setMostrarModalCh(false);
    setErroresCh({});
  }

  function abrirModalPe() {
    setErroresPe({});
    setMostrarModalPe(true);
  }

  function cerrarModalPe() {
    setMostrarModalPe(false);
    setErroresPe({});
  }

  function abrirModalZona() {
    setErroresZona({});
    setMostrarModalZona(true);
  }

  function cerrarModalZona() {
    setMostrarModalZona(false);
    setErroresZona({});
  }

  function crearCh(datosFormulario) {
    const numeroLimpio = datosFormulario.numero.trim();
    const letraLimpia = datosFormulario.letra.trim().toUpperCase();
    const tiempoLimpio = datosFormulario.tiempoOtorgado.trim() || '00:00';
    const nuevosErrores = {};

    if (!numeroLimpio || !/^\d+$/.test(numeroLimpio) || Number(numeroLimpio) < 0) {
      nuevosErrores.numero = 'Ingresá un numero entero valido.';
    }

    if (letraLimpia && !/^[A-Z]$/.test(letraLimpia)) {
      nuevosErrores.letra = 'La letra opcional debe ser una sola letra.';
    }

    if (!esTiempoValido(tiempoLimpio)) {
      nuevosErrores.tiempoOtorgado = 'El tiempo otorgado debe tener formato 00:00.';
    }

    const nombreBase = `CH${numeroLimpio}${letraLimpia}`;
    const yaExiste = itinerario.some((item) => item.nombreBase === nombreBase);

    if (yaExiste) {
      nuevosErrores.repetido = `El ${nombreBase} ya existe en la grilla.`;
    }

    if (Object.values(nuevosErrores).some(Boolean)) {
      setErroresCh(nuevosErrores);
      return;
    }

    setItinerario((actuales) => [
      ...actuales,
      crearControlHorario({
        numero: numeroLimpio,
        letra: letraLimpia,
        tiempoOtorgado: tiempoLimpio,
        noPenalizaAdelanto: datosFormulario.noPenalizaAdelanto,
      }),
    ]);

    cerrarModalCh();
  }

  function crearPe(datosFormulario) {
    const numeroLimpio = datosFormulario.numero.trim();
    const tiempoDesdeAnterior = datosFormulario.tiempoDesdeAnterior.trim();
    const tiempoOtorgado = datosFormulario.tiempoOtorgado.trim();
    const nuevosErrores = {};

    if (itinerario.length === 0) {
      nuevosErrores.base = 'Primero tenés que cargar al menos un CH antes de agregar un PE.';
    }

    if (!numeroLimpio || !/^\d+$/.test(numeroLimpio) || Number(numeroLimpio) <= 0) {
      nuevosErrores.numero = 'Ingresá un numero entero valido para el PE.';
    }

    if (!esTiempoValido(tiempoDesdeAnterior)) {
      nuevosErrores.tiempoDesdeAnterior = 'El tiempo desde el punto anterior debe tener formato 00:00.';
    }

    if (!esTiempoValido(tiempoOtorgado)) {
      nuevosErrores.tiempoOtorgado = 'El tiempo otorgado al siguiente CH debe tener formato 00:00.';
    }

    const nombreBase = `PE${numeroLimpio}`;
    const yaExiste = itinerario.some((item) => item.nombreBase === nombreBase);
    const ultimoItem = itinerario[itinerario.length - 1];

    if (yaExiste) {
      nuevosErrores.repetido = `El ${nombreBase} ya existe en la grilla.`;
    }

    if (ultimoItem?.tipo === 'PE') {
      nuevosErrores.secuencia = 'No se puede agregar un PE inmediatamente despues de otro PE.';
    }

    if (Object.values(nuevosErrores).some(Boolean)) {
      setErroresPe(nuevosErrores);
      return;
    }

    setItinerario((actuales) => [
      ...actuales,
      crearPruebaEspecial({
        numero: numeroLimpio,
        tiempoDesdeAnterior,
        tiempoOtorgado,
      }),
    ]);

    cerrarModalPe();
  }

  function crearZonaTiempo(datosFormulario) {
    const baseNumero = datosFormulario.baseNumero.trim();
    const nuevosErrores = {};
    const camposTiempo = [
      'tiempoHastaIngreso',
      'maxFlexi',
      'maxAsistencia',
      'maxParqueCerrado',
      'tiempoHastaSiguiente',
    ];

    if (!baseNumero || !/^\d+$/.test(baseNumero)) {
      nuevosErrores.baseNumero = 'Ingresá el numero base del bloque.';
    }

    camposTiempo.forEach((campo) => {
      if (!esTiempoValido(datosFormulario[campo])) {
        nuevosErrores[campo] = 'Este campo debe tener formato 00:00.';
      }
    });

    const yaExiste = itinerario.some(
      (item) => item.tipo === 'BLOQUE_ASISTENCIA' && item.baseNumero === baseNumero,
    );

    if (yaExiste) {
      nuevosErrores.general = `Ya existe una zona de tiempo con base ${baseNumero}.`;
    }

    if (Object.values(nuevosErrores).some(Boolean)) {
      setErroresZona(nuevosErrores);
      return;
    }

    setItinerario((actuales) => [
      ...actuales,
      crearBloqueAsistencia({
        baseNumero,
        tiempoHastaIngreso: datosFormulario.tiempoHastaIngreso,
        maxFlexi: datosFormulario.maxFlexi,
        maxAsistencia: datosFormulario.maxAsistencia,
        maxParqueCerrado: datosFormulario.maxParqueCerrado,
        tiempoHastaSiguiente: datosFormulario.tiempoHastaSiguiente,
        noPenalizaAdelantoEnSalida: datosFormulario.noPenalizaAdelantoEnSalida,
      }),
    ]);

    cerrarModalZona();
  }

  function crearVehiculos({ modo, vehiculos: nuevosVehiculos }) {
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
        errores.general = `${etiquetaFila}: el numero del vehiculo debe ser un entero positivo.`;
        return;
      }

      const numeroEntero = Number(numero);

      if (numerosExistentes.has(numeroEntero) || numerosNuevos.has(numeroEntero)) {
        errores.general = `${etiquetaFila}: el numero ${numeroEntero} ya existe y no se puede repetir.`;
        return;
      }

      if (!piloto) {
        errores.general = `${etiquetaFila}: falta el nombre del piloto.`;
        return;
      }

      if (!navegante) {
        errores.general = `${etiquetaFila}: falta el nombre del navegante.`;
        return;
      }

      if (!categoria) {
        errores.general = `${etiquetaFila}: falta la categoria.`;
        return;
      }

      numerosNuevos.add(numeroEntero);
      vehiculosNormalizados.push({
        numero: numeroEntero,
        piloto,
        navegante,
        categoria,
      });
    });

    if (errores.general) {
      setErroresVehiculo(errores);
      return;
    }

    setVehiculos((actuales) =>
      [...actuales, ...vehiculosNormalizados].sort((a, b) => a.numero - b.numero),
    );
    cerrarModalVehiculo();
  }

  function actualizarCelda(vehiculoNumero, columnaId, valor) {
    const formateado = normalizarTiempo(valor);

    setValoresCeldas((actual) => ({
      ...actual,
      [vehiculoNumero]: {
        ...(actual[vehiculoNumero] ?? {}),
        [columnaId]: formateado,
      },
    }));
  }

  function obtenerValorCelda(vehiculoNumero, columnaId) {
    return valoresCalculados[vehiculoNumero]?.[columnaId] ?? '';
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

            <div className="d-flex align-items-start align-items-lg-center">
              <button type="button" className="btn btn-danger btn-sm encabezado__boton">
                Reiniciar rally
              </button>
            </div>
          </div>
        </div>

        <div className="encabezado__acciones border-top border-secondary-subtle">
          <div className="container-fluid py-3 d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={abrirModalVehiculo}>
              + Vehiculo
            </button>
            <button type="button" className="btn btn-success btn-sm" onClick={abrirModalCh}>
              + CH
            </button>
            <button type="button" className="btn btn-indigo btn-sm" onClick={abrirModalPe}>
              + PE
            </button>
            <button type="button" className="btn btn-warning btn-sm text-dark" onClick={abrirModalZona}>
              + Zona de tiempo
            </button>
          </div>
        </div>
      </header>

      <main className="contenido container-fluid py-3 py-lg-4">
        <div className="alert alert-secondary mb-3 sombra-panel" role="status">
          {textoAyuda}
        </div>

        <section className="card border-0 sombra-panel mb-3">
          <div className="card-body">
            <div className="d-flex flex-column flex-xl-row justify-content-between gap-3">
              <div>
                <h2 className="h5 mb-2">Modelo para resolver CH + PE + parque de asistencia</h2>
                <p className="text-secondary mb-2">
                  La solucion que mejor te conviene es dejar de pensar la tabla solo como columnas
                  manuales y pasar a un itinerario con piezas de dominio: <strong>CH</strong>,
                  <strong> PE</strong> y <strong>bloques especiales</strong>.
                </p>
                <p className="text-secondary mb-0">
                  Cada pieza sabe como calcular el siguiente horario ideal. Asi, el ciclo normal es:
                  CH otorga tiempo al siguiente punto, el PE genera su largada proyectada y luego
                  entrega tiempo al proximo CH. Los parques se resuelven como un bloque con reglas propias.
                </p>
              </div>

              <div className="alert alert-warning mb-0 flex-shrink-0" style={{ maxWidth: '24rem' }}>
                <strong>Clave de modelado:</strong> CH3A, CH3B, CH3C y CH3D no conviene cargarlos a mano
                uno por uno como casos aislados. Conviene tratarlos como un solo bloque de asistencia con
                entradas, maximos y excepciones.
              </div>
            </div>
          </div>
        </section>

        <section className="card border-0 sombra-panel mb-4">
          <div className="card-header bg-white border-0 pb-0">
            <h2 className="h5 mb-1">Escenario demo calculado con tu ejemplo</h2>
            <p className="text-secondary mb-0">
              Base manual: CH0 a las 08:00. A partir de ahi se encadena CH1, PE1, CH2, PE2, CH3, PE3 y el bloque de asistencia.
            </p>
          </div>
          <div className="card-body pt-3">
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Punto</th>
                    <th>Tipo</th>
                    <th>Horario ideal/proyectado</th>
                    <th>Regla</th>
                  </tr>
                </thead>
                <tbody>
                  {escenarioDemo.filas.map((fila) => (
                    <tr key={fila.id}>
                      <td className="fw-semibold">{fila.punto}</td>
                      <td>{fila.tipo}</td>
                      <td className="fw-bold">{fila.horario}</td>
                      <td className="text-secondary">{fila.regla}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="card border-0 sombra-panel mb-4">
          <div className="card-header bg-white border-0 pb-0">
            <h2 className="h5 mb-1">Itinerario en construcción</h2>
            <p className="text-secondary mb-0">
              Acá ya se ve el orden real en el que vas cargando CH, PE y zonas de tiempo.
            </p>
          </div>
          <div className="card-body pt-3">
            {itinerario.length === 0 ? (
              <p className="text-secondary mb-0">Sin puntos cargados todavía.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Orden</th>
                      <th>Punto</th>
                      <th>Tipo</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itinerario.map((item, indice) => (
                      <tr key={`${item.id}-${indice}`}>
                        <td>{indice + 1}</td>
                        <td className="fw-semibold">
                          {item.tipo === 'BLOQUE_ASISTENCIA'
                            ? `Bloque CH${item.baseNumero}A-D`
                            : item.nombreBase}
                        </td>
                        <td>{item.tipo}</td>
                        <td className="text-secondary">
                          {item.tipo === 'CH'
                            ? `Tiempo otorgado al siguiente punto: ${item.tiempoOtorgado}`
                            : item.tipo === 'PE'
                              ? `Larga ${item.tiempoDesdeAnterior} después del punto anterior y otorga ${item.tiempoOtorgado} hasta el siguiente CH`
                              : `Flexi ${item.maxFlexi}, asistencia ${item.maxAsistencia}, parque ${item.maxParqueCerrado}, salida al siguiente CH ${item.tiempoHastaSiguiente}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

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
                          return (
                            <td key={cell.id} className={meta.claseCelda}>
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
                        const estaActiva =
                          celdaActiva?.fila === filaIndex && celdaActiva?.columna === columnaNavegable;
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

                        return (
                          <td key={cell.id} className={`${meta.claseCelda} ${estaActiva ? 'celda-activa' : ''}`}>
                            <input
                              ref={(nodo) => registrarCelda(claveRef, nodo)}
                              type="text"
                              className="form-control form-control-sm input-hora"
                              inputMode="numeric"
                              placeholder="--:--"
                              value={valoresCeldas[vehiculo.numero]?.[columna.id] ?? ''}
                              onFocus={() => setCeldaActiva({ fila: filaIndex, columna: columnaNavegable })}
                              onClick={() => enfocarCelda(filaIndex, columnaNavegable)}
                              onKeyDown={(evento) => moverCeldaDesdeTeclado(evento, filaIndex, columnaNavegable)}
                              onChange={(evento) => {
                                actualizarCelda(
                                  vehiculo.numero,
                                  columna.id,
                                  evento.target.value,
                                );
                              }}
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
        <ModalCreacionVehiculo
          errores={erroresVehiculo}
          onCancelar={cerrarModalVehiculo}
          onCrear={crearVehiculos}
        />
      ) : null}

      {mostrarModalCh ? (
        <ModalCreacionCH
          cantidadCh={cantidadCh}
          errores={erroresCh}
          onCancelar={cerrarModalCh}
          onCrear={crearCh}
          onCerrarErrores={() => setErroresCh({})}
          onNormalizarTiempo={normalizarTiempo}
        />
      ) : null}

      {mostrarModalPe ? (
        <ModalCreacionPE
          errores={erroresPe}
          onCancelar={cerrarModalPe}
          onCrear={crearPe}
          onCerrarErrores={() => setErroresPe({})}
          onNormalizarTiempo={normalizarTiempo}
        />
      ) : null}

      {mostrarModalZona ? (
        <ModalZonaTiempo
          errores={erroresZona}
          onCancelar={cerrarModalZona}
          onCrear={crearZonaTiempo}
          onCerrarErrores={() => setErroresZona({})}
          onNormalizarTiempo={normalizarTiempo}
        />
      ) : null}
    </div>
  );
}
