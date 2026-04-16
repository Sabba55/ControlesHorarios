import { useMemo, useState } from 'react';
import './ModalCreacionVehiculo.css';

const formularioInicial = {
  numero: '',
  piloto: '',
  navegante: '',
  categoria: '',
  textoMasivo: '',
};

function parsearVehiculosDesdeTexto(texto) {
  const lineas = texto
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean);

  if (lineas.length === 0) {
    return [];
  }

  const sinEncabezado = /^nro[\t ]+piloto[\t ]+navegante[\t ]+clase$/i.test(lineas[0])
    ? lineas.slice(1)
    : lineas;

  return sinEncabezado
    .map((linea) => linea.split('\t').map((parte) => parte.trim()))
    .filter((partes) => partes.length >= 4)
    .map(([numero, piloto, navegante, categoria]) => ({
      numero,
      piloto,
      navegante,
      categoria,
    }));
}

export default function ModalCreacionVehiculo({
  errores,
  onCancelar,
  onCrear,
}) {
  const [formulario, setFormulario] = useState(formularioInicial);

  const vistaPreviaMasiva = useMemo(
    () => parsearVehiculosDesdeTexto(formulario.textoMasivo),
    [formulario.textoMasivo],
  );

  function actualizarCampo(campo, valor) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  }

  function crearManual() {
    onCrear({
      modo: 'manual',
      vehiculos: [
        {
          numero: formulario.numero,
          piloto: formulario.piloto,
          navegante: formulario.navegante,
          categoria: formulario.categoria,
        },
      ],
    });
  }

  function crearMasivo() {
    onCrear({
      modo: 'masivo',
      vehiculos: vistaPreviaMasiva,
    });
  }

  return (
    <div className="modal-backdrop-rtcs">
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content border-0 sombra-panel modal-vehiculo">
            <div className="modal-header">
              <div>
                <h2 className="modal-title fs-5 mb-1">Agregar vehiculos</h2>
                <p className="text-secondary small mb-0">
                  Podés cargar un solo auto a mano o pegar un bloque desde Google Sheets usando columnas separadas por tabulaciones.
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
              <div className="row g-4">
                <div className="col-12 col-lg-5">
                  <h3 className="h6 mb-3">Carga manual</h3>

                  <div className="d-flex flex-column gap-3">
                    <div>
                      <label htmlFor="vehiculo-numero" className="form-label">Numero</label>
                      <input
                        id="vehiculo-numero"
                        type="text"
                        className="form-control"
                        value={formulario.numero}
                        onChange={(evento) => actualizarCampo('numero', evento.target.value.replace(/\D/g, ''))}
                        placeholder="Ej: 1"
                      />
                    </div>

                    <div>
                      <label htmlFor="vehiculo-piloto" className="form-label">Piloto</label>
                      <input
                        id="vehiculo-piloto"
                        type="text"
                        className="form-control"
                        value={formulario.piloto}
                        onChange={(evento) => actualizarCampo('piloto', evento.target.value)}
                        placeholder="Nombre y apellido"
                      />
                    </div>

                    <div>
                      <label htmlFor="vehiculo-navegante" className="form-label">Navegante</label>
                      <input
                        id="vehiculo-navegante"
                        type="text"
                        className="form-control"
                        value={formulario.navegante}
                        onChange={(evento) => actualizarCampo('navegante', evento.target.value)}
                        placeholder="Nombre y apellido"
                      />
                    </div>

                    <div>
                      <label htmlFor="vehiculo-categoria" className="form-label">Categoria</label>
                      <input
                        id="vehiculo-categoria"
                        type="text"
                        className="form-control text-uppercase"
                        value={formulario.categoria}
                        onChange={(evento) => actualizarCampo('categoria', evento.target.value.toUpperCase())}
                        placeholder="Ej: RC2"
                      />
                    </div>

                    <button type="button" className="btn btn-primary" onClick={crearManual}>
                      Agregar vehiculo
                    </button>
                  </div>
                </div>

                <div className="col-12 col-lg-7">
                  <h3 className="h6 mb-3">Pegado masivo desde planilla</h3>

                  <label htmlFor="vehiculos-masivo" className="form-label">
                    Pegá las columnas `NRO`, `PILOTO`, `NAVEGANTE`, `CLASE`
                  </label>
                  <textarea
                    id="vehiculos-masivo"
                    className="form-control modal-vehiculo__textarea"
                    value={formulario.textoMasivo}
                    onChange={(evento) => actualizarCampo('textoMasivo', evento.target.value)}
                    placeholder={'NRO\tPILOTO\tNAVEGANTE\tCLASE\n1\tMiguel BALDONI\tGustavo FRANCHELLO\tRC2'}
                  />

                  <div className="form-text">
                    Si pegás el encabezado también sirve. El sistema intenta detectarlo automáticamente.
                  </div>

                  <div className="modal-vehiculo__preview mt-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h4 className="h6 mb-0">Vista previa</h4>
                      <span className="badge text-bg-secondary">
                        {vistaPreviaMasiva.length} detectado(s)
                      </span>
                    </div>

                    {vistaPreviaMasiva.length === 0 ? (
                      <p className="text-secondary mb-0">
                        Todavía no se detectaron filas válidas.
                      </p>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm align-middle mb-0">
                          <thead>
                            <tr>
                              <th>N°</th>
                              <th>Piloto</th>
                              <th>Navegante</th>
                              <th>Clase</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vistaPreviaMasiva.map((vehiculo, indice) => (
                              <tr key={`${vehiculo.numero}-${indice}`}>
                                <td>{vehiculo.numero}</td>
                                <td>{vehiculo.piloto}</td>
                                <td>{vehiculo.navegante}</td>
                                <td>{vehiculo.categoria}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary mt-3"
                    onClick={crearMasivo}
                  >
                    Agregar lote
                  </button>
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
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
