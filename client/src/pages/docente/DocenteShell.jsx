import { Outlet } from 'react-router-dom';
import PanelLayout from '../../components/layout/PanelLayout';

const MENU = [
  { to: '/docente', label: 'Cargar Calificaciones', icon: 'fa-pen-square', end: true },
  { to: '/docente/perfil', label: 'Mi Perfil', icon: 'fa-user' },
  { to: '/docente/cursos', label: 'Mis Cursos', icon: 'fa-chalkboard' },
  { to: '/docente/asistencia', label: 'Asistencia Diaria', icon: 'fa-clipboard-check' },
  { to: '/docente/historial-asistencia', label: 'Historial de Asistencia', icon: 'fa-history' },
  { to: '/docente/planes', label: 'Planes de Estudio', icon: 'fa-book' },
];

export default function DocenteShell() {
  return (
    <PanelLayout title="Portal académico" menuItems={MENU}>
      <Outlet />
    </PanelLayout>
  );
}
