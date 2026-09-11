const NOTICIAS = [
  { fecha: '05/05/2026', texto: 'Comenzó el ciclo lectivo 2026 — les damos la bienvenida a todos los estudiantes y familias.' },
  { fecha: '28/04/2026', texto: 'Jornada de orientación vocacional para estudiantes de 5° año.' },
  { fecha: '20/04/2026', texto: 'Festival de ciencias y tecnología — ¡participá de nuestro festival anual!' },
];

export default function Noticias() {
  return (
    <section id="noticias" className="bg-slate-50 px-6 py-16 dark:bg-slate-900/40">
      <h2 className="mb-8 text-center text-3xl font-bold">Noticias</h2>
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {NOTICIAS.map((n) => (
          <div key={n.fecha} className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800">
            <span className="text-xs font-semibold text-accent">{n.fecha}</span>
            <p className="mt-1 text-sm">{n.texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
