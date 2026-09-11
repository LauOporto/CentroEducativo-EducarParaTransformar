import { useEffect, useState } from 'react';
import { adminService } from '../../services/api/adminService';
import { useToast } from '../../hooks/useToast';
import { useAdminPendingCounts } from '../../hooks/useAdminPendingCounts';
import DataTable from '../../components/ui/DataTable';

function formatFecha(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function DocentesPendientesPage() {
  const toast = useToast();
  const { refresh: refreshCounts } = useAdminPendingCounts();
  const [docentes, setDocentes] = useState(null);

  const cargar = async () => {
    const data = await adminService.pendingTeachers();
    setDocentes(data.exito ? data.docentes : []);
    refreshCounts();
  };

  useEffect(() => {
    cargar();
  }, []);

  const aprobar = async (id) => {
    if (!window.confirm('¿Confirmás la aprobación de este docente? Va a poder iniciar sesión inmediatamente.')) return;
    const res = await adminService.approveTeacher(id);
    if (res.exito) {
      toast.success('Docente aprobado: ' + res.docente.nombre);
      cargar();
    } else {
      toast.error(res.mensaje || 'No se pudo aprobar.');
    }
  };

  const rechazar = async (id) => {
    if (!window.confirm('¿Rechazar y eliminar esta solicitud? La acción es irreversible.')) return;
    const res = await adminService.rejectTeacher(id);
    if (res.exito) {
      toast.success('Solicitud rechazada.');
      cargar();
    } else {
      toast.error(res.mensaje || 'No se pudo rechazar.');
    }
  };

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'nombre', label: 'Nombre', render: (d) => <b>{d.nombre}</b> },
    { key: 'usuario', label: 'Usuario' },
    { key: 'dni', label: 'DNI' },
    { key: 'email', label: 'Email' },
    { key: 'createdAt', label: 'Solicitado', render: (d) => formatFecha(d.createdAt) },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (d) => (
        <div className="flex gap-1.5">
          <button onClick={() => aprobar(d.id)} className="rounded bg-accent px-2.5 py-1.5 text-xs text-white"><i className="fas fa-check" /> Aprobar</button>
          <button onClick={() => rechazar(d.id)} className="rounded bg-red-500 px-2.5 py-1.5 text-xs text-white"><i className="fas fa-times" /> Rechazar</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h3 className="mb-2 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Docentes pendientes de aprobación</h3>
      <p className="mb-4 text-sm text-slate-500">Estos usuarios se registraron como docentes y necesitan tu autorización para poder iniciar sesión.</p>
      <DataTable columns={columns} rows={docentes ?? []} loading={docentes === null} emptyMessage="No hay docentes esperando aprobación." />
    </div>
  );
}
