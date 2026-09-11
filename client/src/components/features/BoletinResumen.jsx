import DataTable from '../ui/DataTable';

const TRIMESTRES = ['1er Trimestre', '2do Trimestre', '3er Trimestre'];

function notaColor(v) {
  if (v === null || v === undefined) return 'text-slate-300';
  return Number(v) >= 7 ? 'text-emerald-600' : Number(v) >= 4 ? 'text-amber-600' : 'text-red-600';
}

function estadoBadge(prom) {
  if (prom >= 7) return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Aprobado</span>;
  if (prom >= 4) return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">A recuperar</span>;
  return <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">Desaprobado</span>;
}

const historialColumns = [
  { key: 'materia', label: 'Materia' },
  { key: 'instancia_evaluacion', label: 'Instancia de evaluación' },
  { key: 'nota', label: 'Calificación', render: (n) => <b className={notaColor(n.nota)}>{n.nota}</b> },
  { key: 'fecha', label: 'Fecha' },
  { key: 'nombre_docente', label: 'Docente' },
];

export default function BoletinResumen({ notas, loading }) {
  if (loading) return <p className="text-center text-slate-400">Cargando…</p>;
  if (!notas || notas.length === 0) {
    return <p className="text-center text-slate-400">No se registran calificaciones emitidas para el alumno.</p>;
  }

  const materias = [...new Set(notas.map((n) => n.materia))].sort();
  const promedioGeneral = (notas.reduce((s, n) => s + Number(n.nota), 0) / notas.length).toFixed(2);
  const aprobadas = materias.filter((m) => {
    const ms = notas.filter((n) => n.materia === m);
    return ms.reduce((s, n) => s + Number(n.nota), 0) / ms.length >= 7;
  }).length;

  const tiles = [
    { label: 'MATERIAS CURSANDO', value: materias.length, cls: 'text-accent bg-blue-50 dark:bg-blue-950/40' },
    { label: 'PROMEDIO GENERAL', value: promedioGeneral, cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
    { label: 'EVALUACIONES TOTALES', value: notas.length, cls: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40' },
    { label: 'MATERIAS APROBADAS', value: `${aprobadas} / ${materias.length}`, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
  ];

  const filasAgrupadas = materias.map((materia) => {
    const ms = notas.filter((n) => n.materia === materia);
    const porTrim = TRIMESTRES.map((t) => ms.find((n) => n.instancia_evaluacion === t)?.nota ?? null);
    const prom = ms.reduce((s, n) => s + Number(n.nota), 0) / ms.length;
    return { materia, porTrim, prom };
  });

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className={`rounded-lg p-4 ${t.cls}`}>
            <div className="text-xs font-semibold">{t.label}</div>
            <div className="mt-1 text-2xl font-bold">{t.value}</div>
          </div>
        ))}
      </div>

      <h4 className="mb-2 mt-6 font-semibold text-slate-600 dark:text-slate-300">Notas por materia y trimestre</h4>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800">
              <th className="border-b border-slate-200 px-4 py-2.5 text-left dark:border-slate-700">Materia</th>
              {TRIMESTRES.map((t) => <th key={t} className="border-b border-slate-200 px-4 py-2.5 text-center dark:border-slate-700">{t.replace('Trimestre', 'Trim.')}</th>)}
              <th className="border-b border-slate-200 px-4 py-2.5 text-center dark:border-slate-700">Promedio</th>
              <th className="border-b border-slate-200 px-4 py-2.5 text-center dark:border-slate-700">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filasAgrupadas.map((f) => (
              <tr key={f.materia} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-2.5 font-semibold">{f.materia}</td>
                {f.porTrim.map((v, i) => (
                  <td key={i} className={`px-4 py-2.5 text-center font-bold ${notaColor(v)}`}>{v ?? '—'}</td>
                ))}
                <td className="px-4 py-2.5 text-center font-bold">{f.prom.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-center">{estadoBadge(f.prom)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="mb-2 mt-6 font-semibold text-slate-600 dark:text-slate-300">Historial completo (todas las evaluaciones)</h4>
      <DataTable columns={historialColumns} rows={notas} />
    </div>
  );
}
