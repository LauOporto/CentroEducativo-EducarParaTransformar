import PanelLayout from '../../components/layout/PanelLayout';
import PendingView from '../../components/ui/PendingView';

const MENU = [
  { to: '/admin', label: 'Dashboard', icon: 'fa-tachometer-alt', end: true },
];

export default function AdminShell() {
  return (
    <PanelLayout title="Administración" menuItems={MENU}>
      <PendingView label="Panel de administración (usuarios, docentes pendientes, moderación, vínculos padre-hijo)" />
    </PanelLayout>
  );
}
