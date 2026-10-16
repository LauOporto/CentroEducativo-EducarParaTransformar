import { useState } from 'react';
import { auditoriaService } from '../../services/api/auditoriaService';

const ACCION_LABEL = { ALTA: 'Alta', MODIFICACION: 'Modificación', BAJA: 'Baja' };

function formatFecha(iso) {
  return new Date(iso).toLocaleString('es-AR');
}

// Historial de alta/modificación/baja para una sección puntual del admin
// (Docentes pendientes, Inscripciones, Opiniones, Empleo), reutilizando
// el mismo log de auditoría que ya existe para RNF-46 — misma estructura
// para las 4, como se pidió, en vez de 4 implementaciones separadas.
export default function HistorialPanel({ entidad }) {
  const [abierto, setAbierto] = useState(false);
  const [registros, setRegistros] = useState(null);

  const toggle = async () => {
    if (!abierto) {
      // Siempre refresca al abrir: otro alta/baja pudo haber pasado
      // desde la última vez (ej. recién aprobar un docente).
      const data = await auditoriaService.list(entidad);
      setRegistros(data.exito ? data.registros : []);
    }
    setAbierto((v) => !v);
  };

  return (
    <div className="mb-4">
      <button
        onClick={toggle}
        className="rounded bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white"
      >
        <i className={`fas fa-chevron-${abierto ? 'up' : 'down'}`} /> {abierto ? 'Ocultar' : 'Ver'} historial
      </button>
      {abierto && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded border border-blue-100 dark:border-slate-700">
          {registros === null && <p className="p-3 text-sm text-ink-faint">Cargando…</p>}
          {registros?.length === 0 && <p className="p-3 text-sm text-ink-faint">Sin movimientos registrados.</p>}
          {registros?.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-blue-100 px-3 py-2 text-sm last:border-0 dark:border-slate-800">
              <span>
                <b>{ACCION_LABEL[r.accion] ?? r.accion}</b> — {r.detalle || `#${r.entidadId}`}
                <span className="ml-2 text-xs text-ink-faint">por {r.usuario}</span>
              </span>
              <span className="text-xs text-ink-faint">{formatFecha(r.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
