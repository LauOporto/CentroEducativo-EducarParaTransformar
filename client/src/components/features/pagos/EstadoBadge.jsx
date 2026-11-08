import { ESTADO_ESTILO } from '../../../domain/pagos';

export default function EstadoBadge({ estado }) {
  const e = ESTADO_ESTILO[estado] ?? { label: estado, cls: 'bg-slate-100 text-slate-700' };
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${e.cls}`}>
      {e.label}
    </span>
  );
}
