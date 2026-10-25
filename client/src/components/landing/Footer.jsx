import BrandMark from './BrandMark';

export default function Footer() {
  return (
    <footer className="bg-blue-700 px-6 py-14 text-blue-100">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-9 w-9 shrink-0 rounded-full bg-white p-0.5" />
            <span className="font-display text-base text-white">Educar Para Transformar</span>
          </div>
          <p className="mt-3 text-sm">Educar es construir comunidad, un vínculo a la vez.</p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Enlaces</h3>
          <ul className="flex flex-col gap-2 text-sm">
            <li><a href="#nosotros" className="hover:text-white">Quiénes somos</a></li>
            <li><a href="#niveles" className="hover:text-white">Niveles educativos</a></li>
            <li><a href="#inscripcion" className="hover:text-white">Inscripción</a></li>
            <li><a href="#empleo" className="hover:text-white">Empleo</a></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Contacto</h3>
          <p className="text-sm"><i className="fas fa-phone mr-1.5" /> (011) 1234-5678</p>
          <p className="mt-1 text-sm"><i className="fas fa-envelope mr-1.5" /> info@centromixto.edu</p>
        </div>
      </div>
      <p className="mx-auto mt-12 max-w-6xl border-t border-white/10 pt-6 text-xs text-blue-200">
        © 2026 Educar Para Transformar. Todos los derechos reservados.
      </p>
    </footer>
  );
}
