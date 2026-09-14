import { useEffect, useState } from 'react';
import { adminService } from '../../services/api/adminService';
import { useToast } from '../../hooks/useToast';
import { ROLES_ADMIN } from '../../domain/cursos';
import DataTable from '../../components/ui/DataTable';
import UserForm from '../../components/features/UserForm';
import EditUserModal from '../../components/features/EditUserModal';

const ROLE_LABEL = Object.fromEntries(ROLES_ADMIN.map((r) => [r.value, r.label]));

export default function UsuariosPage() {
  const toast = useToast();
  const [usuarios, setUsuarios] = useState(null);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [editing, setEditing] = useState(null);

  const cargar = async () => {
    const data = await adminService.listUsers({ role, q });
    setUsuarios(data.exito ? data.usuarios : []);
  };

  useEffect(() => {
    cargar();
  }, [role, q]);

  const desactivar = async (u) => {
    if (!window.confirm(`¿Desactivar a ${u.nombre}? No va a poder iniciar sesión hasta que lo reactives.`)) return;
    const res = await adminService.deactivateUser(u.id);
    if (res.exito) {
      toast.success('Usuario desactivado.');
      cargar();
    } else {
      toast.error(res.mensaje || 'Error.');
    }
  };

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'usuario', label: 'Usuario', render: (u) => <b>{u.usuario}</b> },
    { key: 'nombre', label: 'Nombre' },
    { key: 'role', label: 'Rol', render: (u) => ROLE_LABEL[u.role] },
    { key: 'dni', label: 'DNI' },
    { key: 'legajo', label: 'Legajo', render: (u) => u.legajo || '—' },
    { key: 'email', label: 'Email' },
    { key: 'curso', label: 'Curso', render: (u) => u.curso || '—' },
    {
      key: 'isActive',
      label: 'Estado',
      render: (u) => (
        <span className={u.isActive ? 'text-emerald-600' : 'text-red-500'}>{u.isActive ? 'Activo' : 'Inactivo'}</span>
      ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (u) => (
        <div className="flex gap-1.5">
          <button onClick={() => setEditing(u)} className="rounded bg-slate-500 px-2.5 py-1.5 text-xs text-white">Editar</button>
          <button onClick={() => desactivar(u)} disabled={!u.isActive} className="rounded bg-red-500 px-2.5 py-1.5 text-xs text-white disabled:opacity-40">
            Desactivar
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h3 className="mb-5 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Gestión de Usuarios</h3>

      <UserForm onCreated={cargar} />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          placeholder="Buscar por nombre / usuario / DNI / email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
        <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900">
          <option value="">Todos los roles</option>
          {ROLES_ADMIN.map((r) => <option key={r.value} value={r.value}>{r.label}s</option>)}
        </select>
      </div>

      <DataTable columns={columns} rows={usuarios ?? []} loading={usuarios === null} emptyMessage="Sin resultados." />

      <EditUserModal
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          cargar();
        }}
      />
    </div>
  );
}
