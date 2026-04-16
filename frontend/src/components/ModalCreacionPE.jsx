import { useState } from 'react';
import './ModalCreacionPE.css';

const formularioInicial = {
  numero: '',
  tiempoDesdeAnterior: '00:03',
  tiempoOtorgado: '',
};

export default function ModalCreacionPE({
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
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 sombra-panel modal-pe">
            <div className="modal-header">
              <div>
                <h2 className="modal-title fs-5 mb-1">Agregar prueba especial</h2>
                <p className="text-secondary small mb-0">
                  El PE se ubica entre un CH y el siguiente CH. Genera una sola columna proyectada en la grilla.
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
                <div className="col-12">
                  <label htmlFor="numero-pe" className="form-label">
                    Numero entero del PE
                  </label>
                  <input
                    id="numero-pe"
                    type="text"
                    className={`form-control modal-pe__input ${errores.numero ? 'is-invalid' : ''}`}
                    value={formulario.numero}
                    onChange={(evento) => {
                      actualizarCampo('numero', evento.target.value.replace(/\D/g, ''));
                    }}
                    placeholder="Ej: 1, 2, 3"
                  />
                  {errores.numero ? <div className="invalid-feedback">{errores.numero}</div> : null}
                </div>

                <div className="col-12">
                  <label htmlFor="desde-anterior-pe" className="form-label">
                    Tiempo desde el punto anterior hasta la largada del PE
                  </label>
                  <input
                    id="desde-anterior-pe"
                    type="text"
                    className={`form-control modal-pe__input ${errores.tiempoDesdeAnterior ? 'is-invalid' : ''}`}
                    value={formulario.tiempoDesdeAnterior}
                    onChange={(evento) => {
                      actualizarCampo('tiempoDesdeAnterior', onNormalizarTiempo(evento.target.value));
                    }}
                    placeholder="00:03"
                  />
                  {errores.tiempoDesdeAnterior ? (
                    <div className="invalid-feedback">{errores.tiempoDesdeAnterior}</div>
                  ) : (
                    <div className="form-text">
                      Ejemplo típico: 00:03 desde el CH anterior hasta la mesa/largada del PE.
                    </div>
                  )}
                </div>

                <div className="col-12">
                  <label htmlFor="tiempo-otorgado-pe" className="form-label">
                    Tiempo otorgado hasta el siguiente CH
                  </label>
                  <input
                    id="tiempo-otorgado-pe"
                    type="text"
                    className={`form-control modal-pe__input ${errores.tiempoOtorgado ? 'is-invalid' : ''}`}
                    value={formulario.tiempoOtorgado}
                    onChange={(evento) => {
                      actualizarCampo('tiempoOtorgado', onNormalizarTiempo(evento.target.value));
                    }}
                    placeholder="00:25"
                  />
                  {errores.tiempoOtorgado ? (
                    <div className="invalid-feedback">{errores.tiempoOtorgado}</div>
                  ) : (
                    <div className="form-text">
                      Este tiempo es el que se usa para calcular el horario ideal del próximo CH.
                    </div>
                  )}
                </div>

                {errores.base || errores.repetido || errores.secuencia ? (
                  <div className="col-12">
                    <div className="alert alert-danger mb-0 py-2">
                      {errores.base || errores.repetido || errores.secuencia}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancelar}>
                Cancelar
              </button>
              <button type="button" className="btn btn-indigo" onClick={() => onCrear(formulario)}>
                Crear PE
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
