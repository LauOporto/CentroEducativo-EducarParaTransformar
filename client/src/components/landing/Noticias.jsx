const NOTICIAS = [
  { fecha: '05 may 2026', texto: 'Comenzó el ciclo lectivo 2026 — les damos la bienvenida a todos los estudiantes y familias.' },
  { fecha: '28 abr 2026', texto: 'Jornada de orientación vocacional para estudiantes de 5° año.' },
  { fecha: '20 abr 2026', texto: 'Festival de ciencias y tecnología — participá de nuestro festival anual.' },
];

export default function Noticias() {
  return (
    <section id="noticias">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 max-w-2xl">
          <div className="mb-5 h-1 w-14 rounded-full bg-violet" />
          <h2 className="font-display text-3xl text-ink sm:text-4xl">Noticias</h2>
        </div>
        <div className="max-w-2xl divide-y divide-blue-100">
          {NOTICIAS.map((n) => (
            <div key={n.fecha} className="flex flex-col gap-1 py-5 sm:flex-row sm:gap-8">
              <span className="shrink-0 text-sm text-ink-faint sm:w-28">{n.fecha}</span>
              <p className="text-ink">{n.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
