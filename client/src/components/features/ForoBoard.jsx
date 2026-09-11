import { useEffect, useState } from 'react';
import { forumService } from '../../services/api/forumService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

const ROLE_COLOR = { ESTUDIANTE: '#10b981', DOCENTE: '#3498db', PADRE: '#f59e0b', ADMIN: '#8b5cf6' };

function formatFecha(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ForoBoard({ canCreate = true }) {
  const { user } = useAuth();
  const toast = useToast();
  const [posts, setPosts] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ materia: '', titulo: '', contenido: '' });
  const [reply, setReply] = useState('');

  const canPin = user?.tipo === 'docente' || user?.tipo === 'admin';

  const load = async () => {
    const data = await forumService.list();
    setPosts(data.exito ? data.posts : []);
  };

  const openPost = async (id) => {
    const data = await forumService.get(id);
    if (data.exito) setSelected(data);
  };

  useEffect(() => {
    load();
  }, []);

  const submitPost = async (e) => {
    e.preventDefault();
    const res = await forumService.create(form);
    if (res.exito) {
      toast.success('Tema publicado.');
      setForm({ materia: '', titulo: '', contenido: '' });
      load();
    } else {
      toast.error(res.mensaje || 'No se pudo publicar.');
    }
  };

  const submitReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    const res = await forumService.reply(selected.post.id, reply);
    if (res.exito) {
      setReply('');
      openPost(selected.post.id);
    } else {
      toast.error(res.mensaje || 'No se pudo responder.');
    }
  };

  const togglePin = async () => {
    const res = await forumService.togglePin(selected.post.id);
    if (res.exito) {
      toast.success(res.isPinned ? 'Tema fijado.' : 'Tema desfijado.');
      openPost(selected.post.id);
      load();
    }
  };

  if (selected) {
    const { post, respuestas } = selected;
    return (
      <div>
        <button onClick={() => setSelected(null)} className="mb-4 rounded bg-slate-500 px-3 py-1.5 text-sm text-white">
          <i className="fas fa-arrow-left" /> Volver
        </button>
        <div className="rounded-lg border-l-4 p-4" style={{ borderColor: ROLE_COLOR[post.autorRol] }}>
          <h3 className="font-bold">
            {post.isPinned && <i className="fas fa-thumbtack mr-1 text-amber-500" />}
            {post.titulo}
          </h3>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
            <span><i className="fas fa-book" /> {post.materia}</span>
            <span><i className="fas fa-user" /> {post.autor} ({post.autorRol})</span>
            <span><i className="fas fa-clock" /> {formatFecha(post.createdAt)}</span>
          </div>
          <p className="mt-2 text-sm">{post.contenido}</p>
          {canPin && (
            <button onClick={togglePin} className="mt-3 rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
              <i className="fas fa-thumbtack" /> {post.isPinned ? 'Desfijar' : 'Fijar'}
            </button>
          )}
        </div>

        <h4 className="mb-2 mt-5 font-semibold text-slate-600 dark:text-slate-300">Respuestas ({respuestas.length})</h4>
        <div className="flex flex-col gap-2">
          {respuestas.map((r) => (
            <div key={r.id} className="rounded-lg border-l-2 p-3 text-sm" style={{ borderColor: ROLE_COLOR[r.autorRol] }}>
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span><strong>{r.autor}</strong> ({r.autorRol})</span>
                <span>{formatFecha(r.createdAt)}</span>
              </div>
              {r.contenido}
            </div>
          ))}
        </div>

        <form onSubmit={submitReply} className="mt-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Escribí tu respuesta…"
            rows={3}
            required
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-white">
            <i className="fas fa-paper-plane" /> Responder
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      {canCreate && (
        <details className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <summary className="cursor-pointer font-semibold"><i className="fas fa-plus-circle text-accent" /> Abrir un tema</summary>
          <form onSubmit={submitPost} className="mt-3 flex flex-col gap-2.5">
            <input
              value={form.materia}
              onChange={(e) => setForm({ ...form, materia: e.target.value })}
              placeholder="Materia / canal"
              required
              className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Título"
              required
              className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <textarea
              value={form.contenido}
              onChange={(e) => setForm({ ...form, contenido: e.target.value })}
              placeholder="Contenido inicial…"
              rows={3}
              required
              className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <button type="submit" className="self-end rounded bg-accent px-4 py-2 text-sm font-semibold text-white">
              Publicar
            </button>
          </form>
        </details>
      )}

      {posts === null && <p className="text-center text-slate-400">Cargando temas…</p>}
      {posts?.length === 0 && <p className="text-center text-slate-400">Sin temas todavía. Abrí el primero.</p>}
      <div className="flex flex-col gap-3">
        {posts?.map((p) => (
          <div
            key={p.id}
            onClick={() => openPost(p.id)}
            className="cursor-pointer rounded-lg border-l-4 p-4 shadow-sm hover:shadow"
            style={{ borderColor: ROLE_COLOR[p.autorRol] }}
          >
            <h4 className="font-bold">
              {p.isPinned && <i className="fas fa-thumbtack mr-1 text-amber-500" />}
              {p.titulo}
            </h4>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
              <span><i className="fas fa-book" /> {p.materia}</span>
              <span><i className="fas fa-user" /> {p.autor}</span>
              <span><i className="fas fa-comments" /> {p.replies} respuestas</span>
              <span><i className="fas fa-clock" /> {formatFecha(p.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
