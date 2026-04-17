import './ModalConfirmacion.css';

export default function ModalConfirmacion({ titulo, descripcion, textoCancelar, textoConfirmar, variante = 'danger', onCancelar, onConfirmar }) {
  return (
    <div className="modal-backdrop-rtcs">
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-sm">
          <div className="modal-content border-0 sombra-panel modal-confirmacion">
            <div className="modal-body text-center py-4 px-4">
              <div className={`modal-confirmacion__icono modal-confirmacion__icono--${variante} mb-3`}>
                !
              </div>
              <h2 className="modal-confirmacion__titulo mb-2">{titulo}</h2>
              <p className="modal-confirmacion__descripcion mb-0">{descripcion}</p>
            </div>
            <div className="modal-footer border-0 justify-content-center gap-2 pb-4">
              <button
                type="button"
                className="btn btn-outline-secondary modal-confirmacion__btn"
                onClick={onCancelar}
              >
                {textoCancelar ?? 'Cancelar'}
              </button>
              <button
                type="button"
                className={`btn btn-${variante} modal-confirmacion__btn`}
                onClick={onConfirmar}
              >
                {textoConfirmar ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}