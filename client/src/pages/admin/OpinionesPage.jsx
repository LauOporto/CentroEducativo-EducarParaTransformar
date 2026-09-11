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

export default function OpinionesPage() {
  const toast = useToast();
  const { refresh: refreshCounts } = useAdminPendingCounts();
  const [status, setStatus] = useState('PENDIENTE');
  const [items, setItems] = useState(null);

  const cargar = async () => {
    const data = await moderationService.listOpinions(status);
    setItems(data.exito ? data.opiniones : []);
    refreshCounts();
  };

  useEffect(() => {
    cargar();
  }, [status]);

  const resolver = async (id, accion) => {
    const res = await moderationService.resolveOpinion(id, accion);
    if (res.exito) {
      toast.success(accion === 'approve' ? 'Opinión publicada.' : 'Opinión rechazada.');
      cargar();
    } else {
      toast.error(res.mensaje || 'Error.');
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar esta opinión definitivamente?')) return;
    const res = await moderationService.deleteOpinion(id);
    if (res.exito) {
      toast.success('Eliminada.');
      cargar();
    } else {
      toast.error(res.mensaje || 'Error.');
    }
  };

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'nombre', label: 'Autor', render: (o) => o.nombre || 'Anónimo' },
    { key: 'rol', label: 'Rol' },
    { key: 'texto', label: 'Texto', render: (o) => <span className="text-sm">"{o.texto}"</span> },
    { key: 'rating', label: 'Estrellas', render: (o) => <span className="text-amber-400">{'★'.repeat(o.rating)}{'☆'.repeat(5 - o.rating)}</span> },
    { key: 'status', label: 'Estado', render: (o) => <ModerationStatusBadge status={o.status} /> },
    { key: 'createdAt', label: 'Recibida', render: (o) => formatFecha(o.createdAt) },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (o) => (
        <ModerationActions
          status={o.status}
          onApprove={() => resolver(o.id, 'approve')}
          onReject={() => resolver(o.id, 'reject')}
          onDelete={() => eliminar(o.id)}
        />
      ),
    },
  ];

  return (
    <div>
      <h3 className="mb-4 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Moderación de opiniones</h3>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="mb-4 rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900">
        <option value="PENDIENTE">Pendientes</option>
        <option value="APROBADO">Aprobadas</option>
        <option value="RECHAZADO">Rechazadas</option>
        <option value="">Todas</option>
      </select>
      <DataTable columns={columns} rows={items ?? []} loading={items === null} emptyMessage="Sin opiniones." />
    </div>
  );
}
