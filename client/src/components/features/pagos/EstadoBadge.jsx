import { estiloDeEstado } from '../../../domain/pagos';

export default function EstadoBadge({ estado }) {
  const e = estiloDeEstado(estado);
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${e.cls}`}>
      {e.label}
    </span>
  );
}
