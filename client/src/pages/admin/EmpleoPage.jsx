import { useEffect, useState } from 'react';
import { moderationService } from '../../services/api/moderationService';
import { useToast } from '../../hooks/useToast';
import { useAdminPendingCounts } from '../../hooks/useAdminPendingCounts';
import DataTable from '../../components/ui/DataTable';
import ModerationStatusBadge from '../../components/features/ModerationStatusBadge';
import ModerationActions from '../../components/features/ModerationActions';

function formatFecha(iso) {
  return new Date(iso).toLocaleDateString('es-AR');
}

export default function EmpleoPage() {
  const toast = useToast();
  const { refresh: refreshCounts } = useAdminPendingCounts();
  const [status, setStatus] = useState('PENDIENTE');
  const [items, setItems] = useState(null);

  const cargar = async () => {
    const data = await moderationService.listEmployment(status);
    setItems(data.exito ? data.postulaciones : []);
    refreshCounts();
  };

  useEffect(() => {
    cargar();
  }, [status]);

  const resolver = async (id, accion) => {
    let notaAdmin = '';
    if (accion === 'reject') {
      notaAdmin = window.prompt('Motivo del rechazo (opcional):', '') ?? '';
    } else if (!window.confirm('¿Aprobar esta postulación y avisar al candidato?')) {
      return;
    }
    const res = await moderationService.resolveEmployment(id, accion, notaAdmin);
    if (res.exito) {
      toast.success(accion === 'approve' ? 'Postulación aceptada.' : 'Postulación rechazada.');
      cargar();
    } else {
      toast.error(res.mensaje || 'Error.');
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar esta postulación de la base?')) return;
    const res = await moderationService.deleteEmployment(id);
    if (res.exito) {
      toast.success('Eliminada.');
      cargar();
    } else {
      toast.error(res.mensaje || 'Error.');
    }
  };

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'nombre', label: 'Nombre', render: (p) => <b>{p.nombre}</b> },
    { key: 'email', label: 'Email' },
    { key: 'puesto', label: 'Puesto' },
    {
      key: 'cvUrl',
      label: 'CV',
      render: (p) => (p.cvUrl
        ? <a href={p.cvUrl} target="_blank" rel="noreferrer" className="font-semibold text-accent"><i className="fas fa-file-pdf" /> Ver CV</a>
        : <span className="text-slate-400">Sin CV</span>),
    },
    { key: 'status', label: 'Estado', render: (p) => <ModerationStatusBadge status={p.status} /> },
    { key: 'createdAt', label: 'Recibida', render: (p) => formatFecha(p.createdAt) },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (p) => (
        <ModerationActions
          status={p.status}
          onApprove={() => resolver(p.id, 'approve')}
          onReject={() => resolver(p.id, 'reject')}
          onDelete={() => eliminar(p.id)}
        />
      ),
    },
  ];

  return (
    <div>
      <h3 className="mb-4 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Postulaciones de empleo</h3>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="mb-4 rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900">
        <option value="PENDIENTE">Pendientes</option>
        <option value="APROBADO">Aprobadas</option>
        <option value="RECHAZADO">Rechazadas</option>
        <option value="">Todas</option>
      </select>
      <DataTable columns={columns} rows={items ?? []} loading={items === null} emptyMessage="Sin postulaciones." />
    </div>
  );
}
