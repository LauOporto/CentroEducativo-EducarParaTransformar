const SERVICIOS = [
  {
    icono: 'fa-hands-helping',
    titulo: 'Servicio de apoyo estudiantil',
    texto: 'Tutorías y clases de apoyo por la tarde para acompañar a quienes necesitan reforzar contenidos.',
  },
  {
    icono: 'fa-user-friends',
    titulo: 'Equipo de orientación',
    texto: 'Acompaña el desarrollo emocional y social de cada estudiante, en contacto con familias y docentes.',
  },
  {
    icono: 'fa-briefcase-medical',
    titulo: 'Enfermería',
    texto: 'Atención durante toda la jornada, primeros auxilios y seguimiento de fichas de salud.',
  },
  {
    icono: 'fa-utensils',
    titulo: 'Comedor',
    texto: 'Desayuno, almuerzo y merienda con menús planificados, pensados para la jornada extendida.',
  },
  {
    icono: 'fa-bus',
    titulo: 'Micros de traslado',
    texto: 'Cuatro recorridos que conectan los distintos barrios de la ciudad con el colegio.',
  },
];

export default function Bienestar() {
  return (
    <section id="bienestar" className="border-y border-blue-100 bg-blue-50">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <div className="mb-5 h-1 w-14 rounded-full bg-teal" />
          <h2 className="font-display text-3xl text-ink sm:text-4xl">Bienestar estudiantil</h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            Cuidamos a cada estudiante durante toda la jornada: lo académico, lo emocional y lo cotidiano.
          </p>
        </div>
        <ul className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICIOS.map((s) => (
            <li key={s.titulo} className="flex gap-4">
              <i className={`fas ${s.icono} mt-1 w-6 shrink-0 text-xl text-teal`} aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-ink">{s.titulo}</h3>
                <p className="mt-1 text-ink-soft">{s.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
