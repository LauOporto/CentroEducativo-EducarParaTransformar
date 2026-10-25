import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import NotificationBell from '../ui/NotificationBell';
import BrandMark from '../landing/BrandMark';

export default function PanelLayout({ title, menuItems, topBar, children }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 -translate-x-full flex-col overflow-y-auto bg-blue-700 transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : ''
        }`}
      >
        <Link to="/" className="flex items-center gap-2.5 px-5 py-5">
          <BrandMark className="h-9 w-9 shrink-0 rounded-full bg-white p-0.5" />
          <span className="font-display text-base leading-tight text-white">Educar Para Transformar</span>
        </Link>
        <p className="px-5 pb-3 text-xs font-medium text-blue-200">{title}</p>
        <nav className="flex flex-1 flex-col gap-0.5 px-3 pb-4">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-white text-blue-700' : 'text-blue-100 hover:bg-blue-600 hover:text-white'
                }`
              }
            >
              <i className={`fas ${item.icon} w-4 text-center`} />
              {item.label}
              {!!item.badge && (
                <span className="ml-auto rounded-full bg-coral px-2 py-0.5 text-xs font-bold text-white">{item.badge}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-blue-100 bg-white px-4 py-3.5 sm:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-ink-soft hover:bg-blue-50 lg:hidden"
            aria-label="Abrir menú"
          >
            <i className="fas fa-bars text-lg" />
          </button>
          <div className="flex flex-1 items-center justify-end gap-4">
            <NotificationBell />
            <div className="group relative">
              <button className="flex items-center gap-2 text-sm font-semibold text-ink">
                <i className="fas fa-user-circle text-lg text-blue-500" /> <span className="hidden sm:inline">{user?.nombre}</span>
                <i className="fas fa-chevron-down text-xs text-ink-faint" />
              </button>
              {/* pt-2 (en vez de mt-2) evita el "hueco" entre el botón y el menú: ese
                  padding sigue siendo parte del área hoverable, así el mouse no
                  pierde el :hover al bajar desde el botón hasta "Cerrar sesión". */}
              <div className="invisible absolute right-0 top-full z-20 w-44 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
                <div className="rounded-lg border border-blue-100 bg-white py-1 shadow-float">
                  <button onClick={logout} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-coral hover:bg-blue-50">
                    <i className="fas fa-sign-out-alt" /> Cerrar sesión
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto max-w-5xl">
            {topBar && <div className="mb-5">{topBar}</div>}
            <div className="rounded-lg border border-blue-100 bg-white p-4 sm:p-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
