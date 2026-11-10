import { useEffect, useState } from 'react';
import { consultasService } from '../../services/api/contenidoService';
import { useToast } from '../../hooks/useToast';

const FILTROS = [
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'respondidas', label: 'Respondidas' },
  { key: '', label: 'Todas' },
];

const fechaHora = (iso) =>
  new Date(iso).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    dateStyle: 'short',
    timeStyle: 'short',
  });

// Parte 1 — consultas que llegan por el formulario de contacto del sitio.
export default function ConsultasPage() {
  const toast = useToast();
  const [filtro, setFiltro] = useState('pendientes');
  const [consultas, setConsultas] = useState(null);

  const cargar = async (f = filtro) => {
    setConsultas(null);
    const data = await consultasService.list(f);
    setConsultas(data.exito ? data.consultas : []);
  };

  useEffect(() => {
    cargar(filtro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  const marcar = async (c) => {
    const res = await consultasService.marcar(c.id, !c.respondida);
    if (res.exito) {
      toast.success(c.respondida ? 'Marcada como pendiente.' : 'Marcada como respondida.');
      cargar();
    } else {
      toast.error(res.message || res.mensaje || 'No se pudo actualizar.');
    }
  };

  const eliminar = async (c) => {
    if (!window.confirm(`¿Eliminar la consulta de ${c.nombre}?`)) return;
    const res = await consultasService.remove(c.id);
    if (res.exito) {
      toast.success('Consulta eliminada.');
      cargar();
    } else {
      toast.error(res.message || res.mensaje || 'No se pudo eliminar.');
    }
  };

  return (
    <div>
      <h3 className="mb-4 border-b border-blue-100 pb-3 text-xl font-bold dark:border-slate-700">
        Consultas del sitio web
      </h3>
      <p className="mb-4 text-sm text-ink-faint">
        Cada consulta también llega por mail a la casilla del colegio. Respondé desde tu correo y marcala como
        respondida.
      </p>

      <div className="mb-4 flex gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.key || 'todas'}
            onClick={() => setFiltro(f.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              filtro === f.key
                ? 'bg-accent text-white'
                : 'bg-blue-50 text-ink-soft dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {consultas === null && <p className="text-sm text-ink-faint">Cargando…</p>}
      {consultas?.length === 0 && <p className="text-sm text-ink-faint">No hay consultas en esta bandeja.</p>}
      <ul className="flex flex-col gap-3">
        {consultas?.map((c) => (
          <li key={c.id} className="rounded-lg border border-blue-100 p-4 dark:border-slate-700">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs text-ink-faint">
                  #{c.id} · {fechaHora(c.createdAt)} ·{' '}
                  <span className={c.respondida ? 'text-teal' : 'text-coral'}>
                    {c.respondida ? 'Respondida' : 'Pendiente'}
                  </span>
                </p>
                <p className="font-semibold">{c.asunto}</p>
                <p className="text-sm text-ink-soft">
                  {c.nombre} ·{' '}
                  <a
                    href={`mailto:${c.email}?subject=${encodeURIComponent(`Re: ${c.asunto}`)}`}
                    className="text-blue-500 hover:underline"
                  >
                    {c.email}
                  </a>
                  {c.telefono && <> · {c.telefono}</>}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button onClick={() => marcar(c)} className="rounded bg-accent px-2.5 py-1.5 text-xs text-white">
                  {c.respondida ? 'Marcar pendiente' : 'Marcar respondida'}
                </button>
                <button onClick={() => eliminar(c)} className="rounded bg-red-500 px-2.5 py-1.5 text-xs text-white">
                  Eliminar
                </button>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm">{c.mensaje}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
