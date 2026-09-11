import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { gradesService } from '../../services/api/gradesService';
import BoletinResumen from '../../components/features/BoletinResumen';

export default function BoletinPage() {
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
      <h3 className="mb-5 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Boletín e Historial Académico</h3>
      {!hijoId ? (
        <p className="text-center text-slate-400">Seleccioná o vinculá un hijo para ver su boletín.</p>
      ) : (
        <BoletinResumen notas={notas} loading={notas === null} />
      )}
    </div>
  );
}
