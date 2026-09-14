import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { gradesService } from '../../services/api/gradesService';
import { studentsService } from '../../services/api/studentsService';
import { parentService } from '../../services/api/parentService';
import { useCursos } from '../../hooks/useCursos';
import { useToast } from '../../hooks/useToast';
import MateriasGrid from '../../components/features/MateriasGrid';
import MateriasCursoList from '../../components/features/MateriasCursoList';

function InscribirCursado({ hijoId, onInscripto }) {
  const toast = useToast();
  const { cursos } = useCursos();
  const [cursoId, setCursoId] = useState('');
  const [enviando, setEnviando] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!cursoId) return;
    setEnviando(true);
    const res = await parentService.inscribirCursado(hijoId, Number(cursoId));
    setEnviando(false);
    if (res.exito) {
      toast.success('Alumno inscripto al cursado.');
      onInscripto();
    } else {
      toast.error(res.message || res.mensaje || 'No se pudo inscribir.');
    }
  };

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/30">
      <p className="mb-3 font-semibold text-amber-800 dark:text-amber-300">
        <i className="fas fa-exclamation-circle mr-1" /> Este hijo todavía no está inscripto en ningún curso.
      </p>
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <select
          required value={cursoId} onChange={(e) => setCursoId(e.target.value)}
          className="min-w-[220px] flex-1 rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="">Elegir curso…</option>
          {cursos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
        </select>
        <button disabled={enviando} type="submit" className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          <i className="fas fa-check" /> Inscribir al cursado
        </button>
      </form>
    </div>
  );
}

export default function MateriasPage() {
  const { hijoId, hijos, refrescarHijos } = useOutletContext();
  const [notas, setNotas] = useState(null);
  const [materias, setMaterias] = useState(null);
  const [mensajeMaterias, setMensajeMaterias] = useState('');

  const hijo = hijos.find((h) => h.id === hijoId);

  useEffect(() => {
    if (!hijoId) {
      setNotas([]);
      return;
    }
    setNotas(null);
    gradesService.listByStudent(hijoId).then((data) => setNotas(data.exito ? data.notas : []));
  }, [hijoId]);

  useEffect(() => {
    if (!hijoId) {
      setMaterias([]);
      return;
    }
    setMaterias(null);
    studentsService.getMaterias(hijoId).then((data) => {
      setMaterias(data.exito ? data.materias : []);
      setMensajeMaterias(data.mensaje || '');
    });
    // Se vuelve a pedir cuando cambia el curso del hijo (ej: recién se
    // inscribió al cursado), no solo cuando cambia el hijo seleccionado.
  }, [hijoId, hijo?.curso]);

  if (!hijoId) {
    return <p className="text-center text-slate-400">Seleccioná o vinculá un hijo primero.</p>;
  }

  return (
    <div>
      <h3 className="mb-2 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Materias que está cursando</h3>

      {hijo && !hijo.curso ? (
        <InscribirCursado hijoId={hijoId} onInscripto={refrescarHijos} />
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">
            Curso: <b>{hijo?.curso}</b> — profesor a cargo de cada materia (RF-11).
          </p>
          <MateriasCursoList materias={materias} loading={materias === null} mensaje={mensajeMaterias} />

          <p className="mb-2 mt-8 text-sm text-slate-500">Resumen de calificaciones por materia.</p>
          <MateriasGrid notas={notas} loading={notas === null} />
        </>
      )}
    </div>
  );
}
