import { useEffect, useState } from 'react';
import { studentsService } from '../../services/api/studentsService';
import { cursosService } from '../../services/api/cursosService';
import { nivelesService } from '../../services/api/nivelesService';
import { materiasService } from '../../services/api/materiasService';
import { deportesService } from '../../services/api/deportesService';
import { transporteService } from '../../services/api/transporteService';
import { adminService } from '../../services/api/adminService';
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

// Tarjeta genérica para los reportes cuyos filtros son 1-2 selects
// simples (id → etiqueta). Los reportes con lógica de armado de nombre
// de archivo más particular (ej. el que depende del alumno elegido)
// siguen usando su propio componente arriba, como PorAlumnoCard.
function FiltroReporteCard({ titulo, descripcion, reportKey, nombreArchivo, campos }) {
  const toast = useToast();
  const [generando, setGenerando] = useState(false);

  const descargar = async (e) => {
    e.preventDefault();
    if (campos.some((c) => c.required && !c.value)) return;
    setGenerando(true);
    try {
      const params = {};
      campos.forEach((c) => { if (c.value) params[c.key] = c.value; });
      const blob = await reportesService.descargarPdf(reportKey, params);
      descargarBlob(blob, nombreArchivo);
    } catch (err) {
      toast.error(err.message || 'No se pudo generar el reporte.');
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-700">
      <h4 className="mb-1 text-lg font-semibold"><i className="fas fa-file-pdf mr-2 text-accent" />{titulo}</h4>
      <p className="mb-4 text-sm text-slate-500">{descripcion}</p>
      <form onSubmit={descargar} className="flex flex-wrap gap-2">
        {campos.map((c) => (
          <select
            key={c.key}
            required={c.required}
            value={c.value}
            onChange={(e) => c.onChange(e.target.value)}
            className="min-w-[200px] flex-1 rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          >
            <option value="">{c.placeholder}</option>
            {c.opciones.map((o) => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
          </select>
        ))}
        <button disabled={generando} type="submit" className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          <i className="fas fa-download" /> {generando ? 'Generando…' : 'Descargar PDF'}
        </button>
      </form>
    </div>
  );
}

function PorDocenteCard() {
  const [docentes, setDocentes] = useState([]);
  const [docenteId, setDocenteId] = useState('');

  useEffect(() => {
    adminService.listUsers({ role: 'DOCENTE' }).then((data) => {
      setDocentes(data.exito ? data.usuarios.filter((u) => u.isActive) : []);
    });
  }, []);

  return (
    <FiltroReporteCard
      titulo="Reporte por Docente"
      descripcion="Cursos a cargo agrupados por nivel educativo, y horarios de las actividades deportivas que dicta."
      reportKey="por-docente"
      nombreArchivo="reporte-docente.pdf"
      campos={[{
        key: 'docenteId', placeholder: 'Elegir profesor…', required: true,
        value: docenteId, onChange: setDocenteId,
        opciones: docentes.map((d) => ({ id: d.id, etiqueta: `${d.nombre} — ${d.dni}` })),
      }]}
    />
  );
}

function ListadoPorMateriaCard() {
  const [materias, setMaterias] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [materiaId, setMateriaId] = useState('');
  const [cursoId, setCursoId] = useState('');

  useEffect(() => {
    materiasService.list().then((data) => setMaterias(data.exito ? data.materias : []));
    cursosService.list().then((data) => setCursos(data.exito ? data.cursos : []));
  }, []);

  return (
    <FiltroReporteCard
      titulo="Listado de Alumnos por Materia"
      descripcion="Nivel, curso, materia, profesor a cargo, alumno y legajo."
      reportKey="listado-alumnos-por-materia"
      nombreArchivo="listado-alumnos-por-materia.pdf"
      campos={[
        {
          key: 'materiaId', placeholder: 'Todas las materias', value: materiaId, onChange: setMateriaId,
          opciones: materias.map((m) => ({ id: m.id, etiqueta: m.nombre })),
        },
        {
          key: 'cursoId', placeholder: 'Todos los cursos', value: cursoId, onChange: setCursoId,
          opciones: cursos.map((c) => ({ id: c.id, etiqueta: c.etiqueta })),
        },
      ]}
    />
  );
}

function ListadoDocentesPorNivelCard() {
  const [niveles, setNiveles] = useState([]);
  const [nivelId, setNivelId] = useState('');

  useEffect(() => {
    nivelesService.list().then((data) => setNiveles(data.exito ? data.niveles : []));
  }, []);

  return (
    <FiltroReporteCard
      titulo="Listado de Docentes por Nivel"
      descripcion="Nivel, profesor, materias a cargo y cursos."
      reportKey="listado-docentes-por-nivel"
      nombreArchivo="listado-docentes-por-nivel.pdf"
      campos={[{
        key: 'nivelId', placeholder: 'Todos los niveles', value: nivelId, onChange: setNivelId,
        opciones: niveles.map((n) => ({ id: n.id, etiqueta: n.nombre })),
      }]}
    />
  );
}

function ListadoPorDeporteCard() {
  const [deportes, setDeportes] = useState([]);
  const [deporteId, setDeporteId] = useState('');

  useEffect(() => {
    deportesService.list().then((data) => setDeportes(data.exito ? data.deportes : []));
  }, []);

  return (
    <FiltroReporteCard
      titulo="Listado de Alumnos por Deporte"
      descripcion="Deporte, alumno, curso y nivel educativo."
      reportKey="listado-alumnos-por-deporte"
      nombreArchivo="listado-alumnos-por-deporte.pdf"
      campos={[{
        key: 'deporteId', placeholder: 'Todos los deportes', value: deporteId, onChange: setDeporteId,
        opciones: deportes.map((d) => ({ id: d.id, etiqueta: d.nombre })),
      }]}
    />
  );
}

function ListadoPorDeporteYNivelCard() {
  const [deportes, setDeportes] = useState([]);
  const [niveles, setNiveles] = useState([]);
  const [deporteId, setDeporteId] = useState('');
  const [nivelId, setNivelId] = useState('');

  useEffect(() => {
    deportesService.list().then((data) => setDeportes(data.exito ? data.deportes : []));
    nivelesService.list().then((data) => setNiveles(data.exito ? data.niveles : []));
  }, []);

  return (
    <FiltroReporteCard
      titulo="Listado de Alumnos por Deporte y Nivel"
      descripcion="Deporte, alumno y curso, agrupado por nivel educativo (obligatorio elegir uno)."
      reportKey="listado-alumnos-por-deporte-y-nivel"
      nombreArchivo="listado-alumnos-deporte-nivel.pdf"
      campos={[
        {
          key: 'nivelId', placeholder: 'Elegir nivel…', required: true, value: nivelId, onChange: setNivelId,
          opciones: niveles.map((n) => ({ id: n.id, etiqueta: n.nombre })),
        },
        {
          key: 'deporteId', placeholder: 'Todos los deportes', value: deporteId, onChange: setDeporteId,
          opciones: deportes.map((d) => ({ id: d.id, etiqueta: d.nombre })),
        },
      ]}
    />
  );
}

function ListadoPorDeporteNivelHorarioCard() {
  const [deportes, setDeportes] = useState([]);
  const [niveles, setNiveles] = useState([]);
  const [deporteId, setDeporteId] = useState('');
  const [nivelId, setNivelId] = useState('');

  useEffect(() => {
    deportesService.list().then((data) => setDeportes(data.exito ? data.deportes : []));
    nivelesService.list().then((data) => setNiveles(data.exito ? data.niveles : []));
  }, []);

  return (
    <FiltroReporteCard
      titulo="Alumnos por Deporte, Nivel, Horario y Profesor"
      descripcion="Suma día, horario y profesor a cargo de cada grupo de deporte."
      reportKey="listado-alumnos-por-deporte-nivel-horario"
      nombreArchivo="listado-alumnos-deporte-nivel-horario.pdf"
      campos={[
        {
          key: 'deporteId', placeholder: 'Todos los deportes', value: deporteId, onChange: setDeporteId,
          opciones: deportes.map((d) => ({ id: d.id, etiqueta: d.nombre })),
        },
        {
          key: 'nivelId', placeholder: 'Todos los niveles', value: nivelId, onChange: setNivelId,
          opciones: niveles.map((n) => ({ id: n.id, etiqueta: n.nombre })),
        },
      ]}
    />
  );
}

function ListadoPorRecorridoCard() {
  const [recorridos, setRecorridos] = useState([]);
  const [recorridoId, setRecorridoId] = useState('');

  useEffect(() => {
    transporteService.list().then((data) => setRecorridos(data.exito ? data.recorridos : []));
  }, []);

  return (
    <FiltroReporteCard
      titulo="Listado de Alumnos por Recorrido"
      descripcion="Alumnos agrupados por recorrido de transporte, con horario de salida y regreso."
      reportKey="listado-alumnos-por-recorrido"
      nombreArchivo="listado-alumnos-por-recorrido.pdf"
      campos={[{
        key: 'recorridoId', placeholder: 'Todos los recorridos', value: recorridoId, onChange: setRecorridoId,
        opciones: recorridos.map((r) => ({ id: r.id, etiqueta: r.nombre })),
      }]}
    />
  );
}

export default function ReportesPage() {
  return (
    <div>
      <h3 className="mb-5 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Reportes Gerenciales</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <PorAlumnoCard />
        <ListadoPorCursoCard />
        <PorDocenteCard />
        <ListadoPorMateriaCard />
        <ListadoDocentesPorNivelCard />
        <ListadoPorDeporteCard />
        <ListadoPorDeporteYNivelCard />
        <ListadoPorDeporteNivelHorarioCard />
        <ListadoPorRecorridoCard />
      </div>
    </div>
  );
}
