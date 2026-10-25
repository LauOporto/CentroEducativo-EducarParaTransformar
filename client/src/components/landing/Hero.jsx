import BrandMark from './BrandMark';

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

        <div className="mx-auto w-full max-w-[16rem] sm:max-w-xs lg:max-w-sm">
          <BrandMark full animated className="h-auto w-full motion-safe:animate-orbit-in" />
        </div>
      </div>
    </section>
  );
}
