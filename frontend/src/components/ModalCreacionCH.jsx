import { useEffect, useState } from 'react';
import './ModalCreacionCH.css';

function crearFormularioInicial(cantidadCh) {
  return {
    numero: cantidadCh === 0 ? '0' : '',
    letra: '',
    tiempoOtorgado: '00:00',
    noPenalizaAdelanto: false,
  };
}

export default function ModalCreacionCH({
  cantidadCh,
  errores,
  onCancelar,
  onCrear,
  onCerrarErrores,
  onNormalizarTiempo,
}) {
  const [formulario, setFormulario] = useState(() => crearFormularioInicial(cantidadCh));

  useEffect(() => {
    setFormulario(crearFormularioInicial(cantidadCh));
  }, [cantidadCh]);

  function actualizarCampo(campo, valor) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));

    if (Object.keys(errores).length > 0) {
      onCerrarErrores();
    }
  }

  function manejarCrear() {
    onCrear(formulario);
  }

  return (
    <div className="modal-backdrop-rtcs">
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 sombra-panel modal-ch">
            <div className="modal-header">
              <div>
                <h2 className="modal-title fs-5 mb-1">Agregar control horario</h2>
                <p className="text-secondary small mb-0">
                  {cantidadCh === 0
                    ? 'Como todavia no existe ningun CH, el numero inicial sugerido es el 0.'
                    : 'Cada CH nuevo va a crear automaticamente una columna ideal y otra real.'}
                </p>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Cerrar"
                onClick={onCancelar}
              />
            </div>

            <div className="modal-body">
              <div className="row g-3">
                <div className="col-sm-7">
                  <label htmlFor="numero-ch" className="form-label">
                    Numero entero del CH
                  </label>
                  <input
                    id="numero-ch"
                    type="text"
                    className={`form-control modal-ch__input ${errores.numero ? 'is-invalid' : ''}`}
                    value={formulario.numero}
                    onChange={(evento) => {
                      actualizarCampo('numero', evento.target.value.replace(/\D/g, ''));
                    }}
                    placeholder="Ej: 0, 1, 7, 13"
                  />
                  {errores.numero ? <div className="invalid-feedback">{errores.numero}</div> : null}
                </div>

                <div className="col-sm-5">
                  <label htmlFor="letra-ch" className="form-label">
                    Letra opcional
                  </label>
                  <input
                    id="letra-ch"
                    type="text"
                    className={`form-control modal-ch__input text-uppercase ${errores.letra ? 'is-invalid' : ''}`}
                    value={formulario.letra}
                    onChange={(evento) => {
                      actualizarCampo('letra', evento.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 1));
                    }}
                    placeholder="Ej: A"
                  />
                  {errores.letra ? <div className="invalid-feedback">{errores.letra}</div> : null}
                </div>

                <div className="col-12">
                  <label htmlFor="tiempo-ch" className="form-label">
                    Tiempo otorgado hasta el siguiente CH
                  </label>
                  <input
                    id="tiempo-ch"
                    type="text"
                    className={`form-control modal-ch__input ${errores.tiempoOtorgado ? 'is-invalid' : ''}`}
                    value={formulario.tiempoOtorgado}
                    onChange={(evento) => {
                      actualizarCampo('tiempoOtorgado', onNormalizarTiempo(evento.target.value));
                    }}
                    placeholder="00:00"
                  />
                  {errores.tiempoOtorgado ? (
                    <div className="invalid-feedback">{errores.tiempoOtorgado}</div>
                  ) : (
                    <>
                      <div className="form-text">
                        Este tiempo queda guardado como enlace hacia el siguiente punto del itinerario.
                      </div>
                      <div className="form-text modal-ch__ayuda">
                        Si despues de este CH viene un PE, podés dejarlo en <strong>00:00</strong>.
                        En ese caso, el salto real hasta la largada lo define el propio PE con su
                        tiempo desde el punto anterior.
                      </div>
                    </>
                  )}
                </div>

                <div className="col-12">
                  <div className="form-check form-switch">
                    <input
                      id="adelanto-ch"
                      type="checkbox"
                      className="form-check-input"
                      checked={formulario.noPenalizaAdelanto}
                      onChange={(evento) => {
                        actualizarCampo('noPenalizaAdelanto', evento.target.checked);
                      }}
                    />
                    <label htmlFor="adelanto-ch" className="form-check-label">
                      No penaliza adelantamiento
                    </label>
                  </div>
                </div>

                {errores.repetido ? (
                  <div className="col-12">
                    <div className="alert alert-danger mb-0 py-2">{errores.repetido}</div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancelar}>
                Cancelar
              </button>
              <button type="button" className="btn btn-success" onClick={manejarCrear}>
                Crear CH
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
