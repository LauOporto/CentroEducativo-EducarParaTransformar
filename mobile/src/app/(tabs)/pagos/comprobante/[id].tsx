import { useLocalSearchParams } from 'expo-router';
import { PantallaComprobante } from '@/pagos/PantallaComprobante';

// GET /pagos/comprobantes/:id → datos para transferir, carga de la
// transferencia, anulación y seguimiento de la revisión (RF-50, RNF-57).
export default function ComprobanteDePago() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PantallaComprobante key={id} comprobanteId={Number(id)} />;
}
