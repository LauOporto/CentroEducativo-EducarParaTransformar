import { useEffect, useState } from 'react';
import { studyPlansService } from '../../services/api/studyPlansService';
import { materiasService } from '../../services/api/materiasService';
import { useToast } from '../../hooks/useToast';

const EMPTY = { materia: '', titulo: '', objetivos: '', contenidos: '' };

export default function StudyPlanForm({ onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  // Solo las materias que el profesor tiene asignadas (el backend lo exige).
  const [materias, setMaterias] = useState([]);

  useEffect(() => {
    materiasService.listAsignaciones().then((data) => {
      const nombres = data.exito ? data.asignaciones.map((a) => a.materia) : [];
      setMaterias([...new Set(nombres)].sort((a, b) => a.localeCompare(b)));
    });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (file) fd.append('file', file);
    const res = await studyPlansService.create(fd);
    if (res.exito) {
      toast.success('Plan publicado.');
      setForm(EMPTY);
      setFile(null);
      e.target.reset();
      onCreated?.();
    } else {
      toast.error(res.message || res.mensaje || 'Error al publicar.');
    }
  };

  return (
    <details className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <summary className="cursor-pointer font-semibold">
        <i className="fas fa-plus-circle text-accent" /> Cargar nuevo plan de estudios
      </summary>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <select
          required
          aria-label="Materia"
          value={form.materia}
          onChange={(e) => setForm({ ...form, materia: e.target.value })}
          className="rounded border border-blue-200 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="">{materias.length ? 'Materia…' : 'No tenés materias asignadas'}</option>
          {materias.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          required
          placeholder="Título"
          value={form.titulo}
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          className="rounded border border-blue-200 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
        <textarea
          required
          placeholder="Objetivos"
          rows={2}
          value={form.objetivos}
          onChange={(e) => setForm({ ...form, objetivos: e.target.value })}
          className="rounded border border-blue-200 p-2 text-sm sm:col-span-2 dark:border-slate-600 dark:bg-slate-900"
        />
        <textarea
          required
          placeholder="Contenidos / unidades"
          rows={3}
          value={form.contenidos}
          onChange={(e) => setForm({ ...form, contenidos: e.target.value })}
          className="rounded border border-blue-200 p-2 text-sm sm:col-span-2 dark:border-slate-600 dark:bg-slate-900"
        />
        <input type="file" onChange={(e) => setFile(e.target.files[0])} className="text-sm sm:col-span-2" />
        <button
          type="submit"
          className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white sm:col-span-2 sm:justify-self-end"
        >
          <i className="fas fa-save" /> Publicar plan
        </button>
      </form>
    </details>
  );
}
