import { useState } from 'react';
import Modal from '../../ui/Modal';
import EstadoBadge from './EstadoBadge';
import { pagosAdminService } from '../../../services/api/pagosAdminService';
import { useToast } from '../../../hooks/useToast';
import { formatearFecha, formatearMonto, hoyAR } from '../../../domain/pagos';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1';
const btnPrimary = `rounded bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 ${focus}`;
const btnCoral = `rounded bg-coral px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 ${focus}`;
const btnGhost = `rounded border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-blue-50 disabled:opacity-50 ${focus}`;
const inputCls = `w-full rounded border border-blue-200 p-2 text-sm ${focus}`;

const MOTIVO_MIN = 5;
const MOTIVO_MAX = 300;

function Dato({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink">{children || '—'}</dd>
    </div>
  );
}

// Detalle de un comprobante + las dos decisiones del administrador.
// `onAprobar(c, fecha)` y `onRechazar(c, motivo)` devuelven true si la
// operación salió bien; el padre se ocupa de recargar la bandeja.
export default function DetalleComprobanteModal({ comprobante: c, onClose, onAprobar, onRechazar }) {
  const toast = useToast();
  const [modo, setModo] = useState('detalle'); // detalle | aprobar | rechazar
  const [enviando, setEnviando] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [fecha, setFecha] = useState(hoyAR());
  const [motivo, setMotivo] = useState('');

  if (!c) return null;

  const hoy = hoyAR();
  const minFecha = c.fechaTransferencia || undefined;
  const montoDistinto =
    c.montoTransferido !== null && c.montoTransferido !== undefined && Number(c.montoTransferido) !== Number(c.total);
  const revisable = c.estado === 'EN_REVISION';
  const motivoLen = motivo.trim().length;
  const motivoOk = motivoLen >= MOTIVO_MIN && motivoLen <= MOTIVO_MAX;
  const fechaOk = !!fecha && fecha <= hoy && (!minFecha || fecha >= minFecha);

  const cerrar = () => {
    setModo('detalle');
    setMotivo('');
    onClose();
  };

  const verArchivo = async () => {
    setAbriendo(true);
    try {
      const res = await pagosAdminService.urlArchivo(c.id);
      if (!res.exito || !res.url) {
        toast.error(res.message || 'No se pudo abrir el archivo.');
        return;
      }
      // Ancla con rel="noopener noreferrer": la URL firmada no debe filtrarse como referrer.
      const a = document.createElement('a');
      a.href = res.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setAbriendo(false);
    }
  };

  const verPdf = async () => {
    try {
      const blob = await pagosAdminService.descargarPdf(c.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${c.numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      toast.error(err.message || 'No se pudo descargar el PDF.');
    }
  };

  const confirmarAprobar = async () => {
    setEnviando(true);
    const ok = await onAprobar(c, fecha);
    setEnviando(false);
    if (ok) cerrar();
    else setModo('detalle');
  };

  const confirmarRechazar = async () => {
    setEnviando(true);
    const ok = await onRechazar(c, motivo.trim());
    setEnviando(false);
    if (ok) cerrar();
  };

  const titulo =
    modo === 'aprobar' ? 'Aprobar pago' : modo === 'rechazar' ? 'Rechazar comprobante' : `Comprobante ${c.numero}`;

  return (
    <Modal open onClose={cerrar} title={titulo} wide>
      {modo === 'detalle' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <EstadoBadge estado={c.estado} />
            <span className="text-sm text-ink-soft">
              Factura {c.factura.numero} · período {c.factura.periodo}
            </span>
          </div>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Dato label="Alumno">{c.alumno.nombre}</Dato>
            <Dato label="Curso">{c.alumno.curso}</Dato>
            <Dato label="Padre / tutor">{c.padre.nombre}</Dato>
            <Dato label="Total del comprobante">
              <strong>{formatearMonto(c.total)}</strong>
            </Dato>
          </dl>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Ítems incluidos</h3>
            <ul className="divide-y divide-blue-100 rounded-lg border border-blue-100">
              {c.items.map((it) => (
                <li key={it.cuotaId} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 break-words">{it.descripcion}</span>
                  <span className="shrink-0 font-medium">{formatearMonto(it.importe)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Transferencia</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Dato label="Monto transferido">
                <span className={montoDistinto ? 'rounded bg-coral/15 px-1.5 py-0.5 font-bold text-[#B23A16]' : ''}>
                  {formatearMonto(c.montoTransferido)}
                </span>
                {montoDistinto && (
                  <span className="mt-1 block text-xs font-semibold text-[#B23A16]">
                    No coincide con el total ({formatearMonto(c.total)}).
                  </span>
                )}
              </Dato>
              <Dato label="N.º de operación">{c.nroOperacion}</Dato>
              <Dato label="Fecha de transferencia">{c.fechaTransferencia && formatearFecha(c.fechaTransferencia)}</Dato>
              <Dato label="Cargada el">{c.cargadoEn && formatearFecha(c.cargadoEn)}</Dato>
              {c.estado === 'RECHAZADO' && <Dato label="Motivo del rechazo">{c.motivoRechazo}</Dato>}
              {c.revisadoEn && <Dato label="Revisada el">{formatearFecha(c.revisadoEn)}</Dato>}
            </dl>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={verArchivo} disabled={!c.tieneArchivo || abriendo} className={btnGhost}>
              <i className="fas fa-paperclip mr-1.5" />
              {abriendo ? 'Abriendo…' : 'Ver archivo'}
            </button>
            {!c.tieneArchivo && <span className="self-center text-xs text-ink-faint">Sin archivo</span>}
            <button type="button" onClick={verPdf} className={btnGhost}>
              <i className="fas fa-file-pdf mr-1.5" />
              PDF del comprobante
            </button>
          </div>

          {revisable && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-blue-100 pt-4">
              <button type="button" onClick={() => setModo('rechazar')} className={btnCoral}>
                Rechazar
              </button>
              <button type="button" onClick={() => setModo('aprobar')} className={btnPrimary}>
                Aprobar pago
              </button>
            </div>
          )}
        </div>
      )}

      {modo === 'aprobar' && (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Vas a acreditar este pago. La factura se recalcula y el padre recibe el aviso.
          </p>
          <dl className="grid grid-cols-1 gap-3 rounded-lg bg-blue-50 p-3 sm:grid-cols-2">
            <Dato label="Alumno">{c.alumno.nombre}</Dato>
            <Dato label="Comprobante">{c.numero}</Dato>
            <Dato label="Total a acreditar">
              <strong>{formatearMonto(c.total)}</strong>
            </Dato>
            <Dato label="Fecha de transferencia">{c.fechaTransferencia && formatearFecha(c.fechaTransferencia)}</Dato>
          </dl>
          {montoDistinto && (
            <p role="alert" className="rounded bg-coral/15 p-2 text-sm font-semibold text-[#B23A16]">
              El monto transferido ({formatearMonto(c.montoTransferido)}) no coincide con el total. Revisalo antes de
              aprobar.
            </p>
          )}
          <div>
            <label htmlFor="fecha-acreditacion" className="mb-1 block text-sm font-semibold text-ink">
              Fecha de acreditación
            </label>
            <input
              id="fecha-acreditacion"
              type="date"
              value={fecha}
              min={minFecha}
              max={hoy}
              onChange={(e) => setFecha(e.target.value)}
              className={`${inputCls} sm:max-w-[12rem]`}
            />
            <p className="mt-1 text-xs text-ink-faint">No puede ser futura ni anterior a la fecha de transferencia.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-blue-100 pt-4">
            <button type="button" onClick={() => setModo('detalle')} disabled={enviando} className={btnGhost}>
              Volver
            </button>
            <button type="button" onClick={confirmarAprobar} disabled={!fechaOk || enviando} className={btnPrimary}>
              {enviando ? 'Aprobando…' : 'Confirmar aprobación'}
            </button>
          </div>
        </div>
      )}

      {modo === 'rechazar' && (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Comprobante {c.numero} de {c.alumno.nombre} por {formatearMonto(c.total)}.
          </p>
          <div>
            <label htmlFor="motivo-rechazo" className="mb-1 block text-sm font-semibold text-ink">
              Motivo del rechazo
            </label>
            <textarea
              id="motivo-rechazo"
              rows={4}
              maxLength={MOTIVO_MAX}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              aria-describedby="motivo-ayuda"
              className={inputCls}
            />
            <div id="motivo-ayuda" className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-ink-faint">
              <span>El padre va a recibir este motivo y tendrá que generar un comprobante nuevo.</span>
              <span className={motivoLen > 0 && motivoLen < MOTIVO_MIN ? 'font-semibold text-[#B23A16]' : ''}>
                {motivoLen}/{MOTIVO_MAX} (mínimo {MOTIVO_MIN})
              </span>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-blue-100 pt-4">
            <button type="button" onClick={() => setModo('detalle')} disabled={enviando} className={btnGhost}>
              Volver
            </button>
            <button type="button" onClick={confirmarRechazar} disabled={!motivoOk || enviando} className={btnCoral}>
              {enviando ? 'Rechazando…' : 'Rechazar comprobante'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
