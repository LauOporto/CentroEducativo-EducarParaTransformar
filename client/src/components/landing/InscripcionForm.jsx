import { useState } from 'react';
import { moderationService } from '../../services/api/moderationService';
import { useToast } from '../../hooks/useToast';

const CURSOS_POR_NIVEL = {
  Inicial: ['Sala de 3', 'Sala de 4', 'Sala de 5'],
  Primario: ['1° grado', '2° grado', '3° grado', '4° grado', '5° grado', '6° grado'],
  Secundario: ['1° año', '2° año', '3° año', '4° año', '5° año'],
};

const EMPTY = { nombreTutor: '', emailTutor: '', telefonoTutor: '', nombreEstudiante: '', nivel: '', curso: '', mensaje: '' };

export default function InscripcionForm() {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);

  const cursos = CURSOS_POR_NIVEL[form.nivel] ?? [];

  const submit = async (e) => {
    e.preventDefault();
    const res = await moderationService.sendInscription(form);
    if (res.exito) {
      toast.success(res.mensaje || 'Solicitud enviada.');
      setForm(EMPTY);
    } else {
      toast.error(res.mensaje || 'No se pudo enviar la solicitud.');
    }
  };

  return (
    <section id="inscripcion" className="bg-slate-50 px-6 py-16 dark:bg-slate-900/40">
      <h2 className="mb-8 text-center text-3xl font-bold">Solicitud de Inscripción</h2>
      <form onSubmit={submit} className="mx-auto flex max-w-lg flex-col gap-3">
        <input
          required
          placeholder="Nombre del padre/madre/tutor"
          value={form.nombreTutor}
          onChange={(e) => setForm({ ...form, nombreTutor: e.target.value })}
          className="rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={form.emailTutor}
          onChange={(e) => setForm({ ...form, emailTutor: e.target.value })}
          className="rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          required
          placeholder="Teléfono"
          value={form.telefonoTutor}
          onChange={(e) => setForm({ ...form, telefonoTutor: e.target.value })}
          className="rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          required
          placeholder="Nombre del estudiante"
          value={form.nombreEstudiante}
          onChange={(e) => setForm({ ...form, nombreEstudiante: e.target.value })}
          className="rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        />
        <select
          required
          value={form.nivel}
          onChange={(e) => setForm({ ...form, nivel: e.target.value, curso: '' })}
          className="rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        >
          <option value="">Nivel educativo…</option>
          {Object.keys(CURSOS_POR_NIVEL).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <select
          required
          disabled={!form.nivel}
          value={form.curso}
          onChange={(e) => setForm({ ...form, curso: e.target.value })}
          className="rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:disabled:bg-slate-900"
        >
          <option value="">{form.nivel ? 'Curso / año…' : 'Elegí un nivel primero'}</option>
          {cursos.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <textarea
          placeholder="Comentario adicional (opcional)"
          rows={3}
          value={form.mensaje}
          onChange={(e) => setForm({ ...form, mensaje: e.target.value })}
          className="rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        />
        <button type="submit" className="rounded-lg bg-accent py-2.5 font-semibold text-white">
          Enviar solicitud
        </button>
      </form>
    </section>
  );
}
