import { useEffect, useState } from 'react';
import { profesoresService } from '../../services/api/profesoresService';

export default function MisCursosPage() {
  const [materiasPorNivel, setMateriasPorNivel] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarCursos();
  }, []);

  const cargarCursos = async () => {
    const data = await profesoresService.me();
    if (data.exito) {
      setMateriasPorNivel(data.materiasPorNivel || []);
    }
    setLoading(false);
  };

  if (loading) return <div className="p-4">Cargando cursos...</div>;

  return (
    <div>
      <h3 className="mb-5 border-b border-blue-100 pb-3 text-xl font-bold dark:border-slate-700">Mis Cursos Asignados</h3>

      {materiasPorNivel.length === 0 ? (
        <p className="text-ink-faint">No tenés materias asignadas todavía.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {materiasPorNivel.map((grupo) => (
            <div key={grupo.nivelId}>
              <h4 className="mb-3 text-lg font-semibold text-accent">{grupo.nivel}</h4>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {grupo.materias.map((mc) => (
                  <div key={mc.id} className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <h5 className="font-bold text-ink dark:text-slate-100">{mc.materia}</h5>
                    <p className="text-sm text-ink-faint">Curso: {mc.curso}</p>
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
