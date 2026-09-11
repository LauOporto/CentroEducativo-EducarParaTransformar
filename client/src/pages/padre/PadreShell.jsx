import PanelLayout from '../../components/layout/PanelLayout';
import PendingView from '../../components/ui/PendingView';

const MENU = [
  { to: '/padre', label: 'Boletín e Historial', icon: 'fa-file-invoice', end: true },
];

export default function PadreShell() {
  return (
    <PanelLayout title="Portal del padre/tutor" menuItems={MENU}>
      <PendingView label="Panel del padre/tutor (boletín, materias, asistencias de sus hijos)" />
    </PanelLayout>
  );
}
