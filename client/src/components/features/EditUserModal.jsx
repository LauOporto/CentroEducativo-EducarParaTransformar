import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { adminService } from '../../services/api/adminService';
import { useToast } from '../../hooks/useToast';
import { CURSOS, ROLES_ADMIN } from '../../domain/cursos';

export default function EditUserModal({ user, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (user) setForm({ nombre: user.nombre, usuario: user.usuario, dni: user.dni, email: user.email, role: user.role, curso: user.curso || '' });
  }, [user]);

  if (!user || !form) return null;

  const submit = async (e) => {
    e.preventDefault();
    const res = await adminService.updateUser(user.id, { ...form, curso: form.role === 'ESTUDIANTE' ? form.curso || null : null });
    if (res.exito) {
      toast.success('Usuario actualizado.');
      onSaved();
    } else {
      toast.error(res.mensaje || 'No se pudo actualizar.');
    }
  };

  return (
    <Modal open onClose={onClose} title="Editar usuario" wide>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <input required placeholder="Nombre completo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="col-span-2 rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
        <input required placeholder="Usuario" value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
        <input required placeholder="DNI" pattern="[0-9]{7,8}" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
        <select required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900">
          {ROLES_ADMIN.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        {form.role === 'ESTUDIANTE' && (
          <select value={form.curso} onChange={(e) => setForm({ ...form, curso: e.target.value })} className="col-span-2 rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900">
            <option value="">Curso / año…</option>
            {CURSOS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div className="col-span-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded bg-slate-500 px-4 py-2 text-sm text-white">Cancelar</button>
          <button type="submit" className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white"><i className="fas fa-save" /> Guardar cambios</button>
        </div>
      </form>
    </Modal>
  );
}
