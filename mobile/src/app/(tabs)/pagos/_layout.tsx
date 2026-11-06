import { Stack } from 'expo-router';
import { colors } from '@/theme';

// Pestaña Pagos (RF-49 y RF-50): estado de cuenta → factura → comprobante,
// apilados dentro de la pestaña para que "Volver" respete el recorrido.
export default function PagosLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />;
}
