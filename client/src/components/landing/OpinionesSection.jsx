import { useEffect, useState } from 'react';
import { moderationService } from '../../services/api/moderationService';
import { useToast } from '../../hooks/useToast';
import StarRating from '../ui/StarRating';

export default function OpinionesSection() {
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('Padre/Madre');
  const [texto, setTexto] = useState('');
  const [rating, setRating] = useState(5);
  const [opiniones, setOpiniones] = useState([]);

  useEffect(() => {
    moderationService.listApprovedOpinions().then((data) => data.exito && setOpiniones(data.opiniones));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!texto.trim()) {
      toast.warning('Escribí tu opinión antes de enviar.');
      return;
    }
    const res = await moderationService.sendOpinion({ nombre: nombre || null, rol, texto, rating });
    if (res.exito) {
      toast.success(res.mensaje || '¡Gracias por compartir tu opinión!');
      setTexto('');
      setRating(5);
    } else {
      toast.error(res.mensaje || 'No se pudo enviar la opinión.');
    }
  };

  return (
    <section id="opiniones" className="bg-slate-50 px-6 py-16 dark:bg-slate-900/40">
      <h2 className="mb-8 text-center text-3xl font-bold">Deja tu opinión</h2>
      <form onSubmit={submit} className="mx-auto flex max-w-lg flex-col gap-3">
        <input
          placeholder="Nombre (opcional)"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        />
        <select value={rol} onChange={(e) => setRol(e.target.value)} className="rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800">
          <option>Padre/Madre</option>
          <option>Estudiante</option>
          <option>Docente</option>
          <option>Otro</option>
        </select>
        <textarea
          required
          placeholder="Tu opinión…"
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        />
        <StarRating value={rating} onChange={setRating} />
        <button type="submit" className="rounded-lg bg-accent py-2.5 font-semibold text-white">
          Enviar opinión
        </button>
      </form>

      {opiniones.length > 0 && (
        <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
          {opiniones.map((o) => (
            <div key={o.id} className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{o.nombre || 'Anónimo'}</span>
                <span className="text-amber-400">{'★'.repeat(o.rating)}{'☆'.repeat(5 - o.rating)}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">"{o.texto}"</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
