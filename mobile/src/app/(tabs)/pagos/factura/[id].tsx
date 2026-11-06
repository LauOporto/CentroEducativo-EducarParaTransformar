import { useLocalSearchParams } from 'expo-router';
import { PantallaFactura } from '@/pagos/PantallaFactura';

// GET /pagos/facturas/:id → elegir ítems y generar el comprobante (RF-50).
export default function Factura() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PantallaFactura key={id} facturaId={Number(id)} />;
}
