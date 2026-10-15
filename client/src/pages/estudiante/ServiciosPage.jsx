import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { inscripcionesService } from '../../services/api/inscripcionesService';
import { transporteService } from '../../services/api/transporteService';
import { comedorService } from '../../services/api/comedorService';
import { DeportesSection, TransporteSection, ComedorSection } from '../../components/features/ServiciosSections';

// El TP (Reglas de Negocio, 1er punto) dice "Cada alumno puede:
// inscribirse a dos deportes simultáneamente / al servicio de transporte
// / al servicio de comedor" — el propio alumno gestiona esto sobre sí
// mismo, sin depender de que un padre lo haga por él. Misma UI que
// padre/ServiciosPage.jsx (ver ServiciosSections.jsx), acá con
// estudianteId = el propio usuario logueado en vez de un hijo elegido.
export default function ServiciosPage() {
  const { user } = useAuth();
  const [resumen, setResumen] = useState(null);
  const [recorridos, setRecorridos] = useState([]);
  const [turnos, setTurnos] = useState([]);

  const cargar = useCallback(async () => {
    setResumen(null);
    const [r, rec, tur] = await Promise.all([
      inscripcionesService.getResumen(user.id),
      transporteService.list(),
      comedorService.list(),
    ]);
    setResumen(r.exito ? r : null);
    setRecorridos(rec.exito ? rec.recorridos : []);
    setTurnos(tur.exito ? tur.turnos : []);
  }, [user.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!resumen) {
    return <p className="text-center text-slate-400">Cargando…</p>;
  }

  return (
    <div>
      <h3 className="mb-2 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Deportes y Servicios</h3>
      <p className="mb-5 text-sm text-slate-500">Gestioná tu inscripción a deportes, transporte y comedor.</p>

      <div className="space-y-6">
        <DeportesSection estudianteId={user.id} resumen={resumen.deportes} onCambio={cargar} />
        <TransporteSection estudianteId={user.id} resumen={resumen.transporte} catalogo={recorridos} onCambio={cargar} />
        <ComedorSection estudianteId={user.id} resumen={resumen.comedor} catalogo={turnos} onCambio={cargar} />
      </div>
    </div>
  );
}
