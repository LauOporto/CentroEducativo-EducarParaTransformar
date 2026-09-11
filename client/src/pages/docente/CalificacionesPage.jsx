import { useEffect, useState } from 'react';
import { gradesService } from '../../services/api/gradesService';
import { studentsService } from '../../services/api/studentsService';
import { useToast } from '../../hooks/useToast';
import { MATERIAS_POR_NIVEL, INSTANCIAS_EVALUACION } from '../../domain/materias';
import DataTable from '../../components/ui/DataTable';

const EMPTY = {
  nivel: '',
  materia: '',
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
  const [form, setForm] = useState(EMPTY);

  const cargarHistorial = async () => {
    const data = await gradesService.listMine();
    setHistorial(data.exito ? data.notas : []);
  };

  useEffect(() => {
    studentsService.list().then((data) => data.exito && setEstudiantes(data.estudiantes));
    cargarHistorial();
  }, []);

  const materiasDisponibles = MATERIAS_POR_NIVEL[form.nivel] ?? [];

  const submit = async (e) => {
    e.preventDefault();
    const res = await gradesService.create({
      estudiante_id: form.estudiante_id,
      materia: form.materia,
      instancia_evaluacion: form.instancia_evaluacion,
      nota: form.nota,
      fecha: form.fecha,
    });
    if (res.exito) {
      toast.success('¡Calificación guardada correctamente!');
      setForm({ ...EMPTY, fecha: form.fecha });
      cargarHistorial();
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
          value={form.nivel}
          onChange={(e) => setForm({ ...form, nivel: e.target.value, materia: '' })}
          className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="">Nivel educativo…</option>
          <option value="inicial">Nivel Inicial (Jardín)</option>
          <option value="primario">Nivel Primario</option>
          <option value="secundario">Nivel Secundario</option>
        </select>

        <select
          required
          disabled={!form.nivel}
          value={form.materia}
          onChange={(e) => setForm({ ...form, materia: e.target.value })}
          className="rounded border border-slate-300 p-2 text-sm disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:disabled:bg-slate-800"
        >
          <option value="">{form.nivel ? 'Materia…' : 'Elegí un nivel primero'}</option>
          {materiasDisponibles.map((m) => (
            <option key={m.nombre} value={m.nombre}>{m.nombre}</option>
          ))}
        </select>

        <select
          required
          value={form.estudiante_id}
          onChange={(e) => setForm({ ...form, estudiante_id: e.target.value })}
          className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="">Alumno…</option>
          {estudiantes.map((al) => (
            <option key={al.id} value={al.id}>{al.nombre}{al.curso ? ` (${al.curso})` : ''} — DNI {al.dni}</option>
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
