const VALORES = [
  { titulo: 'Comprometidos', texto: 'Miembros éticos y activos de una comunidad global.', color: 'bg-blue-500' },
  { titulo: 'Conscientes', texto: 'Agentes de cambio que se conocen a sí mismos.', color: 'bg-teal' },
  { titulo: 'Seguros e innovadores', texto: 'Capaces de crear, proponer y animarse a lo nuevo.', color: 'bg-coral' },
  { titulo: 'Colaborativos', texto: 'Aprenden con otros y construyen en equipo.', color: 'bg-violet' },
];

export default function Nosotros() {
  return (
    <section id="nosotros" className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="max-w-2xl">
          <div className="mb-5 h-1 w-14 rounded-full bg-blue-500" />
          <h2 className="font-display text-3xl text-ink sm:text-4xl">Quiénes somos</h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            "Educar para Transformar" es un centro educativo de gestión privada y alta calidad educativa, ubicado en las
            afueras de la ciudad de Resistencia. Iniciamos nuestras actividades en marzo de 2027 con los niveles
            Inicial, Primario y Secundario, todos con <strong className="text-ink">jornada extendida</strong>.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Nuestro proyecto combina una formación académica sólida con idiomas, deporte, ciencia y tecnología, y un
            acompañamiento cercano de cada estudiante y de su familia.
          </p>
          <blockquote className="mt-8 border-l-4 border-blue-500 pl-5 font-display text-xl leading-snug text-ink">
            Inspiramos, desafiamos y empoderamos a todos nuestros alumnos a ser miembros comprometidos y éticos de una
            comunidad global, para que se conviertan en agentes de cambio conscientes de sí mismos, seguros, innovadores
            y colaborativos.
          </blockquote>
        </div>

        <ul className="grid content-start gap-6 sm:grid-cols-2 lg:grid-cols-1">
          {VALORES.map((v) => (
            <li key={v.titulo} className="flex gap-4">
              <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${v.color}`} aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-ink">{v.titulo}</h3>
                <p className="text-ink-soft">{v.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
