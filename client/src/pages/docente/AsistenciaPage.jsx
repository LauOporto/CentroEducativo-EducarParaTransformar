import { useEffect, useState } from 'react';
import { attendanceService } from '../../services/api/attendanceService';
import { studentsService } from '../../services/api/studentsService';
import { useToast } from '../../hooks/useToast';

const hoy = () => new Date().toISOString().slice(0, 10);
const ESTADOS = ['presente', 'ausente', 'tarde', 'justificado'];

export default function AsistenciaPage() {
  const toast = useToast();
  const [estudiantes, setEstudiantes] = useState(null);
  const [estado, setEstado] = useState({});

  const cargar = async () => {
    const sData = await studentsService.list();
    if (!sData.exito || !sData.estudiantes.length) {
      setEstudiantes([]);
      return;
    }
    const aData = await attendanceService.byDate(hoy());
    const existente = {};
    (aData.asistencias || []).forEach((a) => {
      existente[a.estudiante_id] = a.status.toLowerCase();
    });
    setEstudiantes(sData.estudiantes);
    setEstado(Object.fromEntries(sData.estudiantes.map((e) => [e.id, existente[e.id] || 'presente'])));
  };

  useEffect(() => {
    cargar();
  }, []);

  const firmar = async () => {
    const records = Object.entries(estado).map(([estudiante_id, status]) => ({
      estudiante_id: Number(estudiante_id),
      status: status.toUpperCase(),
    }));
    if (records.length === 0) {
      toast.warning('No hay alumnos para registrar.');
      return;
    }
    const res = await attendanceService.recordBulk({ fecha: hoy(), records });
    if (res.exito) {
      const cont = { presente: 0, ausente: 0, tarde: 0, justificado: 0 };
      Object.values(estado).forEach((s) => cont[s]++);
      toast.success(`Planilla firmada — ${cont.presente} presentes, ${cont.ausente} ausentes, ${cont.tarde} tardes, ${cont.justificado} justificadas.`);
    } else {
      toast.error(res.mensaje || 'No se pudo guardar la planilla.');
    }
  };

  return (
    <div>
      <h3 className="mb-2 border-b border-blue-100 pb-3 text-xl font-bold dark:border-slate-700">
        Registro de Asistencia Diaria por Curso
      </h3>
      <p className="mb-4 text-sm text-ink-faint">
        <i className="fas fa-calendar-day text-accent" /> Fecha:{' '}
        <strong>{new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
      </p>

      <div className="overflow-x-auto rounded-lg border border-blue-100 dark:border-slate-700">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-blue-50 dark:bg-slate-800">
              <th className="border-b border-blue-100 px-4 py-2.5 text-left dark:border-slate-700">DNI</th>
              <th className="border-b border-blue-100 px-4 py-2.5 text-left dark:border-slate-700">Alumno</th>
              <th className="border-b border-blue-100 px-4 py-2.5 text-left dark:border-slate-700">Curso</th>
              {ESTADOS.map((s) => (
                <th key={s} className="border-b border-blue-100 px-4 py-2.5 text-center capitalize dark:border-slate-700">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {estudiantes === null && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-ink-faint">Cargando lista de alumnos…</td></tr>
            )}
            {estudiantes?.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-ink-faint">No hay alumnos cargados.</td></tr>
            )}
            {estudiantes?.map((al) => (
              <tr key={al.id} className="border-b border-blue-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-2.5">{al.dni}</td>
                <td className="px-4 py-2.5">{al.nombre}</td>
                <td className="px-4 py-2.5">{al.curso || '—'}</td>
                {ESTADOS.map((s) => (
                  <td key={s} className="px-4 py-2.5 text-center">
                    <input
                      type="radio"
                      name={`asist_${al.id}`}
                      checked={estado[al.id] === s}
                      onChange={() => setEstado({ ...estado, [al.id]: s })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 text-right">
        <button onClick={firmar} className="rounded bg-accent px-5 py-2 text-sm font-semibold text-white">
          <i className="fas fa-signature" /> Firmar planilla
        </button>
      </div>
    </div>
  );
}
