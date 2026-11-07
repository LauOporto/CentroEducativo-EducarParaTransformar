import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, radius, spacing } from '@/theme';
import { Chip } from './componentes';
import { periodoCorto, periodoLargo } from './formato';
import { mesesDelFiltro, mesesElegibles, PRESETS, validarMeses, type Filtro, type Mes } from './rango';

// RF-49: filtro por rango de fechas. Presets por meses y, en "Personalizado",
// Desde y Hasta elegidos de la lista de meses (últimos 24 y los 2 siguientes).

export function FiltroPeriodo({
  filtro,
  hoy,
  onCambiar,
}: {
  filtro: Filtro;
  hoy: string;
  onCambiar: (filtro: Filtro) => void;
}) {
  const [abierto, setAbierto] = useState<'desde' | 'hasta' | null>(null);
  const meses = mesesDelFiltro(filtro, hoy);
  const error = filtro.preset === 'personalizado' ? validarMeses(filtro.desde, filtro.hasta) : null;

  return (
    <View style={estilos.bloque}>
      <Text style={estilos.etiqueta}>Período</Text>
      <View style={estilos.fila} accessibilityRole="radiogroup">
        {PRESETS.map((p) => (
          <Chip
            key={p.valor}
            testID={`filtro-${p.valor}`}
            texto={p.etiqueta}
            activo={filtro.preset === p.valor}
            onPress={() => {
              setAbierto(null);
              // Al pasar a "Personalizado" se parte de los meses que se estaban viendo.
              onCambiar(p.valor === 'personalizado' ? { preset: 'personalizado', ...meses } : { preset: p.valor });
            }}
          />
        ))}
      </View>

      {filtro.preset === 'personalizado' ? (
        <View style={estilos.personalizado}>
          <View style={estilos.campos}>
            <SelectorMes
              etiqueta="Desde"
              valor={filtro.desde}
              abierto={abierto === 'desde'}
              onAbrir={() => setAbierto(abierto === 'desde' ? null : 'desde')}
            />
            <SelectorMes
              etiqueta="Hasta"
              valor={filtro.hasta}
              abierto={abierto === 'hasta'}
              onAbrir={() => setAbierto(abierto === 'hasta' ? null : 'hasta')}
            />
          </View>
          {abierto ? (
            <View style={estilos.lista} testID={`meses-${abierto}`}>
              {mesesElegibles(hoy).map((m) => (
                <Chip
                  key={m}
                  testID={`mes-${abierto}-${m}`}
                  texto={periodoCorto(m)}
                  activo={filtro[abierto] === m}
                  onPress={() => {
                    onCambiar({ ...filtro, [abierto]: m });
                    setAbierto(null);
                  }}
                />
              ))}
            </View>
          ) : null}
          {error ? (
            <Text testID="filtro-error" accessibilityRole="alert" style={estilos.error}>
              {error}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function SelectorMes({
  etiqueta,
  valor,
  abierto,
  onAbrir,
}: {
  etiqueta: string;
  valor: Mes;
  abierto: boolean;
  onAbrir: () => void;
}) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={estilos.etiquetaCampo}>{etiqueta}</Text>
      <Pressable
        testID={`filtro-${etiqueta.toLowerCase()}`}
        onPress={onAbrir}
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta}: ${periodoLargo(valor)}`}
        accessibilityState={{ expanded: abierto }}
        style={[estilos.selector, abierto && estilos.selectorAbierto]}
      >
        <Text style={estilos.selectorTexto} numberOfLines={1}>
          {periodoLargo(valor)}
        </Text>
        <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={16} color={colors.inkSoft} />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: spacing.sm },
  etiqueta: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.inkSoft },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  personalizado: { gap: spacing.md },
  campos: { flexDirection: 'row', gap: spacing.md },
  etiquetaCampo: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.ink },
  selector: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  selectorAbierto: { borderColor: colors.blue500 },
  selectorTexto: { fontFamily: fonts.body, fontSize: 14, color: colors.ink, flexShrink: 1 },
  lista: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: '#A63A1C' },
});
