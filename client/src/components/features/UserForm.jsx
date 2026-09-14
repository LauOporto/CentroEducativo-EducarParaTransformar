import { useState } from 'react';
import { adminService } from '../../services/api/adminService';
import { useToast } from '../../hooks/useToast';
import { useCursos } from '../../hooks/useCursos';
import { ROLES_ADMIN } from '../../domain/cursos';

const EMPTY = {
  usuario: '', email: '', dni: '', nombre: '', role: '', curso: '', password: '',
  legajo: '', apellido: '', fechaNacimiento: '', domicilio: '', telefono: '',
};

export default function UserForm({ onCreated }) {
  const toast = useToast();
  const { cursos } = useCursos();
  const [form, setForm] = useState(EMPTY);
  const esAlumno = form.role === 'ESTUDIANTE';

  const submit = async (e) => {
    e.preventDefault();
    const payload = esAlumno
      ? form
      : { ...form, curso: null, legajo: null, apellido: null, fechaNacimiento: null, domicilio: null, telefono: null };
    const res = await adminService.createUser(payload);
    if (res.exito) {
      toast.success('Usuario creado: ' + res.usuario.usuario);
      setForm(EMPTY);
      e.target.reset();
      onCreated?.();
    } else {
      toast.error(res.message || res.mensaje || 'No se pudo crear.');
    }
  };

  const campo = (extra = '') => `rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900 ${extra}`;

  return (
    <details className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <summary className="cursor-pointer font-semibold"><i className="fas fa-plus-circle text-accent" /> Crear nuevo usuario</summary>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input required placeholder="Usuario" value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} className={campo()} />
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={campo()} />
        <input required placeholder="DNI (7-8 dígitos)" pattern="[0-9]{7,8}" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} className={campo()} />
        <input required placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={campo()} />
        <select required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={campo()}>
          <option value="">Rol…</option>
          {ROLES_ADMIN.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        {esAlumno ? (
          <select required value={form.curso} onChange={(e) => setForm({ ...form, curso: e.target.value })} className={campo()}>
            <option value="">Curso…</option>
            {cursos.map((c) => <option key={c.id} value={c.etiqueta}>{c.etiqueta}</option>)}
          </select>
        ) : <div />}

        {esAlumno && (
          <>
            <div className="col-span-2 -mb-1 mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Ficha de alumno
            </div>
            <input required placeholder="Legajo" value={form.legajo} onChange={(e) => setForm({ ...form, legajo: e.target.value })} className={campo()} />
            <input required placeholder="Apellido" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} className={campo()} />
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Fecha de nacimiento
              <input required type="date" value={form.fechaNacimiento} onChange={(e) => setForm({ ...form, fechaNacimiento: e.target.value })} className={campo()} />
            </label>
            <input required placeholder="Teléfono (solo dígitos)" pattern="[0-9]{6,20}" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className={campo()} />
            <input required placeholder="Domicilio" value={form.domicilio} onChange={(e) => setForm({ ...form, domicilio: e.target.value })} className={campo('col-span-2')} />
          </>
        )}

        <input required type="password" minLength={6} placeholder="Contraseña inicial" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={campo('sm:col-span-2')} />
        <button type="submit" className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white sm:col-span-2 sm:justify-self-end">
          <i className="fas fa-user-plus" /> Crear
        </button>
      </form>
    </details>
  );
}
