export default function ModerationActions({ status, onApprove, onReject, onDelete }) {
  if (status === 'PENDIENTE') {
    return (
      <div className="flex gap-1.5">
        <button onClick={onApprove} title="Aprobar" className="rounded bg-accent px-2.5 py-1.5 text-xs text-white">
          <i className="fas fa-check" />
        </button>
        <button onClick={onReject} title="Rechazar" className="rounded bg-red-500 px-2.5 py-1.5 text-xs text-white">
          <i className="fas fa-times" />
        </button>
      </div>
    );
  }
  return (
    <button onClick={onDelete} title="Eliminar" className="rounded bg-red-500 px-2.5 py-1.5 text-xs text-white">
      <i className="fas fa-trash" />
    </button>
  );
}
