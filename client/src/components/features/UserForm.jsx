import { useState } from 'react';
import { adminService } from '../../services/api/adminService';
import { useToast } from '../../hooks/useToast';
import { CURSOS, ROLES_ADMIN } from '../../domain/cursos';

const EMPTY = { usuario: '', email: '', dni: '', nombre: '', role: '', curso: '', password: '' };

export default function UserForm({ onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);

  const submit = async (e) => {
    e.preventDefault();
    const res = await adminService.createUser({ ...form, curso: form.role === 'ESTUDIANTE' ? form.curso || null : null });
    if (res.exito) {
      toast.success('Usuario creado: ' + res.usuario.usuario);
      setForm(EMPTY);
      e.target.reset();
      onCreated?.();
    } else {
      toast.error(res.mensaje || 'No se pudo crear.');
    }
  };

  return (
    <details className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <summary className="cursor-pointer font-semibold"><i className="fas fa-plus-circle text-accent" /> Crear nuevo usuario</summary>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input required placeholder="Usuario" value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
        <input required placeholder="DNI (7-8 dígitos)" pattern="[0-9]{7,8}" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
        <input required placeholder="Nombre completo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
        <select required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900">
          <option value="">Rol…</option>
          {ROLES_ADMIN.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        {form.role === 'ESTUDIANTE' ? (
          <select value={form.curso} onChange={(e) => setForm({ ...form, curso: e.target.value })} className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900">
            <option value="">Curso…</option>
            {CURSOS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : <div />}
        <input required type="password" minLength={6} placeholder="Contraseña inicial" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded border border-slate-300 p-2 text-sm sm:col-span-2 dark:border-slate-600 dark:bg-slate-900" />
        <button type="submit" className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white sm:col-span-2 sm:justify-self-end">
          <i className="fas fa-user-plus" /> Crear
        </button>
      </form>
    </details>
  );
}
