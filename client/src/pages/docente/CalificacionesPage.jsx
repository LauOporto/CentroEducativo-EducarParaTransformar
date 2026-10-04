import { useEffect, useState } from 'react';
import { gradesService } from '../../services/api/gradesService';
import { studentsService } from '../../services/api/studentsService';
import { profesoresService } from '../../services/api/profesoresService';
import { useToast } from '../../hooks/useToast';
import { INSTANCIAS_EVALUACION } from '../../domain/materias';
import DataTable from '../../components/ui/DataTable';

const EMPTY = {
  materiaCursoId: '',
  estudiante_id: '',
  instancia_evaluacion: '',
  nota: '',
  fecha: new Date().toISOString().slice(0, 10),
};

const columns = [
  { key: 'alumno', label: 'Alumno' },
  { key: 'materia', label: 'Materia' },
  { key: 'instancia_evaluacion', label: 'Instancia' },
  { key: 'nota', label: 'Nota', render: (r) => <b>{r.nota}</b> },
  { key: 'fecha', label: 'Fecha' },
];

export default function CalificacionesPage() {
  const toast = useToast();
  const [estudiantes, setEstudiantes] = useState([]);
  const [historial, setHistorial] = useState(null);
  const [misCursos, setMisCursos] = useState([]);
  const [form, setForm] = useState(EMPTY);

  const cargarDatos = async () => {
    const [stRes, grRes, profRes] = await Promise.all([
      studentsService.list(),
      gradesService.listMine(),
      profesoresService.getMyAssignments()
    ]);
    if (stRes.exito) setEstudiantes(stRes.estudiantes);
    if (grRes.exito) setHistorial(grRes.notas);
    if (profRes.exito) setMisCursos(profRes.materias || []);
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const selectedMC = misCursos.find(mc => String(mc.id) === String(form.materiaCursoId));
  const estudiantesFiltrados = selectedMC 
    ? estudiantes.filter(e => e.cursoId === selectedMC.curso.id)
    : [];

  const submit = async (e) => {
    e.preventDefault();
    if (!selectedMC) return;

    const res = await gradesService.create({
      estudiante_id: form.estudiante_id,
      materia: selectedMC.materia.nombre,
      instancia_evaluacion: form.instancia_evaluacion,
      nota: form.nota,
      fecha: form.fecha,
    });
    
    if (res.exito) {
      toast.success('¡Calificación guardada correctamente!');
      setForm({ ...EMPTY, materiaCursoId: form.materiaCursoId, fecha: form.fecha });
      const grRes = await gradesService.listMine();
      if (grRes.exito) setHistorial(grRes.notas);
    } else {
      toast.error(res.mensaje || 'No se pudo guardar la nota.');
    }
  };

  return (
    <div>
      <h3 className="mb-5 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">
        Registro Oficial de Calificaciones (RF-8)
      </h3>

      <form onSubmit={submit} className="mb-8 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2">
        <select
          required
          value={form.materiaCursoId}
          onChange={(e) => setForm({ ...form, materiaCursoId: e.target.value, estudiante_id: '' })}
          className="sm:col-span-2 rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="">Seleccioná una materia y curso…</option>
          {misCursos.map((mc) => (
            <option key={mc.id} value={mc.id}>
              {mc.materia.nombre} — {mc.curso.nivel.toUpperCase()} {mc.curso.anio}° {mc.curso.division}
            </option>
          ))}
        </select>

        <select
          required
          disabled={!form.materiaCursoId}
          value={form.estudiante_id}
          onChange={(e) => setForm({ ...form, estudiante_id: e.target.value })}
          className="rounded border border-slate-300 p-2 text-sm disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:disabled:bg-slate-800"
        >
          <option value="">{form.materiaCursoId ? 'Alumno…' : 'Elegí materia y curso primero'}</option>
          {estudiantesFiltrados.map((al) => (
            <option key={al.id} value={al.id}>{al.nombre} — DNI {al.dni}</option>
          ))}
        </select>

        <select
          required
          value={form.instancia_evaluacion}
          onChange={(e) => setForm({ ...form, instancia_evaluacion: e.target.value })}
          className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="">Instancia de evaluación…</option>
          {INSTANCIAS_EVALUACION.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>

        <input
          required
          type="number"
          min={1}
          max={10}
          placeholder="Nota (1 al 10)"
          value={form.nota}
          onChange={(e) => setForm({ ...form, nota: e.target.value })}
          className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
        <input
          required
          type="date"
          value={form.fecha}
          onChange={(e) => setForm({ ...form, fecha: e.target.value })}
          className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        />

        <button type="submit" className="sm:col-span-2 sm:justify-self-end rounded bg-accent px-5 py-2 text-sm font-semibold text-white">
          <i className="fas fa-save" /> Guardar calificación
        </button>
      </form>

      <h4 className="mb-3 font-semibold text-slate-600 dark:text-slate-300">Últimas notas asentadas</h4>
      <DataTable columns={columns} rows={historial ?? []} loading={historial === null} emptyMessage="Aún no cargaste calificaciones." />
    </div>
  );
}
