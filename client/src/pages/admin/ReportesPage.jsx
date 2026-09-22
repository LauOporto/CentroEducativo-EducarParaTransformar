import { useEffect, useState } from 'react';
import { studentsService } from '../../services/api/studentsService';
import { cursosService } from '../../services/api/cursosService';
import { reportesService } from '../../services/api/reportesService';
import { useToast } from '../../hooks/useToast';

function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Cada reporte implementado en el motor (backend/src/services/reportes)
// se suma acá como una tarjeta nueva, sin tocar las que ya existen.
function PorAlumnoCard() {
  const toast = useToast();
  const [estudiantes, setEstudiantes] = useState([]);
  const [estudianteId, setEstudianteId] = useState('');
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    studentsService.list().then((data) => setEstudiantes(data.exito ? data.estudiantes : []));
  }, []);

  const descargar = async (e) => {
    e.preventDefault();
    if (!estudianteId) return;
    setGenerando(true);
    try {
      const alumno = estudiantes.find((a) => a.id === Number(estudianteId));
      const blob = await reportesService.descargarPdf('por-alumno', { estudianteId });
      descargarBlob(blob, `reporte-alumno-${alumno?.legajo || alumno?.dni || estudianteId}.pdf`);
    } catch (err) {
      toast.error(err.message || 'No se pudo generar el reporte.');
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-700">
      <h4 className="mb-1 text-lg font-semibold"><i className="fas fa-file-pdf mr-2 text-accent" />Reporte por Alumno</h4>
      <p className="mb-4 text-sm text-slate-500">
        Curso, materias con profesor a cargo, deportes con horarios, transporte y comedor de un alumno.
      </p>
      <form onSubmit={descargar} className="flex flex-wrap gap-2">
        <select
          required value={estudianteId} onChange={(e) => setEstudianteId(e.target.value)}
          className="min-w-[280px] flex-1 rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="">Elegir alumno…</option>
          {estudiantes.map((a) => (
            <option key={a.id} value={a.id}>{a.nombre} — {a.legajo || a.dni}{a.curso ? ` (${a.curso})` : ''}</option>
          ))}
        </select>
        <button disabled={generando} type="submit" className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          <i className="fas fa-download" /> {generando ? 'Generando…' : 'Descargar PDF'}
        </button>
      </form>
    </div>
  );
}

function ListadoPorCursoCard() {
  const toast = useToast();
  const [cursos, setCursos] = useState([]);
  const [cursoId, setCursoId] = useState('');
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    cursosService.list().then((data) => setCursos(data.exito ? data.cursos : []));
  }, []);

  const descargar = async (e) => {
    e.preventDefault();
    setGenerando(true);
    try {
      const blob = await reportesService.descargarPdf('listado-alumnos-por-curso', cursoId ? { cursoId } : {});
      const curso = cursos.find((c) => c.id === Number(cursoId));
      descargarBlob(blob, curso ? `listado-alumnos-${curso.etiqueta}.pdf` : 'listado-alumnos-por-curso.pdf');
    } catch (err) {
      toast.error(err.message || 'No se pudo generar el reporte.');
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-700">
      <h4 className="mb-1 text-lg font-semibold"><i className="fas fa-file-pdf mr-2 text-accent" />Listado de Alumnos por Curso</h4>
      <p className="mb-4 text-sm text-slate-500">
        Nivel, curso, legajo, apellido y nombre — de toda la matrícula o de un curso puntual.
      </p>
      <form onSubmit={descargar} className="flex flex-wrap gap-2">
        <select
          value={cursoId} onChange={(e) => setCursoId(e.target.value)}
          className="min-w-[280px] flex-1 rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="">Todos los cursos</option>
          {cursos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
        </select>
        <button disabled={generando} type="submit" className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          <i className="fas fa-download" /> {generando ? 'Generando…' : 'Descargar PDF'}
        </button>
      </form>
    </div>
  );
}

export default function ReportesPage() {
  return (
    <div>
      <h3 className="mb-5 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Reportes Gerenciales</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <PorAlumnoCard />
        <ListadoPorCursoCard />
      </div>
    </div>
  );
}
