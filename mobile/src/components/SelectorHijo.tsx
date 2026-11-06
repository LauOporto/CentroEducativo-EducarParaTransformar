import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useHijos } from '@/hijos/HijosContext';
import { colors, fonts, spacing } from '@/theme';

// Con más de un hijo vinculado, una fila de opciones para elegir sobre cuál
// trabajar. Con uno solo no se muestra: no hay nada que elegir.
export function SelectorHijo() {
  const { hijos, seleccionado, seleccionar } = useHijos();
  if (hijos.length < 2) return null;

  return (
    <View style={estilos.bloque}>
      <Text style={estilos.etiqueta}>Elegí un hijo</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.fila}>
        {hijos.map((hijo) => {
          const activo = hijo.id === seleccionado?.id;
          return (
            <Pressable
              key={hijo.id}
              onPress={() => seleccionar(hijo.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: activo }}
              style={[estilos.opcion, activo && estilos.opcionActiva]}
            >
              <Text style={[estilos.opcionTexto, activo && estilos.opcionTextoActivo]}>
                {primerNombre(hijo.nombre)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

const estilos = StyleSheet.create({
  bloque: { gap: spacing.sm },
  etiqueta: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.inkSoft },
  fila: { gap: spacing.sm },
  opcion: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  opcionActiva: { backgroundColor: colors.blue500, borderColor: colors.blue500 },
  opcionTexto: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.ink },
  opcionTextoActivo: { color: colors.white },
});
