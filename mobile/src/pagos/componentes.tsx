import type { ReactNode } from 'react';
import { Platform, Alert, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, radius, spacing } from '@/theme';
import { ETIQUETA_ESTADO_COMPROBANTE, ETIQUETA_ESTADO_FACTURA, ETIQUETA_ESTADO_ITEM } from './formato';
import type { EstadoComprobante, EstadoFactura, EstadoItem } from './tipos';

// Piezas de las pantallas de pagos. Usan la paleta de theme.ts; el resto de
// la interfaz (tarjetas, botones, campos, avisos) sale de components/ui.tsx.

// ---- Etiqueta de estado (badge "rounded-full px-2.5 py-1 text-xs" del web) ----

type Tono = 'neutro' | 'coral' | 'azul' | 'teal' | 'ambar' | 'gris';

const TONOS: Record<Tono, { fondo: string; texto: string }> = {
  neutro: { fondo: '#EEF1F5', texto: colors.inkSoft },
  coral: { fondo: colors.coralSoft, texto: '#A63A1C' },
  azul: { fondo: colors.blue50, texto: colors.blue700 },
  teal: { fondo: colors.tealSoft, texto: '#0B6E5E' },
  // Ámbar suave: entre el coral y el teal de la marca, para "pago parcial".
  ambar: { fondo: '#FDF3DD', texto: '#8A5A0A' },
  gris: { fondo: '#F1F3F6', texto: colors.inkFaint },
};

export type TipoEtiqueta =
  | { tipo: 'item'; estado: EstadoItem }
  | { tipo: 'factura'; estado: EstadoFactura }
  | { tipo: 'comprobante'; estado: EstadoComprobante };

function tonoDe(e: TipoEtiqueta): Tono {
  switch (e.estado) {
    case 'VENCIDA':
    case 'RECHAZADO':
      return 'coral';
    case 'EN_REVISION':
      return 'azul';
    case 'PAGADA':
    case 'APROBADO':
      return 'teal';
    case 'PARCIAL':
      return 'ambar';
    case 'ANULADO':
      return 'gris';
    default:
      return 'neutro';
  }
}

function textoDe(e: TipoEtiqueta): string {
  if (e.tipo === 'item') return ETIQUETA_ESTADO_ITEM[e.estado];
  if (e.tipo === 'factura') return ETIQUETA_ESTADO_FACTURA[e.estado];
  return ETIQUETA_ESTADO_COMPROBANTE[e.estado];
}

export function Etiqueta({ testID, ...e }: TipoEtiqueta & { testID?: string }) {
  const tono = TONOS[tonoDe(e)];
  return (
    <Text testID={testID} style={[estilos.etiqueta, { backgroundColor: tono.fondo, color: tono.texto }]}>
      {textoDe(e)}
    </Text>
  );
}

// ---- Títulos y filas ----

export function Seccion({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={estilos.seccion}>
      {children}
    </Text>
  );
}

/** Fila "Etiqueta ........ valor" con separador. */
export function FilaDato({
  etiqueta,
  valor,
  fuerte = false,
  color,
  ultimo = false,
  testID,
}: {
  etiqueta: string;
  valor: string;
  fuerte?: boolean;
  color?: string;
  ultimo?: boolean;
  testID?: string;
}) {
  return (
    <View style={[estilos.filaDato, !ultimo && estilos.separador]}>
      <Text style={estilos.datoEtiqueta}>{etiqueta}</Text>
      <Text
        testID={testID}
        style={[estilos.datoValor, fuerte && estilos.datoFuerte, color ? { color } : null]}
        selectable
      >
        {valor}
      </Text>
    </View>
  );
}

/** Casilla de verificación accesible (ítems a pagar). */
export function Casilla({
  marcada,
  deshabilitada = false,
  onPress,
  etiqueta,
  children,
  testID,
  estilo,
}: {
  marcada: boolean;
  deshabilitada?: boolean;
  onPress: () => void;
  etiqueta: string;
  children: ReactNode;
  testID?: string;
  estilo?: ViewStyle;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={etiqueta}
      accessibilityState={{ checked: marcada, disabled: deshabilitada }}
      aria-checked={marcada}
      aria-disabled={deshabilitada}
      disabled={deshabilitada}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.casilla,
        marcada && estilos.casillaMarcada,
        pressed && { opacity: 0.85 },
        estilo,
      ]}
    >
      <View style={[estilos.cuadro, marcada && estilos.cuadroMarcado, deshabilitada && estilos.cuadroDeshabilitado]}>
        {marcada ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
      </View>
      <View style={{ flex: 1, gap: 4 }}>{children}</View>
    </Pressable>
  );
}

/** Chip seleccionable (presets del filtro, meses). */
export function Chip({
  texto,
  activo,
  onPress,
  testID,
}: {
  texto: string;
  activo: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: activo }}
      aria-checked={activo}
      style={[estilos.chip, activo && estilos.chipActivo]}
    >
      <Text style={[estilos.chipTexto, activo && estilos.chipTextoActivo]}>{texto}</Text>
    </Pressable>
  );
}

/** Confirmación nativa (en la versión web, el confirm del navegador). */
export function confirmar(titulo: string, mensaje: string, boton: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm(`${titulo}\n\n${mensaje}`));
  return new Promise((resolver) =>
    Alert.alert(
      titulo,
      mensaje,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolver(false) },
        { text: boton, style: 'destructive', onPress: () => resolver(true) },
      ],
      { cancelable: true, onDismiss: () => resolver(false) },
    ),
  );
}

export const estilosPagos = StyleSheet.create({
  encabezado: { gap: 2 },
  subtitulo: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.inkSoft },
  monto: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  montoGrande: { fontFamily: fonts.display, fontSize: 30, color: colors.ink, lineHeight: 36 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  separador: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md },
  nombre: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.ink },
  detalle: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, lineHeight: 20 },
});

const estilos = StyleSheet.create({
  etiqueta: {
    alignSelf: 'flex-start',
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  seccion: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.ink },
  filaDato: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  separador: { borderBottomWidth: 1, borderBottomColor: colors.line },
  datoEtiqueta: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft },
  datoValor: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.ink, flexShrink: 1, textAlign: 'right' },
  datoFuerte: { fontFamily: fonts.bodyBold, fontSize: 16 },
  casilla: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  casillaMarcada: { borderColor: colors.blue500, backgroundColor: colors.blue50 },
  cuadro: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.inkFaint,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  cuadroMarcado: { backgroundColor: colors.blue500, borderColor: colors.blue500 },
  cuadroDeshabilitado: { borderColor: colors.line, backgroundColor: '#F1F3F6' },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  chipActivo: { backgroundColor: colors.blue500, borderColor: colors.blue500 },
  chipTexto: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.ink },
  chipTextoActivo: { color: colors.white },
});
