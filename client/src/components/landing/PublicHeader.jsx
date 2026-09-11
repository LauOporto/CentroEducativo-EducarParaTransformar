import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { ROLE_ROUTES } from '../../domain/roles';

const NAV = [
  { href: '#nosotros', label: 'Quiénes Somos' },
  { href: '#niveles', label: 'Niveles Educativos' },
  { href: '#bienestar', label: 'Bienestar Estudiantil' },
  { href: '#noticias', label: 'Noticias' },
  { href: '#empleo', label: 'Empleo' },
];

export default function PublicHeader({ onLogin }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 bg-white shadow-sm dark:bg-slate-900">
      <div className="border-b border-slate-100 px-6 py-1.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span className="mr-4"><i className="fas fa-phone" /> (011) 1234-5678</span>
        <span><i className="fas fa-envelope" /> info@centromixto.edu</span>
      </div>
      <nav className="flex items-center justify-between px-6 py-3">
        <span className="flex items-center gap-2 text-lg font-bold">🎓 Educar Para Transformar</span>
        <ul className="hidden items-center gap-6 text-sm font-medium md:flex">
          {NAV.map((n) => (
            <li key={n.href}><a href={n.href} className="hover:text-accent">{n.label}</a></li>
          ))}
          <li>
            <button onClick={toggleTheme} aria-label="Cambiar tema" className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
              <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
            </button>
          </li>
          {user ? (
            <>
              <li>
                <Link to={ROLE_ROUTES[user.tipo]} className="font-semibold text-accent">
                  <i className="fas fa-tachometer-alt" /> Mi Panel
                </Link>
              </li>
              <li>
                <button onClick={logout} className="text-slate-500 hover:text-red-500">
                  <i className="fas fa-sign-out-alt" /> Salir
                </button>
              </li>
            </>
          ) : (
            <li>
              <button onClick={onLogin} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">
                <i className="fas fa-sign-in-alt" /> Iniciar sesión
              </button>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
