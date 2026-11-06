import { useState } from 'react';
import { facturacionService } from '../../services/api/facturacionService';
import { useToast } from '../../hooks/useToast';

// HU9: los mails de facturación se mandan solos todos los días (job diario).
// Desde acá el administrador los dispara en el momento, por ejemplo para una
// demo. No repiten envíos ya hechos.
const JOBS = {
  emision: {
    titulo: 'Emitir facturas del mes siguiente',
    detalle: 'Genera las facturas y le manda a cada padre la de su hijo, con el detalle y el PDF.',
    automatico: 'Automático: el último día hábil del mes.',
  },
  deuda: {
    titulo: 'Avisar deuda del mes',
    detalle: 'Manda un recordatorio a los padres de las facturas del mes que tienen saldo pendiente.',
    automatico: 'Automático: el día 20.',
  },
};

function resumen(r) {
  const partes = [
    `${r.facturas} factura${r.facturas === 1 ? '' : 's'}`,
    `${r.enviados} mail${r.enviados === 1 ? '' : 's'} enviado${r.enviados === 1 ? '' : 's'}`,
  ];
  if (r.facturacion?.creadas)
    partes.unshift(`${r.facturacion.creadas} generada${r.facturacion.creadas === 1 ? '' : 's'}`);
  if (r.yaEnviados) partes.push(`${r.yaEnviados} ya enviados antes`);
  if (r.fallidos) partes.push(`${r.fallidos} con error (se reintentan mañana)`);
  if (r.sinDestinatario) partes.push(`${r.sinDestinatario} sin padre vinculado`);
  return `Período ${r.periodo}: ${partes.join(' · ')}.`;
}

export default function AvisosFacturacion() {
  const toast = useToast();
  const [confirmando, setConfirmando] = useState(null);
  const [ejecutando, setEjecutando] = useState(null);
  const [resultado, setResultado] = useState(null);

  async function ejecutar(tipo) {
    setConfirmando(null);
    setEjecutando(tipo);
    try {
      const r = await facturacionService.ejecutarJob(tipo);
      if (!r.exito) {
        toast.error(r.message || 'No se pudo ejecutar.');
        return;
      }
      setResultado(resumen(r));
      if (r.fallidos) toast.error(`${r.fallidos} mail(s) no se pudieron enviar.`);
      else toast.success('Listo.');
    } catch {
      toast.error('No se pudo conectar con el servidor.');
    } finally {
      setEjecutando(null);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-blue-100 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h4 className="text-lg font-bold">Facturación y avisos por mail</h4>
      <p className="mt-1 text-sm text-ink-soft">
        Se ejecutan solos todos los días. Podés dispararlos ahora; no se repiten los mails que ya se mandaron.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {Object.entries(JOBS).map(([tipo, job]) => (
          <div key={tipo} className="rounded-lg border border-blue-100 p-4 dark:border-slate-700">
            <div className="font-semibold">{job.titulo}</div>
            <p className="mt-1 text-sm text-ink-soft">{job.detalle}</p>
            <p className="mt-1 text-xs text-ink-faint">{job.automatico}</p>
            {confirmando === tipo ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => ejecutar(tipo)}
                  className="rounded bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
                >
                  Sí, ejecutar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(null)}
                  className="rounded border border-blue-100 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={ejecutando !== null}
                onClick={() => setConfirmando(tipo)}
                className="mt-3 rounded bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-60"
              >
                {ejecutando === tipo ? 'Ejecutando…' : 'Ejecutar ahora'}
              </button>
            )}
          </div>
        ))}
      </div>
      {resultado ? (
        <p
          role="status"
          className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-slate-800 dark:text-blue-200"
        >
          {resultado}
        </p>
      ) : null}
    </section>
  );
}
