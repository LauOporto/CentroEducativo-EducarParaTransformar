import { useEffect, useState } from 'react';
import { studyPlansService } from '../../services/api/studyPlansService';

export default function StudyPlansList() {
  const [planes, setPlanes] = useState(null);

  useEffect(() => {
    studyPlansService.list().then((data) => setPlanes(data.exito ? data.planes : []));
  }, []);

  if (planes === null) return <p className="text-center text-slate-400">Cargando planes…</p>;
  if (planes.length === 0) return <p className="text-center text-slate-400">No hay planes publicados todavía.</p>;

  return (
    <div className="flex flex-col gap-3">
      {planes.map((p) => (
        <div key={p.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h4 className="font-bold">{p.titulo}</h4>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span><i className="fas fa-book" /> {p.materia}</span>
            <span><i className="fas fa-user" /> {p.docente}</span>
          </div>
          <p className="mt-2 text-sm">
            <strong>Objetivos:</strong> {p.objetivos}
            <br />
            <strong>Contenidos:</strong> {p.contenidos}
          </p>
          {p.fileUrl && (
            <a href={p.fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-accent">
              <i className="fas fa-paperclip" /> Descargar
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
