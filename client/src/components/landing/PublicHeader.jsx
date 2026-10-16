import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_ROUTES } from '../../domain/roles';
import BrandMark from './BrandMark';

const NAV = [
  { href: '#nosotros', label: 'Quiénes somos' },
  { href: '#niveles', label: 'Niveles educativos' },
  { href: '#bienestar', label: 'Bienestar estudiantil' },
  { href: '#noticias', label: 'Noticias' },
  { href: '#empleo', label: 'Empleo' },
];

export default function PublicHeader({ onLogin }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-blue-100 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
        <a href="#inicio" className="flex shrink-0 items-center gap-3" onClick={() => setMenuOpen(false)}>
          <BrandMark className="h-9 w-9 shrink-0" />
          <span className="whitespace-nowrap font-display text-lg leading-tight text-ink">
            Educar Para Transformar
          </span>
        </a>

        <nav className="hidden items-center gap-6 whitespace-nowrap text-sm font-medium text-ink-soft xl:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="transition hover:text-blue-500">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-4">
          <a href="tel:0111234-5678" className="hidden items-center gap-1.5 whitespace-nowrap text-sm text-ink-soft md:flex">
            <i className="fas fa-phone text-xs" /> (011) 1234-5678
          </a>
          <div className="hidden items-center gap-4 xl:flex">
            {user ? (
              <>
                <Link to={ROLE_ROUTES[user.tipo]} className="text-sm font-semibold text-blue-500 hover:text-blue-600">
                  Mi panel
                </Link>
                <button onClick={logout} className="text-sm text-ink-soft hover:text-coral">
                  Salir
                </button>
              </>
            ) : (
              <button
                onClick={onLogin}
                className="rounded bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
              >
                Iniciar sesión
              </button>
            )}
          </div>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-ink-soft hover:bg-blue-50 xl:hidden"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
          >
            <i className={`fas ${menuOpen ? 'fa-times' : 'fa-bars'} text-lg`} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-blue-100 bg-paper px-6 py-4 xl:hidden">
          <nav className="flex flex-col gap-1 text-sm font-medium text-ink-soft">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                className="rounded px-2 py-2.5 transition hover:bg-blue-50 hover:text-blue-500"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-3 border-t border-blue-100 pt-4">
            <a href="tel:0111234-5678" className="flex items-center gap-1.5 px-2 text-sm text-ink-soft">
              <i className="fas fa-phone text-xs" /> (011) 1234-5678
            </a>
            {user ? (
              <div className="flex items-center justify-between px-2">
                <Link
                  to={ROLE_ROUTES[user.tipo]}
                  onClick={() => setMenuOpen(false)}
                  className="text-sm font-semibold text-blue-500"
                >
                  Mi panel
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="text-sm text-ink-soft hover:text-coral"
                >
                  Salir
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onLogin();
                }}
                className="mx-2 rounded bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600"
              >
                Iniciar sesión
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
