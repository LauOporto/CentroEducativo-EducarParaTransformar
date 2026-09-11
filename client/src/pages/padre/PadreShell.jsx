import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import PanelLayout from '../../components/layout/PanelLayout';
import HijoSelector from '../../components/features/HijoSelector';
import { parentService } from '../../services/api/parentService';

const MENU = [
  { to: '/padre', label: 'Boletín e Historial', icon: 'fa-file-invoice', end: true },
  { to: '/padre/materias', label: 'Materias del Hijo', icon: 'fa-book-open' },
  { to: '/padre/asistencias', label: 'Asistencias', icon: 'fa-clipboard-user' },
];

export default function PadreShell() {
  const [hijos, setHijos] = useState([]);
  const [hijoId, setHijoId] = useState(null);

  const cargarHijos = useCallback(async () => {
    const data = await parentService.listHijos();
    const lista = data.exito ? data.hijos : [];
    setHijos(lista);
    setHijoId((current) => (lista.some((h) => h.id === current) ? current : lista[0]?.id ?? null));
  }, []);

  useEffect(() => {
    cargarHijos();
  }, [cargarHijos]);

  return (
    <PanelLayout
      title="Portal del padre/tutor"
      menuItems={MENU}
      topBar={<HijoSelector hijos={hijos} hijoId={hijoId} onChange={setHijoId} onVinculado={cargarHijos} />}
    >
      <Outlet context={{ hijoId }} />
    </PanelLayout>
  );
}
