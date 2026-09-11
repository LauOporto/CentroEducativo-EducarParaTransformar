import { useState } from 'react';
import { moderationService } from '../../services/api/moderationService';
import { useToast } from '../../hooks/useToast';

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
    <section id="empleo" className="mx-auto max-w-lg px-6 py-16">
      <h2 className="mb-8 text-center text-3xl font-bold">Empleo</h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          required
          placeholder="Nombre completo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        />
        <select
          required
          value={puesto}
          onChange={(e) => setPuesto(e.target.value)}
          className="rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        >
          <option value="">Puesto de interés…</option>
          <option value="Docente">Docente</option>
          <option value="Administrativo">Administrativo</option>
          <option value="Mantenimiento">Mantenimiento</option>
        </select>
        <input type="file" accept=".pdf" onChange={(e) => setCv(e.target.files[0])} className="text-sm" />
        <button type="submit" className="rounded-lg bg-accent py-2.5 font-semibold text-white">
          Enviar postulación
        </button>
      </form>
    </section>
  );
}
