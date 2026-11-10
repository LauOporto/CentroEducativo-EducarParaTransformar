import { DIAS } from '../../services/api/horariosService';

// Grilla semanal de solo lectura del horario de cursado. `mostrar` elige qué
// dato secundario se ve en cada bloque: el profesor (alumno/padre) o el curso
// (docente).
export default function HorarioSemanal({ horarios, mostrar = 'docente', vacio = 'Todavía no hay horario cargado.' }) {
  if (!horarios) return <p className="text-sm text-ink-faint">Cargando horario…</p>;
  if (horarios.length === 0) return <p className="text-sm text-ink-faint">{vacio}</p>;

  const dias = DIAS.filter((d) => horarios.some((h) => h.diaSemana === d.key));

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {dias.map((d) => (
        <div key={d.key} className="rounded-lg border border-blue-100 p-3 dark:border-slate-700">
          <h5 className="mb-2 text-sm font-bold text-ink">{d.label}</h5>
          <ul className="flex flex-col gap-2">
            {horarios
              .filter((h) => h.diaSemana === d.key)
              .map((h) => (
                <li key={h.id} className="rounded bg-blue-50 px-2.5 py-2 text-xs dark:bg-slate-800">
                  <p className="font-semibold text-blue-600">
                    {h.horaInicio}–{h.horaFin}
                  </p>
                  <p className="text-sm text-ink">{h.materia}</p>
                  <p className="text-ink-faint">{mostrar === 'curso' ? h.curso : h.docente}</p>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
