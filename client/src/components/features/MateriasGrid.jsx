const COLORES = ['#3498db', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316', '#84cc16'];

export default function MateriasGrid({ notas, loading }) {
  if (loading) return <p className="text-center text-slate-400">Cargando…</p>;
  if (!notas || notas.length === 0) {
    return <p className="text-center text-slate-400">No hay materias registradas para el alumno seleccionado.</p>;
  }

  const porMateria = new Map();
  notas.forEach((n) => {
    if (!porMateria.has(n.materia)) porMateria.set(n.materia, []);
    porMateria.get(n.materia).push(n);
  });

  const materias = [...porMateria.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {materias.map(([materia, evals], idx) => {
        const color = COLORES[idx % COLORES.length];
        const prom = evals.reduce((s, e) => s + Number(e.nota), 0) / evals.length;
        const ultima = evals[0];
        return (
          <div key={materia} className="overflow-hidden rounded-lg border border-slate-200 shadow-sm dark:border-slate-700">
            <div className="flex items-center gap-2 px-4 py-3 text-white" style={{ background: color }}>
              <i className="fas fa-book" />
              <strong>{materia}</strong>
            </div>
            <div className="p-4 text-sm">
              <div className="mb-2 flex justify-between"><span className="text-slate-500">Docente</span><span className="font-semibold">{ultima.nombre_docente}</span></div>
              <div className="mb-2 flex justify-between"><span className="text-slate-500">Evaluaciones</span><span className="font-semibold">{evals.length}</span></div>
              <div className="mb-2 flex justify-between"><span className="text-slate-500">Última nota</span><span className="font-semibold">{ultima.nota} ({ultima.instancia_evaluacion})</span></div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-slate-500">Promedio</span>
                <span className={`text-2xl font-bold ${prom >= 7 ? 'text-emerald-600' : prom >= 4 ? 'text-amber-600' : 'text-red-600'}`}>{prom.toFixed(2)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
