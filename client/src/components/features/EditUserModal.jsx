import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { adminService } from '../../services/api/adminService';
import { useToast } from '../../hooks/useToast';
import { useCursos } from '../../hooks/useCursos';
import { ROLES_ADMIN } from '../../domain/cursos';

const ESTADOS_ALUMNO = [
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'INACTIVO', label: 'Inactivo' },
  { value: 'EGRESADO', label: 'Egresado' },
];

function toDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export default function EditUserModal({ user, onClose, onSaved }) {
  const toast = useToast();
  const { cursos } = useCursos();
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!user) return;
    setForm({
      nombre: user.nombre, usuario: user.usuario, dni: user.dni, email: user.email, role: user.role,
      curso: user.curso || '',
      legajo: user.legajo || '', apellido: user.apellido || '', domicilio: user.domicilio || '',
      telefono: user.telefono || '', fechaNacimiento: toDateInput(user.fechaNacimiento),
      estado: user.estado || 'ACTIVO',
    });
  }, [user]);

  if (!user || !form) return null;

  const esAlumno = form.role === 'ESTUDIANTE';

  const submit = async (e) => {
    e.preventDefault();
    const payload = esAlumno
      ? form
      : { ...form, curso: null, legajo: null, apellido: null, fechaNacimiento: null, domicilio: null, telefono: null, estado: null };
    const res = await adminService.updateUser(user.id, payload);
    if (res.exito) {
      toast.success('Usuario actualizado.');
      onSaved();
    } else {
      toast.error(res.message || res.mensaje || 'No se pudo actualizar.');
    }
  };

  const campo = (extra = '') => `rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900 ${extra}`;

  return (
    <Modal open onClose={onClose} title="Editar usuario" wide>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <input required placeholder="Nombre completo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={campo('col-span-2')} />
        <input required placeholder="Usuario" value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} className={campo()} />
        <input required placeholder="DNI" pattern="[0-9]{7,8}" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} className={campo()} />
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={campo()} />
        <select required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={campo()}>
          {ROLES_ADMIN.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        {esAlumno && (
          <>
            <select value={form.curso} onChange={(e) => setForm({ ...form, curso: e.target.value })} className={campo('col-span-2')}>
              <option value="">Curso / año…</option>
              {cursos.map((c) => <option key={c.id} value={c.etiqueta}>{c.etiqueta}</option>)}
            </select>

            <div className="col-span-2 -mb-1 mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Ficha de alumno
            </div>
            <input placeholder="Legajo" value={form.legajo} onChange={(e) => setForm({ ...form, legajo: e.target.value })} className={campo()} />
            <input placeholder="Apellido" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} className={campo()} />
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Fecha de nacimiento
              <input type="date" value={form.fechaNacimiento} onChange={(e) => setForm({ ...form, fechaNacimiento: e.target.value })} className={campo()} />
            </label>
            <input placeholder="Teléfono (solo dígitos)" pattern="[0-9]{6,20}" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className={campo()} />
            <input placeholder="Domicilio" value={form.domicilio} onChange={(e) => setForm({ ...form, domicilio: e.target.value })} className={campo()} />
            <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className={campo()}>
              {ESTADOS_ALUMNO.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
          </>
        )}

        <div className="col-span-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded bg-slate-500 px-4 py-2 text-sm text-white">Cancelar</button>
          <button type="submit" className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white"><i className="fas fa-save" /> Guardar cambios</button>
        </div>
      </form>
    </Modal>
  );
}
