import { useState, useEffect } from 'react';
import './ModalTiempoExtra.css';

const formularioInicial = {
  numeroVehiculo: '',
  minutos: '',
  operacion: 'sumar', // 'sumar' | 'restar'
};

export default function ModalTiempoExtra({
  vehiculos,
  cronogramaIdCH0,
  onCancelar,
  onAplicar,
}) {
  const [formulario, setFormulario] = useState(formularioInicial);
  const [vehiculoEncontrado, setVehiculoEncontrado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const num = Number(formulario.numeroVehiculo);
    if (!num) { setVehiculoEncontrado(null); return; }
    const found = vehiculos.find((v) => v.numero === num) ?? null;
    setVehiculoEncontrado(found);
    setError('');
  }, [formulario.numeroVehiculo, vehiculos]);

  function actualizar(campo, valor) {
    setFormulario((f) => ({ ...f, [campo]: valor }));
    setError('');
  }

  async function manejarAplicar() {
    const num = Number(formulario.numeroVehiculo);
    const minutos = Number(formulario.minutos);

    if (!vehiculoEncontrado) { setError('Ingresá un número de vehículo válido.'); return; }
    if (!minutos || minutos <= 0 || !Number.isInteger(minutos)) {
      setError('Ingresá una cantidad de minutos entera y positiva.');
      return;
    }
    if (!cronogramaIdCH0) {
      setError('No se encontró el CH0. Verificá que el cronograma esté cargado.');
      return;
    }

    const minutosFinales = formulario.operacion === 'restar' ? -minutos : minutos;

    setGuardando(true);
    setError('');
    try {
      await onAplicar({
        vehiculo_id:   num,
        cronograma_id: cronogramaIdCH0,
        minutos_extra: minutosFinales,
      });
    } catch (err) {
      setError(`Error al aplicar: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  }

  const esSuma = formulario.operacion === 'sumar';

  return (
    <div className="modal-backdrop-rtcs">
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 sombra-panel modal-tiempo-extra">

            <div className="modal-header">
              <div>
                <h2 className="modal-title fs-5 mb-1">Tiempo extra</h2>
                <p className="text-secondary small mb-0">
                  Sumá o restá minutos desde CH0 en adelante al vehículo y todos los que largan después.
                </p>
              </div>
              <button type="button" className="btn-close" aria-label="Cerrar" onClick={onCancelar} />
            </div>

            <div className="modal-body">
              <div className="row g-3">

                {/* Número de vehículo */}
                <div className="col-12">
                  <label htmlFor="te-numero" className="form-label">Número del vehículo</label>
                  <input
                    id="te-numero"
                    type="text"
                    className="form-control"
                    inputMode="numeric"
                    placeholder="Ej: 7"
                    value={formulario.numeroVehiculo}
                    onChange={(e) => actualizar('numeroVehiculo', e.target.value.replace(/\D/g, ''))}
                    autoFocus
                  />
                </div>

                {/* Info del vehículo */}
                {vehiculoEncontrado ? (
                  <div className="col-12">
                    <div className="modal-tiempo-extra__vehiculo-info">
                      <div className="modal-tiempo-extra__vehiculo-nombre">
                        {vehiculoEncontrado.piloto}
                        {vehiculoEncontrado.navegante ? ` / ${vehiculoEncontrado.navegante}` : ''}
                      </div>
                      <div className="modal-tiempo-extra__vehiculo-detalle">
                        N° {vehiculoEncontrado.numero} · {vehiculoEncontrado.categoria}
                      </div>
                    </div>
                  </div>
                ) : formulario.numeroVehiculo ? (
                  <div className="col-12">
                    <div className="alert alert-warning py-2 mb-0 small">
                      No se encontró el vehículo N° {formulario.numeroVehiculo}.
                    </div>
                  </div>
                ) : null}

                {/* Operación — toggle sumar/restar */}
                <div className="col-12">
                  <label className="form-label">Operación</label>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className={`btn btn-sm flex-fill fw-bold ${esSuma ? 'btn-success' : 'btn-outline-success'}`}
                      onClick={() => actualizar('operacion', 'sumar')}
                    >
                      + Sumar
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm flex-fill fw-bold ${!esSuma ? 'btn-danger' : 'btn-outline-danger'}`}
                      onClick={() => actualizar('operacion', 'restar')}
                    >
                      − Restar
                    </button>
                  </div>
                </div>

                {/* Minutos */}
                <div className="col-12">
                  <label htmlFor="te-minutos" className="form-label">Minutos</label>
                  <input
                    id="te-minutos"
                    type="text"
                    className="form-control modal-tiempo-extra__minutos"
                    inputMode="numeric"
                    placeholder="0"
                    value={formulario.minutos}
                    onChange={(e) => actualizar('minutos', e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                {/* Advertencia */}
                {vehiculoEncontrado && formulario.minutos ? (
                  <div className="col-12">
                    <div className="modal-tiempo-extra__advertencia">
                      Se {esSuma ? 'sumarán' : 'restarán'} <strong>{formulario.minutos} min</strong> desde{' '}
                      <strong>CH0</strong> en adelante al N° {vehiculoEncontrado.numero} y a todos
                      los vehículos que largan después.
                    </div>
                  </div>
                ) : null}

                {/* Error */}
                {error ? (
                  <div className="col-12">
                    <div className="alert alert-danger py-2 mb-0 small">{error}</div>
                  </div>
                ) : null}

              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={onCancelar}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`btn fw-bold ${esSuma ? 'btn-warning text-dark' : 'btn-danger'}`}
                onClick={manejarAplicar}
                disabled={guardando || !vehiculoEncontrado || !formulario.minutos}
              >
                {guardando ? (
                  <><span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />Aplicando…</>
                ) : esSuma ? '⏱ Sumar tiempo' : '⏱ Restar tiempo'}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}