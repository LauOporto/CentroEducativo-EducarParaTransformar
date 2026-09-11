import { Outlet } from 'react-router-dom';
import PanelLayout from '../../components/layout/PanelLayout';
import { useAdminPendingCounts } from '../../hooks/useAdminPendingCounts';

export default function AdminShell() {
  const { counts } = useAdminPendingCounts();

  const menu = [
    { to: '/admin', label: 'Dashboard', icon: 'fa-tachometer-alt', end: true },
    { to: '/admin/usuarios', label: 'Usuarios', icon: 'fa-users' },
    { to: '/admin/docentes', label: 'Docentes pendientes', icon: 'fa-user-clock', badge: counts?.docentes },
    { to: '/admin/inscripciones', label: 'Inscripciones', icon: 'fa-file-signature', badge: counts?.inscripciones },
    { to: '/admin/opiniones', label: 'Opiniones', icon: 'fa-comment-dots', badge: counts?.opiniones },
    { to: '/admin/empleo', label: 'Postulaciones empleo', icon: 'fa-briefcase', badge: counts?.empleo },
    { to: '/admin/vinculos', label: 'Vínculos Padre-Hijo', icon: 'fa-link' },
  ];

  return (
    <PanelLayout title="Administración" menuItems={menu}>
      <Outlet />
    </PanelLayout>
  );
}
