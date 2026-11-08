import BandejaComprobantes from '../../components/features/pagos/BandejaComprobantes';

export default function PagosPage() {
  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-ink">Pagos</h1>
      <p className="mb-5 text-sm text-ink-soft">Revisá los comprobantes de transferencia que cargan los padres.</p>
      <BandejaComprobantes />
    </div>
  );
}
