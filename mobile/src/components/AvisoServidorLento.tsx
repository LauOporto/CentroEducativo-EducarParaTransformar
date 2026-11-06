import { useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lentitud } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme';

// El backend corre en el plan free de Render: después de un rato sin uso se
// apaga y la primera request tarda 30-50 s. Esta franja avisa que se está
// esperando al servidor, para que no parezca que la app se colgó.
export function AvisoServidorLento() {
  const hayLentas = useSyncExternalStore(lentitud.suscribir, lentitud.hayLentas, lentitud.hayLentas);
  const insets = useSafeAreaInsets();
  if (!hayLentas) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[estilos.franja, { paddingTop: insets.top + spacing.sm }]}
      pointerEvents="none"
    >
      <ActivityIndicator size="small" color={colors.white} />
      <Text style={estilos.texto}>Despertando el servidor… puede tardar hasta un minuto.</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  franja: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.blue700,
  },
  texto: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.white, flexShrink: 1 },
});
