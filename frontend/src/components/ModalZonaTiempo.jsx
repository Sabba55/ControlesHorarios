import { useState } from 'react';
import './ModalZonaTiempo.css';

const formularioInicial = {
  baseNumero: '',
  tiempoHastaIngreso: '00:00',
  maxFlexi: '00:15',
  maxAsistencia: '00:40',
  maxParqueCerrado: '00:10',
  tiempoHastaSiguiente: '00:00',
  noPenalizaAdelantoEnSalida: false,
};

export default function ModalZonaTiempo({
  errores,
  onCancelar,
  onCrear,
  onCerrarErrores,
  onNormalizarTiempo,
}) {
  const [formulario, setFormulario] = useState(formularioInicial);

  function actualizarCampo(campo, valor) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));

    if (Object.keys(errores).length > 0) {
      onCerrarErrores();
    }
  }

  return (
    <div className="modal-backdrop-rtcs">
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content border-0 sombra-panel modal-zona">
            <div className="modal-header">
              <div>
                <h2 className="modal-title fs-5 mb-1">Agregar zona de tiempo</h2>
                <p className="text-secondary small mb-0">
                  Por ahora este modal crea un bloque de asistencia/flexi con CHA, CHB, CHC y CHD.
                </p>
              </div>
              <button type="button" className="btn-close" aria-label="Cerrar" onClick={onCancelar} />
            </div>

            <div className="modal-body">
              <div className="row g-3">
                <div className="col-sm-4">
                  <label htmlFor="zona-base-numero" className="form-label">Base del bloque</label>
                  <input
                    id="zona-base-numero"
                    type="text"
                    className={`form-control ${errores.baseNumero ? 'is-invalid' : ''}`}
                    value={formulario.baseNumero}
                    onChange={(evento) => actualizarCampo('baseNumero', evento.target.value.replace(/\D/g, ''))}
                    placeholder="Ej: 3"
                  />
                  {errores.baseNumero ? <div className="invalid-feedback">{errores.baseNumero}</div> : null}
                </div>

                <div className="col-sm-4">
                  <label htmlFor="zona-ingreso" className="form-label">Tiempo hasta CHA</label>
                  <input
                    id="zona-ingreso"
                    type="text"
                    className={`form-control ${errores.tiempoHastaIngreso ? 'is-invalid' : ''}`}
                    value={formulario.tiempoHastaIngreso}
                    onChange={(evento) => actualizarCampo('tiempoHastaIngreso', onNormalizarTiempo(evento.target.value))}
                    placeholder="00:00"
                  />
                  {errores.tiempoHastaIngreso ? <div className="invalid-feedback">{errores.tiempoHastaIngreso}</div> : null}
                </div>

                <div className="col-sm-4">
                  <label htmlFor="zona-flexi" className="form-label">Max flexi</label>
                  <input
                    id="zona-flexi"
                    type="text"
                    className={`form-control ${errores.maxFlexi ? 'is-invalid' : ''}`}
                    value={formulario.maxFlexi}
                    onChange={(evento) => actualizarCampo('maxFlexi', onNormalizarTiempo(evento.target.value))}
                    placeholder="00:15"
                  />
                  {errores.maxFlexi ? <div className="invalid-feedback">{errores.maxFlexi}</div> : null}
                </div>

                <div className="col-sm-4">
                  <label htmlFor="zona-asistencia" className="form-label">Max asistencia</label>
                  <input
                    id="zona-asistencia"
                    type="text"
                    className={`form-control ${errores.maxAsistencia ? 'is-invalid' : ''}`}
                    value={formulario.maxAsistencia}
                    onChange={(evento) => actualizarCampo('maxAsistencia', onNormalizarTiempo(evento.target.value))}
                    placeholder="00:40"
                  />
                  {errores.maxAsistencia ? <div className="invalid-feedback">{errores.maxAsistencia}</div> : null}
                </div>

                <div className="col-sm-4">
                  <label htmlFor="zona-parque" className="form-label">Max parque cerrado</label>
                  <input
                    id="zona-parque"
                    type="text"
                    className={`form-control ${errores.maxParqueCerrado ? 'is-invalid' : ''}`}
                    value={formulario.maxParqueCerrado}
                    onChange={(evento) => actualizarCampo('maxParqueCerrado', onNormalizarTiempo(evento.target.value))}
                    placeholder="00:10"
                  />
                  {errores.maxParqueCerrado ? <div className="invalid-feedback">{errores.maxParqueCerrado}</div> : null}
                </div>

                <div className="col-sm-4">
                  <label htmlFor="zona-siguiente" className="form-label">Tiempo hasta el siguiente CH</label>
                  <input
                    id="zona-siguiente"
                    type="text"
                    className={`form-control ${errores.tiempoHastaSiguiente ? 'is-invalid' : ''}`}
                    value={formulario.tiempoHastaSiguiente}
                    onChange={(evento) => actualizarCampo('tiempoHastaSiguiente', onNormalizarTiempo(evento.target.value))}
                    placeholder="00:20"
                  />
                  {errores.tiempoHastaSiguiente ? <div className="invalid-feedback">{errores.tiempoHastaSiguiente}</div> : null}
                </div>

                <div className="col-12">
                  <div className="form-check form-switch">
                    <input
                      id="zona-adelanto"
                      type="checkbox"
                      className="form-check-input"
                      checked={formulario.noPenalizaAdelantoEnSalida}
                      onChange={(evento) => actualizarCampo('noPenalizaAdelantoEnSalida', evento.target.checked)}
                    />
                    <label htmlFor="zona-adelanto" className="form-check-label">
                      CHD permite adelantamiento
                    </label>
                  </div>
                </div>

                {errores.general ? (
                  <div className="col-12">
                    <div className="alert alert-danger mb-0 py-2">{errores.general}</div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancelar}>
                Cancelar
              </button>
              <button type="button" className="btn btn-warning text-dark" onClick={() => onCrear(formulario)}>
                Crear zona
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
