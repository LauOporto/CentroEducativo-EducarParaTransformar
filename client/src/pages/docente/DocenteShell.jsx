import PanelLayout from '../../components/layout/PanelLayout';
import PendingView from '../../components/ui/PendingView';

const MENU = [
  { to: '/docente', label: 'Cargar Calificaciones', icon: 'fa-pen-square', end: true },
];

export default function DocenteShell() {
  return (
    <PanelLayout title="Portal académico" menuItems={MENU}>
      <PendingView label="Panel del docente (calificaciones, asistencia, planes de estudio, foros)" />
    </PanelLayout>
  );
}
