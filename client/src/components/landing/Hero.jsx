const PUNTOS = [
  { color: '#0F9E86', x: 78, y: 40 },
  { color: '#D1348A', x: 150, y: 28 },
  { color: '#7A4FCB', x: 168, y: 100 },
  { color: '#E85A32', x: 108, y: 150 },
  { color: '#1D63B4', x: 42, y: 112 },
];

function OrbitoMotif() {
  return (
    <svg viewBox="0 0 200 180" className="h-full w-full motion-safe:animate-orbit-in" aria-hidden="true">
      <circle cx="105" cy="90" r="72" fill="none" stroke="#AFCCF0" strokeWidth="1.5" strokeDasharray="4 7" />
      {PUNTOS.map((p) => (
        <line key={`l-${p.color}`} x1="105" y1="90" x2={p.x} y2={p.y} stroke="#AFCCF0" strokeWidth="1.5" />
      ))}
      {PUNTOS.map((p) => (
        <circle key={p.color} cx={p.x} cy={p.y} r="9" fill={p.color} />
      ))}
      <circle cx="105" cy="90" r="6" fill="#163A68" />
    </svg>
  );
}

export default function Hero() {
  return (
    <section id="inicio" className="border-b border-blue-100 bg-blue-50">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
        <div className="max-w-xl">
          <h1 className="font-display text-5xl leading-[1.05] text-ink sm:text-6xl">
            Educar es construir comunidad.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
            Abrimos las puertas en 2027 con los niveles Inicial, Primario y Secundario, acompañando de cerca a cada
            estudiante y a cada familia desde el primer día.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-5">
            <a
              href="#inscripcion"
              className="rounded bg-blue-500 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-600"
            >
              Solicitar inscripción
            </a>
            <a href="#niveles" className="text-sm font-semibold text-ink-soft hover:text-blue-500">
              Conocer los niveles educativos
            </a>
          </div>
        </div>

        <div className="hidden h-64 lg:block">
          <OrbitoMotif />
        </div>
      </div>
    </section>
  );
}
