import { useEffect, useState } from 'react';
import { noticiasService } from '../../services/api/contenidoService';
import { useToast } from '../../hooks/useToast';

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

const vacia = () => ({ titulo: '', resumen: '', contenido: '', imagenUrl: '', fecha: hoy(), publicada: true });

const inputCls = 'w-full rounded border border-blue-200 p-2 text-sm dark:border-slate-600 dark:bg-slate-900';
const labelCls = 'mb-1 block text-xs font-semibold text-ink-faint';

// Parte 1 — alta, edición y baja de las noticias del sitio público.
export default function NoticiasPage() {
  const toast = useToast();
  const [noticias, setNoticias] = useState(null);
  const [form, setForm] = useState(vacia());
  const [editId, setEditId] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    const data = await noticiasService.listAdmin();
    setNoticias(data.exito ? data.noticias : []);
  };

  useEffect(() => {
    cargar();
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const cancelar = () => {
    setEditId(null);
    setForm(vacia());
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const res = editId ? await noticiasService.update(editId, form) : await noticiasService.create(form);
      if (res.exito) {
        toast.success(editId ? 'Noticia actualizada.' : 'Noticia publicada.');
        cancelar();
        cargar();
      } else {
        toast.error(res.message || res.mensaje || 'No se pudo guardar la noticia.');
      }
    } finally {
      setGuardando(false);
    }
  };

  const editar = (n) => {
    setEditId(n.id);
    setForm({
      titulo: n.titulo,
      resumen: n.resumen,
      contenido: n.contenido,
      imagenUrl: n.imagenUrl ?? '',
      fecha: n.fecha,
      publicada: n.publicada,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const eliminar = async (n) => {
    if (!window.confirm(`¿Eliminar la noticia "${n.titulo}"? No se puede deshacer.`)) return;
    const res = await noticiasService.remove(n.id);
    if (res.exito) {
      toast.success('Noticia eliminada.');
      if (editId === n.id) cancelar();
      cargar();
    } else {
      toast.error(res.message || res.mensaje || 'No se pudo eliminar.');
    }
  };

  const alternarPublicada = async (n) => {
    const res = await noticiasService.update(n.id, { ...n, imagenUrl: n.imagenUrl ?? '', publicada: !n.publicada });
    if (res.exito) {
      toast.success(n.publicada ? 'La noticia quedó oculta.' : 'La noticia quedó publicada.');
      cargar();
    } else {
      toast.error(res.message || res.mensaje || 'No se pudo actualizar.');
    }
  };

  return (
    <div>
      <h3 className="mb-4 border-b border-blue-100 pb-3 text-xl font-bold dark:border-slate-700">Noticias del sitio</h3>

      <form
        onSubmit={guardar}
        className="mb-8 grid gap-3 rounded-lg border border-blue-100 p-4 sm:grid-cols-2 dark:border-slate-700"
      >
        <h4 className="font-semibold sm:col-span-2">{editId ? 'Editar noticia' : 'Nueva noticia'}</h4>
        <div className="sm:col-span-2">
          <label htmlFor="n-titulo" className={labelCls}>
            Título
          </label>
          <input
            id="n-titulo"
            required
            minLength={3}
            maxLength={120}
            value={form.titulo}
            onChange={set('titulo')}
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="n-resumen" className={labelCls}>
            Resumen (se muestra en la tarjeta)
          </label>
          <input
            id="n-resumen"
            required
            minLength={10}
            maxLength={280}
            value={form.resumen}
            onChange={set('resumen')}
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="n-contenido" className={labelCls}>
            Contenido completo
          </label>
          <textarea
            id="n-contenido"
            required
            minLength={10}
            maxLength={5000}
            rows={5}
            value={form.contenido}
            onChange={set('contenido')}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="n-fecha" className={labelCls}>
            Fecha
          </label>
          <input id="n-fecha" required type="date" value={form.fecha} onChange={set('fecha')} className={inputCls} />
        </div>
        <div>
          <label htmlFor="n-imagen" className={labelCls}>
            Imagen (URL, opcional)
          </label>
          <input
            id="n-imagen"
            type="url"
            placeholder="https://…"
            value={form.imagenUrl}
            onChange={set('imagenUrl')}
            className={inputCls}
          />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={form.publicada} onChange={set('publicada')} /> Publicada (visible en el sitio)
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={guardando}
            className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <i className="fas fa-save" /> {editId ? 'Guardar cambios' : 'Publicar'}
          </button>
          {editId && (
            <button type="button" onClick={cancelar} className="rounded bg-blue-500 px-4 py-2 text-sm text-white">
              Cancelar
            </button>
          )}
        </div>
      </form>

      {noticias === null && <p className="text-sm text-ink-faint">Cargando…</p>}
      {noticias?.length === 0 && <p className="text-sm text-ink-faint">Todavía no hay noticias.</p>}
      <ul className="flex flex-col gap-3">
        {noticias?.map((n) => (
          <li
            key={n.id}
            className="flex flex-col gap-3 rounded-lg border border-blue-100 p-4 sm:flex-row sm:items-start sm:justify-between dark:border-slate-700"
          >
            <div className="min-w-0">
              <p className="text-xs text-ink-faint">
                {n.fecha.split('-').reverse().join('/')} ·{' '}
                <span className={n.publicada ? 'text-teal' : 'text-coral'}>{n.publicada ? 'Publicada' : 'Oculta'}</span>
              </p>
              <p className="font-semibold">{n.titulo}</p>
              <p className="text-sm text-ink-soft">{n.resumen}</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={() => alternarPublicada(n)}
                className="rounded bg-blue-50 px-2.5 py-1.5 text-xs text-ink-soft"
              >
                {n.publicada ? 'Ocultar' : 'Publicar'}
              </button>
              <button onClick={() => editar(n)} className="rounded bg-blue-500 px-2.5 py-1.5 text-xs text-white">
                Editar
              </button>
              <button onClick={() => eliminar(n)} className="rounded bg-red-500 px-2.5 py-1.5 text-xs text-white">
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
