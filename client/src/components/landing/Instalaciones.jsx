const INSTALACIONES = [
  { icono: 'fa-swimmer', nombre: 'Pileta de natación' },
  { icono: 'fa-futbol', nombre: 'Canchas de fútbol' },
  { icono: 'fa-running', nombre: 'Pista de atletismo' },
  { icono: 'fa-basketball-ball', nombre: 'Gimnasio cubierto' },
  { icono: 'fa-utensils', nombre: 'Comedor' },
  { icono: 'fa-laptop-code', nombre: 'Laboratorio de computación' },
  { icono: 'fa-atom', nombre: 'Laboratorio de física' },
  { icono: 'fa-flask', nombre: 'Laboratorio de química' },
  { icono: 'fa-briefcase-medical', nombre: 'Enfermería' },
];

const DEPORTES = ['Atletismo', 'Natación', 'Fútbol', 'Artes Marciales', 'Vóleibol', 'Danza', 'Básquet', 'Ajedrez'];

export default function Instalaciones() {
  return (
    <section id="instalaciones" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-12 max-w-2xl">
        <div className="mb-5 h-1 w-14 rounded-full bg-coral" />
        <h2 className="font-display text-3xl text-ink sm:text-4xl">Instalaciones y deportes</h2>
        <p className="mt-5 text-lg leading-relaxed text-ink-soft">
          Un campus pensado para la jornada extendida, con espacios para aprender, investigar y moverse.
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
        {INSTALACIONES.map((i) => (
          <li key={i.nombre} className="flex items-center gap-3 text-ink">
            <i className={`fas ${i.icono} w-6 text-center text-lg text-coral`} aria-hidden="true" />
            <span>{i.nombre}</span>
          </li>
        ))}
      </ul>

      <div className="mt-14">
        <h3 className="font-display text-xl text-ink">Deportes</h3>
        <p className="mt-1 text-ink-soft">
          Cada estudiante puede inscribirse hasta en dos deportes, en grupos por nivel y horario a cargo de un profesor
          responsable.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {DEPORTES.map((d) => (
            <li key={d} className="rounded-full border border-blue-100 px-4 py-1.5 text-sm font-medium text-ink-soft">
              {d}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
