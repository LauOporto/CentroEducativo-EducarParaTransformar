import { useState } from 'react';
import { studyPlansService } from '../../services/api/studyPlansService';
import { useToast } from '../../hooks/useToast';

const EMPTY = { materia: '', titulo: '', objetivos: '', contenidos: '' };

export default function StudyPlanForm({ onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);

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
      toast.error(res.mensaje || 'Error al publicar.');
    }
  };

  return (
    <details className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <summary className="cursor-pointer font-semibold"><i className="fas fa-plus-circle text-accent" /> Cargar nuevo plan de estudios</summary>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          required
          placeholder="Materia"
          value={form.materia}
          onChange={(e) => setForm({ ...form, materia: e.target.value })}
          className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
        <input
          required
          placeholder="Título"
          value={form.titulo}
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
        <textarea
          required
          placeholder="Objetivos"
          rows={2}
          value={form.objetivos}
          onChange={(e) => setForm({ ...form, objetivos: e.target.value })}
          className="rounded border border-slate-300 p-2 text-sm sm:col-span-2 dark:border-slate-600 dark:bg-slate-900"
        />
        <textarea
          required
          placeholder="Contenidos / unidades"
          rows={3}
          value={form.contenidos}
          onChange={(e) => setForm({ ...form, contenidos: e.target.value })}
          className="rounded border border-slate-300 p-2 text-sm sm:col-span-2 dark:border-slate-600 dark:bg-slate-900"
        />
        <input type="file" onChange={(e) => setFile(e.target.files[0])} className="text-sm sm:col-span-2" />
        <button type="submit" className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white sm:col-span-2 sm:justify-self-end">
          <i className="fas fa-save" /> Publicar plan
        </button>
      </form>
    </details>
  );
}
