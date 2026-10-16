import { useState } from 'react';
import { moderationService } from '../../services/api/moderationService';
import { useToast } from '../../hooks/useToast';

const CURSOS_POR_NIVEL = {
  Inicial: ['Sala de 3', 'Sala de 4', 'Sala de 5'],
  Primario: ['1° grado', '2° grado', '3° grado', '4° grado', '5° grado', '6° grado'],
  Secundario: ['1° año', '2° año', '3° año', '4° año', '5° año'],
};

const EMPTY = { nombreTutor: '', emailTutor: '', telefonoTutor: '', nombreEstudiante: '', nivel: '', curso: '', mensaje: '' };

const campo = 'w-full rounded border border-blue-200 bg-white px-4 py-3 text-ink placeholder:text-ink-faint focus:border-blue-500';

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
    <section id="inscripcion" className="border-y border-blue-100 bg-blue-50">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="max-w-md">
            <div className="mb-5 h-1 w-14 rounded-full bg-blue-500" />
            <h2 className="font-display text-3xl text-ink sm:text-4xl">Solicitá la inscripción</h2>
            <p className="mt-5 text-lg leading-relaxed text-ink-soft">
              Contanos un poco sobre tu familia y te vamos a contactar para avanzar con el proceso de admisión.
            </p>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <input required placeholder="Nombre del padre, madre o tutor" value={form.nombreTutor} onChange={(e) => setForm({ ...form, nombreTutor: e.target.value })} className={campo} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input required type="email" placeholder="Email" value={form.emailTutor} onChange={(e) => setForm({ ...form, emailTutor: e.target.value })} className={campo} />
              <input required placeholder="Teléfono" value={form.telefonoTutor} onChange={(e) => setForm({ ...form, telefonoTutor: e.target.value })} className={campo} />
            </div>
            <input required placeholder="Nombre del estudiante" value={form.nombreEstudiante} onChange={(e) => setForm({ ...form, nombreEstudiante: e.target.value })} className={campo} />
            <div className="grid gap-3 sm:grid-cols-2">
              <select required value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value, curso: '' })} className={campo}>
                <option value="">Nivel educativo…</option>
                {Object.keys(CURSOS_POR_NIVEL).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <select required disabled={!form.nivel} value={form.curso} onChange={(e) => setForm({ ...form, curso: e.target.value })} className={`${campo} disabled:bg-blue-50 disabled:text-ink-faint`}>
                <option value="">{form.nivel ? 'Curso / año…' : 'Elegí un nivel primero'}</option>
                {cursos.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <textarea placeholder="Comentario adicional (opcional)" rows={3} value={form.mensaje} onChange={(e) => setForm({ ...form, mensaje: e.target.value })} className={campo} />
            <button type="submit" className="mt-2 self-start rounded bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-600">
              Enviar solicitud
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
