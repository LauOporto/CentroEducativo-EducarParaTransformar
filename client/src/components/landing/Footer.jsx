export default function Footer() {
  return (
    <footer className="bg-slate-900 px-6 py-10 text-slate-300">
      <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-3">
        <div>
          <h3 className="mb-2 font-bold text-white">Educar Para Transformar</h3>
          <p className="text-sm">Formando personas integrales para un futuro mejor.</p>
        </div>
        <div>
          <h3 className="mb-2 font-bold text-white">Enlaces</h3>
          <ul className="flex flex-col gap-1 text-sm">
            <li><a href="#nosotros" className="hover:text-white">Quiénes Somos</a></li>
            <li><a href="#niveles" className="hover:text-white">Niveles Educativos</a></li>
            <li><a href="#inscripcion" className="hover:text-white">Inscripción</a></li>
            <li><a href="#empleo" className="hover:text-white">Empleo</a></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-2 font-bold text-white">Contacto</h3>
          <p className="text-sm"><i className="fas fa-phone" /> (011) 1234-5678</p>
          <p className="text-sm"><i className="fas fa-envelope" /> info@centromixto.edu</p>
        </div>
      </div>
      <p className="mt-8 text-center text-xs text-slate-500">&copy; 2026 Educar Para Transformar. Todos los derechos reservados.</p>
    </footer>
  );
}
