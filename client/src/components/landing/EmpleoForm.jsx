import { useState } from 'react';
import { moderationService } from '../../services/api/moderationService';
import { useToast } from '../../hooks/useToast';

const campo = 'w-full rounded border border-blue-200 bg-white px-4 py-3 text-ink placeholder:text-ink-faint focus:border-blue-500';

export default function EmpleoForm() {
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [puesto, setPuesto] = useState('');
  const [cv, setCv] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('nombre', nombre);
    fd.append('email', email);
    fd.append('puesto', puesto);
    if (cv) fd.append('cv', cv);
    const res = await moderationService.sendEmployment(fd);
    if (res.exito) {
      toast.success(res.mensaje || 'Postulación enviada.');
      setNombre('');
      setEmail('');
      setPuesto('');
      setCv(null);
      e.target.reset();
    } else {
      toast.error(res.mensaje || 'No se pudo enviar la postulación.');
    }
  };

  return (
    <section id="empleo" className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="max-w-md">
          <div className="mb-5 h-1 w-14 rounded-full bg-coral" />
          <h2 className="font-display text-3xl text-ink sm:text-4xl">Trabajá con nosotros</h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            Buscamos docentes, personal administrativo y de mantenimiento que quieran sumarse a este proyecto desde
            el inicio.
          </p>
        </div>

        <form onSubmit={submit} className="flex max-w-lg flex-col gap-3">
          <input required placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} />
          <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
          <select required value={puesto} onChange={(e) => setPuesto(e.target.value)} className={campo}>
            <option value="">Puesto de interés…</option>
            <option value="Docente">Docente</option>
            <option value="Administrativo">Administrativo</option>
            <option value="Mantenimiento">Mantenimiento</option>
          </select>
          <label className="text-sm text-ink-soft">
            Currículum (PDF, opcional)
            <input type="file" accept=".pdf" onChange={(e) => setCv(e.target.files[0])} className="mt-1.5 block text-sm" />
          </label>
          <button type="submit" className="mt-2 self-start rounded bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-600">
            Enviar postulación
          </button>
        </form>
      </div>
    </section>
  );
}
