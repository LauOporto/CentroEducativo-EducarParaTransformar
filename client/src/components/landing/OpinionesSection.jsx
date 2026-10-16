import { useEffect, useState } from 'react';
import { moderationService } from '../../services/api/moderationService';
import { useToast } from '../../hooks/useToast';
import StarRating from '../ui/StarRating';

const campo = 'w-full rounded border border-blue-200 bg-white px-4 py-3 text-ink placeholder:text-ink-faint focus:border-blue-500';

export default function OpinionesSection() {
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [identificacion, setIdentificacion] = useState('');
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
    if (!identificacion.trim()) {
      toast.warning('Ingresá un dato que te identifique (DNI o email).');
      return;
    }
    const res = await moderationService.sendOpinion({ nombre: nombre || null, identificacion, rol, texto, rating });
    if (res.exito) {
      toast.success(res.mensaje || '¡Gracias por compartir tu opinión!');
      setTexto('');
      setIdentificacion('');
      setRating(5);
    } else {
      toast.error(res.mensaje || 'No se pudo enviar la opinión.');
    }
  };

  return (
    <section id="opiniones" className="border-y border-blue-100 bg-blue-50">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="mb-5 h-1 w-14 rounded-full bg-magenta" />
            <h2 className="font-display text-3xl text-ink sm:text-4xl">Lo que dicen las familias</h2>

            {opiniones.length > 0 && (
              <div className="mt-10 flex flex-col gap-8">
                {opiniones.map((o) => (
                  <figure key={o.id}>
                    <span className="font-display text-4xl leading-none text-blue-200">&ldquo;</span>
                    <blockquote className="-mt-3 text-ink">{o.texto}</blockquote>
                    <figcaption className="mt-2 text-sm text-ink-faint">
                      {o.nombre || 'Anónimo'} · {o.rol}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={submit} className="flex max-w-lg flex-col gap-3">
            <input placeholder="Nombre (opcional)" value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} />
            <input required placeholder="DNI o email (para identificarte)" value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} className={campo} />
            <select value={rol} onChange={(e) => setRol(e.target.value)} className={campo}>
              <option>Padre/Madre</option>
              <option>Estudiante</option>
              <option>Docente</option>
              <option>Otro</option>
            </select>
            <textarea required placeholder="Tu opinión…" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} className={campo} />
            <StarRating value={rating} onChange={setRating} />
            <button type="submit" className="mt-2 self-start rounded bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-600">
              Enviar opinión
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
