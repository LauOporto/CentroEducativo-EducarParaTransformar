import { useEffect, useState } from 'react';
import { adminService } from '../../services/api/adminService';
import DataTable from '../../components/ui/DataTable';
import EditUserModal from '../../components/features/EditUserModal';
import AsignarMateriaModal from '../../components/features/AsignarMateriaModal';

export default function ProfesoresPage() {
  const [profesores, setProfesores] = useState(null);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [editing, setEditing] = useState(null);
  const [asignando, setAsignando] = useState(null);

  const cargar = async () => {
    const data = await adminService.listUsers({ role: 'DOCENTE', q });
    if (data.exito) {
      let filtrados = data.usuarios;
      if (estado) {
        filtrados = filtrados.filter((p) => p.estadoProfesor === estado);
      }
      setProfesores(filtrados);
    } else {
      setProfesores([]);
    }
  };

  useEffect(() => {
    cargar();
  }, [q, estado]);

  const columns = [
    { key: 'legajo', label: 'Legajo', render: (p) => p.legajo || '—' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'apellido', label: 'Apellido', render: (p) => p.apellido || '—' },
    { key: 'especialidad', label: 'Especialidad', render: (p) => p.especialidad || '—' },
    { key: 'estadoProfesor', label: 'Estado', render: (p) => p.estadoProfesor || 'ACTIVO' },
    { key: 'email', label: 'Email' },
    { key: 'telefono', label: 'Teléfono', render: (p) => p.telefono || '—' },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (p) => (
        <div className="flex gap-1.5">
          <button onClick={() => setEditing(p)} className="rounded bg-blue-500 px-2.5 py-1.5 text-xs text-white">
            Editar
          </button>
          <button onClick={() => setAsignando(p)} className="rounded bg-accent px-2.5 py-1.5 text-xs text-white">
            Materias
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h3 className="mb-5 border-b border-blue-100 pb-3 text-xl font-bold dark:border-slate-700">
        Gestión de Profesores
      </h3>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          placeholder="Buscar por nombre / legajo / DNI / email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 rounded border border-blue-200 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="rounded border border-blue-200 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="LICENCIA">Licencia</option>
          <option value="INACTIVO">Inactivo</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={profesores ?? []}
        loading={profesores === null}
        emptyMessage="Sin resultados."
      />

      <EditUserModal
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          cargar();
        }}
      />
      <AsignarMateriaModal profesor={asignando} onClose={() => setAsignando(null)} />
    </div>
  );
}
