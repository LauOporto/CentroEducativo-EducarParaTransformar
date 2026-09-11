export default function DataTable({ columns, rows, rowKey = 'id', emptyMessage = 'Sin resultados.', loading = false }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800">
            {columns.map((col) => (
              <th key={col.key} className="border-b border-slate-200 px-4 py-2.5 text-left font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-slate-400">
                Cargando…
              </td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          )}
          {!loading &&
            rows.map((row) => (
              <tr key={row[rowKey]} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2.5">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
