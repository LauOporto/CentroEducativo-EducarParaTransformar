import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type RefreshControlProps,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, radius, spacing } from '@/theme';
import type { Aviso } from '@/auth/AuthContext';

// Piezas de interfaz compartidas por todas las pantallas, con el mismo
// lenguaje visual que el campus web.

export function Pantalla({
  children,
  refreshControl,
  bordes = ['top'],
  centrada = false,
  scrollRef,
}: {
  children: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  bordes?: Edge[];
  centrada?: boolean;
  scrollRef?: React.Ref<React.ComponentRef<typeof ScrollView>>;
}) {
  return (
    <SafeAreaView style={estilos.fondo} edges={bordes}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[estilos.contenido, centrada && estilos.centrada]}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Titulo({ children, style, ...props }: TextProps) {
  return (
    <Text accessibilityRole="header" style={[estilos.titulo, style]} {...props}>
      {children}
    </Text>
  );
}

export function Texto({ children, style, suave, ...props }: TextProps & { suave?: boolean }) {
  return (
    <Text style={[estilos.texto, suave && estilos.textoSuave, style]} {...props}>
      {children}
    </Text>
  );
}

export function Tarjeta({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[estilos.tarjeta, style]}>{children}</View>;
}

type VarianteBoton = 'primario' | 'secundario' | 'texto';

export function Boton({
  titulo,
  onPress,
  cargando = false,
  deshabilitado = false,
  variante = 'primario',
  icono,
  alInicio = false,
  etiqueta,
}: {
  titulo: string;
  onPress: () => void;
  cargando?: boolean;
  deshabilitado?: boolean;
  variante?: VarianteBoton;
  icono?: keyof typeof Ionicons.glyphMap;
  /** Alineado a la izquierda en vez de ocupar todo el ancho (ej. "Volver"). */
  alInicio?: boolean;
  /** Texto para lectores de pantalla cuando el título solo no alcanza (ej. "Dar de baja Vóley"). */
  etiqueta?: string;
}) {
  const inactivo = deshabilitado || cargando;
  const colorTexto = variante === 'primario' ? colors.white : colors.blue500;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      onPress={onPress}
      disabled={inactivo}
      style={({ pressed }) => [
        estilos.boton,
        variante === 'primario' && estilos.botonPrimario,
        variante === 'secundario' && estilos.botonSecundario,
        variante === 'texto' && estilos.botonTexto,
        alInicio && { alignSelf: 'flex-start', paddingHorizontal: 0 },
        pressed && { opacity: 0.85 },
        inactivo && { opacity: 0.6 },
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <View style={estilos.botonFila}>
          {icono ? <Ionicons name={icono} size={18} color={colorTexto} /> : null}
          <Text style={[estilos.botonTitulo, { color: colorTexto }]}>{titulo}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Campo({
  etiqueta,
  error,
  ayuda,
  secreto = false,
  ...props
}: TextInputProps & { etiqueta: string; error?: string | null; ayuda?: string; secreto?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <View style={[estilos.entradaMarco, error ? estilos.entradaError : null]}>
        <TextInput
          style={estilos.entrada}
          placeholderTextColor={colors.inkFaint}
          secureTextEntry={secreto && !visible}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={etiqueta}
          {...props}
        />
        {secreto ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            hitSlop={8}
            style={estilos.ojo}
          >
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.inkSoft} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={estilos.errorCampo}>{error}</Text>
      ) : ayuda ? (
        <Text style={estilos.ayuda}>{ayuda}</Text>
      ) : null}
    </View>
  );
}

const ESTILO_AVISO = {
  info: { fondo: colors.blue50, borde: colors.blue100, texto: colors.blue700, icono: 'information-circle' },
  exito: { fondo: colors.tealSoft, borde: '#BFE6DD', texto: '#0B6E5E', icono: 'checkmark-circle' },
  error: { fondo: colors.coralSoft, borde: '#F7C9B9', texto: '#A63A1C', icono: 'alert-circle' },
} as const;

export function AvisoBanner({ aviso }: { aviso: Aviso }) {
  const e = ESTILO_AVISO[aviso.tipo];
  return (
    <View
      accessibilityRole={aviso.tipo === 'error' ? 'alert' : undefined}
      style={[estilos.aviso, { backgroundColor: e.fondo, borderColor: e.borde }]}
    >
      <Ionicons name={e.icono} size={20} color={e.texto} />
      <Text style={[estilos.avisoTexto, { color: e.texto }]}>{aviso.texto}</Text>
    </View>
  );
}

export function Cargando({ texto }: { texto?: string }) {
  return (
    <View style={estilos.cargando}>
      <ActivityIndicator color={colors.blue500} size="large" />
      {texto ? <Texto suave>{texto}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: colors.paper },
  contenido: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl },
  centrada: { flexGrow: 1, justifyContent: 'center' },
  titulo: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, lineHeight: 32 },
  texto: { fontFamily: fonts.body, fontSize: 15, color: colors.ink, lineHeight: 22 },
  textoSuave: { color: colors.inkSoft },
  tarjeta: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.md,
  },
  boton: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonPrimario: { backgroundColor: colors.blue500 },
  botonSecundario: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.blue100 },
  botonTexto: { minHeight: 40 },
  botonFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  botonTitulo: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  campo: { gap: 6 },
  etiqueta: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.ink },
  entradaMarco: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  entradaError: { borderColor: colors.coral },
  entrada: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  ojo: { paddingHorizontal: spacing.md, minHeight: 48, justifyContent: 'center' },
  errorCampo: { fontFamily: fonts.bodyMedium, fontSize: 13, color: '#A63A1C' },
  ayuda: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  aviso: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  avisoTexto: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20 },
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
});
