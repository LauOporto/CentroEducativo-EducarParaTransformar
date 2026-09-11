import { useState } from 'react';
import { useNotifications } from '../../hooks/useNotifications';

function formatFechaHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationBell() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        <i className="fas fa-bell" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <strong className="text-sm">Notificaciones</strong>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs font-medium text-accent hover:underline">
                  Marcar todo
                </button>
              )}
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {items.length === 0 && (
                <li className="p-6 text-center text-sm text-slate-400">Sin notificaciones</li>
              )}
              {items.slice(0, 8).map((n) => (
                <li
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`cursor-pointer border-b border-slate-100 px-4 py-3 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700 ${
                    n.isRead ? '' : 'bg-blue-50 dark:bg-slate-700/50'
                  }`}
                >
                  <div className="font-semibold">{n.titulo}</div>
                  <div className="mt-0.5 text-slate-500 dark:text-slate-400">{n.contenido}</div>
                  <div className="mt-1 text-xs text-slate-400">{formatFechaHora(n.createdAt)}</div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
