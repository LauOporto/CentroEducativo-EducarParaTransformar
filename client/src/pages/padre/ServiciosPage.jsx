import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { inscripcionesService } from '../../services/api/inscripcionesService';
import { transporteService } from '../../services/api/transporteService';
import { comedorService } from '../../services/api/comedorService';
import { DeportesSection, TransporteSection, ComedorSection } from '../../components/features/ServiciosSections';

// RF-18 a RF-22 (inscripción a deportes/transporte/comedor) + la mitad
// "deportes en que participa" de RF-23: vive toda acá, en una sola
// pantalla, para no duplicar esa información en MateriasPage.jsx (que ya
// cubre la otra mitad de RF-23, "profesores por materia"). Las secciones
// de UI se comparten con el panel Estudiante vía ServiciosSections.jsx —
// el TP habilita a ambos roles a gestionar estos tres servicios.
export default function ServiciosPage() {
  const { hijoId, hijos } = useOutletContext();
  const [resumen, setResumen] = useState(null);
  const [recorridos, setRecorridos] = useState([]);
  const [turnos, setTurnos] = useState([]);

  const hijo = hijos.find((h) => h.id === hijoId);

  const cargar = useCallback(async () => {
    if (!hijoId) return;
    setResumen(null);
    const [r, rec, tur] = await Promise.all([
      inscripcionesService.getResumen(hijoId),
      transporteService.list(),
      comedorService.list(),
    ]);
    setResumen(r.exito ? r : null);
    setRecorridos(rec.exito ? rec.recorridos : []);
    setTurnos(tur.exito ? tur.turnos : []);
  }, [hijoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!hijoId) {
    return <p className="text-center text-slate-400">Seleccioná o vinculá un hijo primero.</p>;
  }

  if (!resumen) {
    return <p className="text-center text-slate-400">Cargando…</p>;
  }

  return (
    <div>
      <h3 className="mb-2 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Deportes y Servicios</h3>
      <p className="mb-5 text-sm text-slate-500">Gestioná la inscripción de <b>{hijo?.nombre}</b> a deportes, transporte y comedor.</p>

      <div className="space-y-6">
        <DeportesSection estudianteId={hijoId} resumen={resumen.deportes} onCambio={cargar} />
        <TransporteSection estudianteId={hijoId} resumen={resumen.transporte} catalogo={recorridos} onCambio={cargar} />
        <ComedorSection estudianteId={hijoId} resumen={resumen.comedor} catalogo={turnos} onCambio={cargar} />
      </div>
    </div>
  );
}
