import { useState } from 'react';
import { pagosAdminService } from '../../../services/api/pagosAdminService';
import { useToast } from '../../../hooks/useToast';
import { etiquetaPeriodo, periodosDisponibles } from '../../../domain/pagos';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1';

// Agrupa los alumnos omitidos por motivo: "Ya tiene factura del período." (18 alumnos).
function agruparOmitidas(detalle) {
  const mapa = new Map();
  detalle.forEach((d) => mapa.set(d.motivo, [...(mapa.get(d.motivo) ?? []), d.estudianteId]));
  return [...mapa.entries()].map(([motivo, ids]) => ({ motivo, ids }));
}

export default function FacturacionPanel() {
  const toast = useToast();
  const periodos = periodosDisponibles();
  const [periodo, setPeriodo] = useState(periodos[0]);
  const [confirmando, setConfirmando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const generar = async () => {
    setGenerando(true);
    const res = await pagosAdminService.generarFacturas(periodo);
    setGenerando(false);
    setConfirmando(false);
    if (res.exito) {
      setResultado(res);
      toast.success(
        `Facturación de ${etiquetaPeriodo(res.periodo)}: ${res.creadas} creadas, ${res.omitidas} omitidas.`,
      );
    } else {
      setResultado(null);
      toast.error(res.message || 'No se pudieron generar las facturas.');
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-blue-100 bg-white p-4 sm:p-5">
        <h2 className="font-display text-lg text-ink">Generar facturas del período</h2>
        <p className="mb-4 mt-1 text-sm text-ink-soft">
          Emite una factura por alumno activo con curso, con la cuota, los deportes, el transporte y el comedor
          vigentes. Es seguro repetirlo: las facturas ya emitidas no se duplican.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="periodo-facturacion" className="mb-1 block text-xs font-semibold text-ink-soft">
              Período
            </label>
            <select
              id="periodo-facturacion"
              value={periodo}
              onChange={(e) => {
                setPeriodo(e.target.value);
                setConfirmando(false);
              }}
              className={`rounded border border-blue-200 bg-white p-2 text-sm ${focus}`}
            >
              {periodos.map((p, i) => (
                <option key={p} value={p}>
                  {etiquetaPeriodo(p)} {i === 0 ? '(actual)' : '(siguiente)'}
                </option>
              ))}
            </select>
          </div>
          {!confirmando && (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className={`rounded bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 ${focus}`}
            >
              Generar facturas
            </button>
          )}
        </div>

        {confirmando && (
          <div
            role="alertdialog"
            aria-label="Confirmar facturación"
            className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4"
          >
            <p className="text-sm text-ink">
              ¿Generar las facturas de <strong>{etiquetaPeriodo(periodo)}</strong>? Los precios que se usan son los
              vigentes ahora.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={generar}
                disabled={generando}
                className={`rounded bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 ${focus}`}
              >
                {generando ? 'Generando…' : 'Sí, generar'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                disabled={generando}
                className={`rounded border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-white/60 ${focus}`}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      {resultado && (
        <section
          className="rounded-lg border border-blue-100 bg-white p-4 sm:p-5"
          aria-live="polite"
          aria-labelledby="resultado-facturacion"
        >
          <h2 id="resultado-facturacion" className="font-display text-lg text-ink">
            Resultado de {etiquetaPeriodo(resultado.periodo)}
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="rounded-lg bg-teal/15 p-3">
              <dt className="text-xs font-semibold text-[#0A6F5F]">Facturas creadas</dt>
              <dd className="font-display text-2xl text-ink">{resultado.creadas}</dd>
            </div>
            <div className="rounded-lg bg-slate-100 p-3">
              <dt className="text-xs font-semibold text-slate-700">Omitidas</dt>
              <dd className="font-display text-2xl text-ink">{resultado.omitidas}</dd>
            </div>
          </dl>
          {resultado.detalleOmitidas.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold text-ink">Motivo de las omitidas</h3>
              <ul className="space-y-2">
                {agruparOmitidas(resultado.detalleOmitidas).map((g) => (
                  <li key={g.motivo} className="rounded border border-blue-100 p-3 text-sm">
                    <p className="font-medium text-ink">
                      {g.motivo}{' '}
                      <span className="font-normal text-ink-soft">
                        ({g.ids.length} {g.ids.length === 1 ? 'alumno' : 'alumnos'})
                      </span>
                    </p>
                    <p className="mt-1 break-words text-xs text-ink-faint">IDs de alumno: {g.ids.join(', ')}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
