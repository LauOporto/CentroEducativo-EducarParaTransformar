const NIVELES = [
  { nombre: 'Inicial', rango: 'Sala de 3 a Sala de 5', desc: 'Estimulación temprana y juego como motor del aprendizaje.', color: '#0F9E86' },
  { nombre: 'Primario', rango: '1° a 6° grado', desc: 'Bases sólidas en lengua, matemática y ciencias.', color: '#1D63B4' },
  { nombre: 'Secundario', rango: '1° a 5° año', desc: 'Orientación vocacional y preparación para el nivel superior.', color: '#E85A32' },
];

export default function Niveles() {
  return (
    <section id="niveles" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-14 max-w-2xl">
        <div className="mb-5 h-1 w-14 rounded-full bg-blue-500" />
        <h2 className="font-display text-3xl text-ink sm:text-4xl">Niveles educativos</h2>
        <p className="mt-5 text-lg leading-relaxed text-ink-soft">
          Un mismo recorrido pedagógico, pensado para sostenerse de un nivel al siguiente.
        </p>
      </div>

      <div className="grid gap-10 sm:grid-cols-3">
        {NIVELES.map((n, i) => (
          <div key={n.nombre} className="relative pl-7">
            <span
              className="absolute left-0 top-1.5 h-3 w-3 rounded-full"
              style={{ backgroundColor: n.color }}
              aria-hidden="true"
            />
            {i < NIVELES.length - 1 && (
              <span
                className="absolute left-[5px] top-6 hidden h-[calc(100%+2.5rem)] w-px bg-blue-200 sm:block sm:h-px sm:w-[calc(100%+2.5rem)] sm:top-1.5"
                aria-hidden="true"
              />
            )}
            <span className="text-sm font-semibold" style={{ color: n.color }}>
              {n.rango}
            </span>
            <h3 className="mt-1.5 font-display text-2xl text-ink">{n.nombre}</h3>
            <p className="mt-2.5 text-ink-soft">{n.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
