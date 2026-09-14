import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import NotificationBell from '../ui/NotificationBell';

export default function PanelLayout({ title, menuItems, topBar, children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
        <Link to="/" className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
          <span className="text-xl">🎓</span> Educar Para Transformar
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            aria-label="Cambiar tema"
            className="rounded-full p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
          </button>
          <NotificationBell />
          <div className="group relative">
            <button className="flex items-center gap-2 text-sm font-semibold text-accent">
              <i className="fas fa-user-circle text-lg" /> {user?.nombre}
              <i className="fas fa-chevron-down text-xs" />
            </button>
            {/* pt-2 (en vez de mt-2 en el panel) evita el "hueco" entre el botón y el
                menú: ese padding sigue siendo parte del área hoverable, así el mouse
                no pierde el :hover al bajar desde el botón hasta "Cerrar sesión". */}
            <div className="invisible absolute right-0 top-full z-20 w-44 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
              <div className="rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <i className="fas fa-sign-out-alt" /> Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="px-5 py-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h2>
          </div>
          <nav className="flex flex-col">
            {menuItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 border-l-4 px-5 py-3 text-sm font-medium transition ${
                    isActive
                      ? 'border-accent bg-blue-50 text-accent dark:bg-slate-800'
                      : 'border-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`
                }
              >
                <i className={`fas ${item.icon} w-4 text-center`} />
                {item.label}
                {!!item.badge && (
                  <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{item.badge}</span>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-5xl">
            {topBar && <div className="mb-5">{topBar}</div>}
            <div className="rounded-xl border-t-4 border-accent bg-white p-6 shadow-sm dark:bg-slate-900">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
