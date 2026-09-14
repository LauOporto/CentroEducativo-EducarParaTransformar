import { Outlet } from 'react-router-dom';
import PanelLayout from '../../components/layout/PanelLayout';

const MENU = [
  { to: '/estudiante', label: 'Boletín Oficial', icon: 'fa-file-invoice', end: true },
  { to: '/estudiante/perfil', label: 'Mi Perfil', icon: 'fa-id-card' },
  { to: '/estudiante/planes', label: 'Planes de Estudio', icon: 'fa-book' },
  { to: '/estudiante/asistencias', label: 'Mis Asistencias', icon: 'fa-clipboard-check' },
  { to: '/estudiante/foros', label: 'Foros', icon: 'fa-comments' },
];

export default function EstudianteShell() {
  return (
    <PanelLayout title="Portal del estudiante" menuItems={MENU}>
      <Outlet />
    </PanelLayout>
  );
}
