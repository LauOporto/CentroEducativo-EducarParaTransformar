import BrandMark from './BrandMark';
import { CONTACTO, INSTITUCION, REDES, whatsappUrl } from '../../config/institucion';

export default function Footer() {
  return (
    <footer className="bg-blue-700 px-6 py-14 text-blue-100">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-9 w-9 shrink-0 rounded-full bg-white p-0.5" />
            <span className="font-display text-base text-white">Educar Para Transformar</span>
          </div>
          <p className="mt-3 text-sm">Centro educativo de gestión privada. {INSTITUCION.ciudad}.</p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Institución</h3>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <a href="#nosotros" className="hover:text-white">
                Quiénes somos
              </a>
            </li>
            <li>
              <a href="#niveles" className="hover:text-white">
                Niveles educativos
              </a>
            </li>
            <li>
              <a href="#bienestar" className="hover:text-white">
                Bienestar estudiantil
              </a>
            </li>
            <li>
              <a href="#instalaciones" className="hover:text-white">
                Instalaciones y deportes
              </a>
            </li>
            <li>
              <a href="#noticias" className="hover:text-white">
                Noticias
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Trámites</h3>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <a href="#inscripcion" className="hover:text-white">
                Solicitud de inscripción
              </a>
            </li>
            <li>
              <a href="#empleo" className="hover:text-white">
                Empleo
              </a>
            </li>
            <li>
              <a href="#opiniones" className="hover:text-white">
                Dejanos tu opinión
              </a>
            </li>
            <li>
              <a href="#contacto" className="hover:text-white">
                Consultas
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Contacto</h3>
          <p className="text-sm">
            <a href={CONTACTO.telefonoHref} className="hover:text-white">
              <i className="fas fa-phone mr-1.5" /> {CONTACTO.telefono}
            </a>
          </p>
          <p className="mt-1 text-sm">
            <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="hover:text-white">
              <i className="fab fa-whatsapp mr-1.5" /> {CONTACTO.whatsappTexto}
            </a>
          </p>
          <p className="mt-1 break-all text-sm">
            <a href={`mailto:${CONTACTO.email}`} className="hover:text-white">
              <i className="fas fa-envelope mr-1.5" /> {CONTACTO.email}
            </a>
          </p>
          <div className="mt-4 flex gap-3">
            {REDES.map((r) => (
              <a
                key={r.nombre}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={r.nombre}
                title={r.nombre}
                className="text-lg hover:text-white"
              >
                <i className={`fab ${r.icono}`} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </div>
      <p className="mx-auto mt-12 max-w-6xl border-t border-white/10 pt-6 text-xs text-blue-200">
        © 2026 Educar Para Transformar. Todos los derechos reservados.
      </p>
    </footer>
  );
}
