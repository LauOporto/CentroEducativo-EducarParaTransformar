export default function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`w-full ${wide ? 'max-w-xl' : 'max-w-sm'} rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-800`}>
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Cerrar">
            <i className="fas fa-times" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
