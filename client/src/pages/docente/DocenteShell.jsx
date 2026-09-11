import { Outlet } from 'react-router-dom';
import PanelLayout from '../../components/layout/PanelLayout';

const MENU = [
  { to: '/docente', label: 'Cargar Calificaciones', icon: 'fa-pen-square', end: true },
  { to: '/docente/asistencia', label: 'Asistencia Diaria', icon: 'fa-clipboard-check' },
  { to: '/docente/planes', label: 'Planes de Estudio', icon: 'fa-book' },
  { to: '/docente/foros', label: 'Foros', icon: 'fa-comments' },
];

export default function DocenteShell() {
  return (
    <PanelLayout title="Portal académico" menuItems={MENU}>
      <Outlet />
    </PanelLayout>
  );
}
