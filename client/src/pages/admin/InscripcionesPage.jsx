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

export default function InscripcionesPage() {
  const toast = useToast();
  const { refresh: refreshCounts } = useAdminPendingCounts();
  const [status, setStatus] = useState('PENDIENTE');
  const [items, setItems] = useState(null);

  const cargar = async () => {
    const data = await moderationService.listInscriptions(status);
    setItems(data.exito ? data.inscripciones : []);
    refreshCounts();
  };

  useEffect(() => {
    cargar();
  }, [status]);

  const resolver = async (id, accion) => {
    let notaAdmin = '';
    if (accion === 'reject') {
      notaAdmin = window.prompt('Motivo del rechazo (opcional):', '') ?? '';
    } else if (!window.confirm('¿Aprobar esta solicitud de inscripción?')) {
      return;
    }
    const res = await moderationService.resolveInscription(id, accion, notaAdmin);
    if (res.exito) {
      toast.success(accion === 'approve' ? 'Inscripción aprobada.' : 'Inscripción rechazada.');
      cargar();
    } else {
      toast.error(res.mensaje || 'Error.');
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este registro de la base?')) return;
    const res = await moderationService.deleteInscription(id);
    if (res.exito) {
      toast.success('Eliminado.');
      cargar();
    } else {
      toast.error(res.mensaje || 'Error.');
    }
  };

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'nombreTutor', label: 'Tutor', render: (i) => <b>{i.nombreTutor}</b> },
    { key: 'contacto', label: 'Contacto', render: (i) => <>{i.emailTutor}<br /><span className="text-xs text-slate-400">{i.telefonoTutor}</span></> },
    { key: 'nombreEstudiante', label: 'Estudiante' },
    { key: 'nivel', label: 'Nivel / Curso', render: (i) => <>{i.nivel}<br /><span className="text-xs text-slate-400">{i.curso}</span></> },
    { key: 'mensaje', label: 'Mensaje', render: (i) => <span className="text-sm">{i.mensaje || '—'}</span> },
    { key: 'status', label: 'Estado', render: (i) => <ModerationStatusBadge status={i.status} /> },
    { key: 'createdAt', label: 'Recibida', render: (i) => formatFecha(i.createdAt) },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (i) => (
        <ModerationActions
          status={i.status}
          onApprove={() => resolver(i.id, 'approve')}
          onReject={() => resolver(i.id, 'reject')}
          onDelete={() => eliminar(i.id)}
        />
      ),
    },
  ];

  return (
    <div>
      <h3 className="mb-4 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Solicitudes de inscripción</h3>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="mb-4 rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900">
        <option value="PENDIENTE">Pendientes</option>
        <option value="APROBADO">Aprobadas</option>
        <option value="RECHAZADO">Rechazadas</option>
        <option value="">Todas</option>
      </select>
      <DataTable columns={columns} rows={items ?? []} loading={items === null} emptyMessage="Sin solicitudes." />
    </div>
  );
}
