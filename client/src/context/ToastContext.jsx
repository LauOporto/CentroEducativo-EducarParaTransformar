import { createContext, useCallback, useRef, useState } from 'react';

export const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback((message, variant = 'info', duration = 3500) => {
    const id = nextId++;
    setToasts((list) => [...list, { id, message, variant }]);
    const timer = setTimeout(() => dismiss(id), duration);
    timers.current.set(id, timer);
  }, [dismiss]);

  const api = {
    success: (msg, duration) => push(msg, 'success', duration),
    error: (msg, duration) => push(msg, 'error', duration),
    warning: (msg, duration) => push(msg, 'warning', duration),
    info: (msg, duration) => push(msg, 'info', duration),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`cursor-pointer rounded-lg px-4 py-3 shadow-lg text-sm font-medium text-white ${
              {
                success: 'bg-emerald-500',
                error: 'bg-red-500',
                warning: 'bg-amber-500',
                info: 'bg-slate-700',
              }[t.variant]
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
