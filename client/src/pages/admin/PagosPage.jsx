import { useState } from 'react';
import BandejaComprobantes from '../../components/features/pagos/BandejaComprobantes';
import PreciosPanel from '../../components/features/pagos/PreciosPanel';
import FacturacionPanel from '../../components/features/pagos/FacturacionPanel';

const TABS = [
  { key: 'comprobantes', label: 'Comprobantes', icon: 'fa-file-invoice-dollar' },
  { key: 'precios', label: 'Precios', icon: 'fa-tags' },
  { key: 'facturacion', label: 'Facturación', icon: 'fa-receipt' },
];

export default function PagosPage() {
  const [tab, setTab] = useState('comprobantes');

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-ink">Pagos</h1>
      <p className="mb-5 text-sm text-ink-soft">
        Revisá las transferencias de los padres, fijá los precios y emití la facturación mensual.
      </p>

      <div
        role="tablist"
        aria-label="Secciones de pagos"
        className="mb-5 flex gap-1 overflow-x-auto border-b border-blue-100"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              tab === t.key ? 'border-accent text-accent' : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            <i className={`fas ${t.icon}`} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'comprobantes' && <BandejaComprobantes />}
        {tab === 'precios' && <PreciosPanel />}
        {tab === 'facturacion' && <FacturacionPanel />}
      </div>
    </div>
  );
}
