export default function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`w-full ${wide ? 'max-w-xl' : 'max-w-sm'} rounded-lg bg-white p-7 shadow-float`}>
        <div className="mb-5 flex items-start justify-between">
          <h2 className="font-display text-xl text-ink">{title}</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink" aria-label="Cerrar">
            <i className="fas fa-times" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
