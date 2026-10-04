import { useEffect, useState } from 'react';
import { profesoresService } from '../../services/api/profesoresService';

export default function MisCursosPage() {
  const [materias, setMaterias] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarCursos();
  }, []);

  const cargarCursos = async () => {
    const data = await profesoresService.getMyAssignments();
    if (data.exito) {
      setMaterias(data.materias || []);
    }
    setLoading(false);
  };

  if (loading) return <div className="p-4">Cargando cursos...</div>;

  const grupos = materias.reduce((acc, mc) => {
    const nivel = mc.curso?.nivel || 'Sin Nivel';
    if (!acc[nivel]) acc[nivel] = [];
    acc[nivel].push(mc);
    return acc;
  }, {});

  return (
    <div>
      <h3 className="mb-5 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Mis Cursos Asignados</h3>
      
      {Object.keys(grupos).length === 0 ? (
        <p className="text-slate-500">No tienes materias asignadas actualmente.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {Object.entries(grupos).map(([nivel, asignaciones]) => (
            <div key={nivel}>
              <h4 className="mb-3 text-lg font-semibold text-accent">{nivel}</h4>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {asignaciones.map((mc) => (
                  <div key={mc.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <h5 className="font-bold text-slate-800 dark:text-slate-100">{mc.materia?.nombre || 'Materia Desconocida'}</h5>
                    <p className="text-sm text-slate-500">Curso: {mc.curso?.anio || '?'}° {mc.curso?.division || '?'}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
