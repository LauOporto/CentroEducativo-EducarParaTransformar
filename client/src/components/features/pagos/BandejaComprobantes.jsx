import { useCallback, useEffect, useRef, useState } from 'react';
import EstadoBadge from './EstadoBadge';
import DetalleComprobanteModal from './DetalleComprobanteModal';
import { pagosAdminService } from '../../../services/api/pagosAdminService';
import { useToast } from '../../../hooks/useToast';
import { ESTADOS_COMPROBANTE, formatearFecha, formatearMonto } from '../../../domain/pagos';

const LIMITE = 20;
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1';
const inputCls = `w-full sm:w-auto rounded border border-blue-200 bg-white p-2 text-sm ${focus}`;
const btnGhost = `rounded border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-blue-50 disabled:opacity-40 ${focus}`;

export default function BandejaComprobantes() {
  const toast = useToast();
  const [estado, setEstado] = useState('EN_REVISION');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [offset, setOffset] = useState(0);
  const [datos, setDatos] = useState(null); // { total, comprobantes }
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [seleccionadoId, setSeleccionadoId] = useState(null);
  const pedido = useRef(0);

  const cargar = useCallback(async () => {
    const n = ++pedido.current;
    setCargando(true);
    const res = await pagosAdminService.listarComprobantes({ estado, desde, hasta, limit: LIMITE, offset });
    if (n !== pedido.current) return null; // llegó una respuesta más nueva
    setCargando(false);
    if (res.exito) {
      setError('');
      setDatos({ total: res.total, comprobantes: res.comprobantes });
      return res.comprobantes;
    }
    setError(res.message || 'No se pudo cargar la bandeja.');
    return null;
  }, [estado, desde, hasta, offset]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiarFiltro = (setter) => (e) => {
    setter(e.target.value);
    setOffset(0);
  };

  const rangoInvalido = desde && hasta && desde > hasta;

  const seleccionado = datos?.comprobantes.find((c) => c.id === seleccionadoId) ?? null;

  // Después de cada acción se recarga; si el comprobante ya no está en la
  // lista (cambió de estado o lo revisó otro admin), el modal se cierra solo.
  const aprobar = async (c, fecha) => {
    const res = await pagosAdminService.aprobar(c.id, fecha);
    if (res.exito) {
      toast.success(
        `Pago acreditado: ${c.numero}. La factura quedó ${res.factura?.estado === 'PAGADA' ? 'pagada' : 'con pago parcial'}.`,
      );
    } else {
      toast.error(res.message || 'No se pudo aprobar el comprobante.');
    }
    await cargar();
    return !!res.exito;
  };

  const rechazar = async (c, motivo) => {
    const res = await pagosAdminService.rechazar(c.id, motivo);
    if (res.exito) toast.success(`Comprobante ${c.numero} rechazado. Se avisó al padre.`);
    else toast.error(res.message || 'No se pudo rechazar el comprobante.');
    await cargar();
    return !!res.exito;
  };

  const total = datos?.total ?? 0;
  const filas = datos?.comprobantes ?? [];
  const desdeN = total === 0 ? 0 : offset + 1;
  const hastaN = Math.min(offset + LIMITE, total);

  return (
    <div>
      <form className="mb-4 grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap" onSubmit={(e) => e.preventDefault()}>
        <div className="col-span-2 sm:col-auto">
          <label htmlFor="filtro-estado" className="mb-1 block text-xs font-semibold text-ink-soft">
            Estado
          </label>
          <select id="filtro-estado" value={estado} onChange={cambiarFiltro(setEstado)} className={inputCls}>
            {ESTADOS_COMPROBANTE.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filtro-desde" className="mb-1 block text-xs font-semibold text-ink-soft">
            Desde
          </label>
          <input
            id="filtro-desde"
            type="date"
            value={desde}
            max={hasta || undefined}
            onChange={cambiarFiltro(setDesde)}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="filtro-hasta" className="mb-1 block text-xs font-semibold text-ink-soft">
            Hasta
          </label>
          <input
            id="filtro-hasta"
            type="date"
            value={hasta}
            min={desde || undefined}
            onChange={cambiarFiltro(setHasta)}
            className={inputCls}
          />
        </div>
        {(desde || hasta) && (
          <button
            type="button"
            onClick={() => {
              setDesde('');
              setHasta('');
              setOffset(0);
            }}
            className={btnGhost}
          >
            Limpiar fechas
          </button>
        )}
        <button type="button" onClick={cargar} className={`${btnGhost} col-span-2 py-2 sm:col-auto sm:ml-auto`}>
          <i className="fas fa-rotate mr-1" /> Actualizar
        </button>
      </form>

      {rangoInvalido && (
        <p role="alert" className="mb-3 rounded bg-coral/15 p-2 text-sm text-[#B23A16]">
          La fecha “desde” no puede ser posterior a “hasta”.
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-coral/15 p-3 text-sm text-[#B23A16]"
        >
          <span>{error}</span>
          <button type="button" onClick={cargar} className={btnGhost}>
            Reintentar
          </button>
        </div>
      )}

      {!datos && cargando && (
        <p className="rounded-lg border border-blue-100 bg-white p-6 text-center text-sm text-ink-faint">Cargando…</p>
      )}

      {datos && filas.length === 0 && !error && (
        <div className="rounded-lg border border-blue-100 bg-white p-8 text-center">
          <i className="fas fa-inbox text-2xl text-blue-200" aria-hidden="true" />
          <p className="mt-2 text-sm text-ink-soft">
            {estado === 'EN_REVISION'
              ? 'No hay comprobantes en revisión.'
              : 'No hay comprobantes con ese estado y rango de fechas.'}
          </p>
        </div>
      )}

      {filas.length > 0 && (
        <>
          {/* Pantallas anchas: tabla compacta (número+factura y operación+fecha comparten celda) */}
          <div className="hidden overflow-x-auto rounded-lg border border-blue-100 bg-white xl:block">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Comprobantes de pago</caption>
              <thead>
                <tr className="bg-blue-50 text-left text-ink-soft">
                  {[
                    'N.º y factura',
                    'Alumno y curso',
                    'Padre',
                    'Total',
                    'Transferido',
                    'Operación y fecha',
                    'Estado',
                    '',
                  ].map((h, i) => (
                    <th
                      key={i}
                      scope="col"
                      className="whitespace-nowrap border-b border-blue-100 px-2.5 py-2.5 font-semibold"
                    >
                      {h || <span className="sr-only">Acciones</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((c) => {
                  const distinto = c.montoTransferido !== null && Number(c.montoTransferido) !== Number(c.total);
                  return (
                    <tr key={c.id} className="border-b border-blue-100 last:border-0">
                      <td className="whitespace-nowrap px-2.5 py-2.5">
                        <div className="font-medium">{c.numero}</div>
                        <div className="text-xs text-ink-faint">
                          {c.factura.numero} · {c.factura.periodo}
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <div className="font-medium">{c.alumno.nombre}</div>
                        <div className="text-xs text-ink-faint">{c.alumno.curso}</div>
                      </td>
                      <td className="px-2.5 py-2.5">{c.padre.nombre}</td>
                      <td className="whitespace-nowrap px-2.5 py-2.5 font-medium">{formatearMonto(c.total)}</td>
                      <td className={`whitespace-nowrap px-2.5 py-2.5 ${distinto ? 'font-bold text-[#B23A16]' : ''}`}>
                        {formatearMonto(c.montoTransferido)}
                        {distinto && (
                          <i
                            className="fas fa-triangle-exclamation ml-1"
                            title="No coincide con el total"
                            aria-label="No coincide con el total"
                          />
                        )}
                      </td>
                      <td className="px-2.5 py-2.5">
                        <div className="max-w-[9.5rem] break-all">{c.nroOperacion || '—'}</div>
                        <div className="text-xs text-ink-faint">{formatearFecha(c.fechaTransferencia)}</div>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <EstadoBadge estado={c.estado} />
                      </td>
                      <td className="px-2.5 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSeleccionadoId(c.id)}
                          className={btnGhost}
                          aria-label={`Ver detalle del comprobante ${c.numero}`}
                        >
                          Detalle
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tablet y móvil: tarjetas */}
          <ul className="grid gap-3 sm:grid-cols-2 xl:hidden">
            {filas.map((c) => {
              const distinto = c.montoTransferido !== null && Number(c.montoTransferido) !== Number(c.total);
              return (
                <li key={c.id} className="rounded-lg border border-blue-100 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{c.numero}</p>
                      <p className="text-sm">{c.alumno.nombre}</p>
                      <p className="text-xs text-ink-faint">{c.alumno.curso}</p>
                    </div>
                    <EstadoBadge estado={c.estado} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-ink-faint">Padre</dt>
                      <dd className="break-words">{c.padre.nombre}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-faint">Factura</dt>
                      <dd>
                        {c.factura.numero} · {c.factura.periodo}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-faint">Total</dt>
                      <dd className="font-medium">{formatearMonto(c.total)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-faint">Transferido</dt>
                      <dd className={distinto ? 'font-bold text-[#B23A16]' : ''}>
                        {formatearMonto(c.montoTransferido)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-faint">N.º operación</dt>
                      <dd className="break-all">{c.nroOperacion || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-faint">Fecha transf.</dt>
                      <dd>{formatearFecha(c.fechaTransferencia)}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => setSeleccionadoId(c.id)}
                    className={`${btnGhost} mt-3 w-full py-2`}
                    aria-label={`Ver detalle del comprobante ${c.numero}`}
                  >
                    Ver detalle
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-soft">
            <span aria-live="polite">
              Mostrando {desdeN}–{hastaN} de {total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={offset === 0 || cargando}
                onClick={() => setOffset(Math.max(0, offset - LIMITE))}
                className={btnGhost}
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={offset + LIMITE >= total || cargando}
                onClick={() => setOffset(offset + LIMITE)}
                className={btnGhost}
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}

      {seleccionado && (
        <DetalleComprobanteModal
          key={seleccionado.id}
          comprobante={seleccionado}
          onClose={() => setSeleccionadoId(null)}
          onAprobar={aprobar}
          onRechazar={rechazar}
        />
      )}
    </div>
  );
}
