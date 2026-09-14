export default function MateriasCursoList({ materias, loading, mensaje }) {
  if (loading) return <p className="text-center text-slate-400">Cargando…</p>;
  if (mensaje) return <p className="text-center text-slate-400">{mensaje}</p>;
  if (!materias || materias.length === 0) {
    return <p className="text-center text-slate-400">Todavía no hay materias asignadas a este curso.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800">
            <th className="border-b border-slate-200 px-4 py-2.5 text-left font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">Materia</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">Profesor a cargo</th>
          </tr>
        </thead>
        <tbody>
          {materias.map((m) => (
            <tr key={`${m.materiaId}-${m.docenteId}`} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
              <td className="px-4 py-2.5"><i className="fas fa-book mr-2 text-accent" />{m.materia}</td>
              <td className="px-4 py-2.5">{m.docente}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
