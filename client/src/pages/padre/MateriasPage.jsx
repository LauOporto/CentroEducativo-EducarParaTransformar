import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { gradesService } from '../../services/api/gradesService';
import MateriasGrid from '../../components/features/MateriasGrid';

export default function MateriasPage() {
  const { hijoId } = useOutletContext();
  const [notas, setNotas] = useState(null);

  useEffect(() => {
    if (!hijoId) {
      setNotas([]);
      return;
    }
    setNotas(null);
    gradesService.listByStudent(hijoId).then((data) => setNotas(data.exito ? data.notas : []));
  }, [hijoId]);

  return (
    <div>
      <h3 className="mb-2 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Materias que está cursando</h3>
      <p className="mb-5 text-sm text-slate-500">Resumen de cada asignatura, con cantidad de evaluaciones registradas y promedio actual.</p>
      {!hijoId ? (
        <p className="text-center text-slate-400">Seleccioná o vinculá un hijo primero.</p>
      ) : (
        <MateriasGrid notas={notas} loading={notas === null} />
      )}
    </div>
  );
}
