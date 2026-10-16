export default function PendingView({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-ink-faint">
      <i className="fas fa-hammer text-3xl" />
      <p className="max-w-xs text-sm">
        <strong className="text-ink-faint dark:text-slate-300">{label}</strong> todavía se sirve desde el sitio estático (<code>/frontend</code>). Falta migrarla a React.
      </p>
    </div>
  );
}
