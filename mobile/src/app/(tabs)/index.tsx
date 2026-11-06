import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useUsuario } from '@/auth/AuthContext';
import { AvisoBanner, Boton, Cargando, Pantalla, Tarjeta, Texto, Titulo } from '@/components/ui';
import { primerNombre, SelectorHijo } from '@/components/SelectorHijo';
import { useHijos } from '@/hijos/HijosContext';
import type { Hijo } from '@/lib/tipos';
import { colors, fonts, spacing } from '@/theme';

export default function Inicio() {
  const usuario = useUsuario();
  const { hijos, seleccionado, cargando, error, recargar, recargando } = useHijos();

  return (
    <Pantalla
      refreshControl={
        <RefreshControl refreshing={recargando} onRefresh={() => void recargar()} tintColor={colors.blue500} />
      }
    >
      <View style={estilos.encabezado}>
        <Texto suave>Hola, {primerNombre(usuario.nombre)}</Texto>
        <Titulo>Tus hijos</Titulo>
      </View>

      {cargando ? (
        <Cargando texto="Cargando tus hijos…" />
      ) : error ? (
        <>
          <AvisoBanner aviso={{ tipo: 'error', texto: error.message }} />
          <Boton titulo="Reintentar" variante="secundario" icono="refresh" onPress={() => void recargar()} />
        </>
      ) : hijos.length === 0 ? (
        <Tarjeta>
          <Texto style={estilos.fuerte}>Todavía no tenés hijos vinculados</Texto>
          <Texto suave>
            Vinculalos con su DNI desde el campus web, en el Panel de Padre/Tutor. Después deslizá hacia abajo para
            actualizar.
          </Texto>
        </Tarjeta>
      ) : (
        <>
          <SelectorHijo />
          {seleccionado ? <FichaHijo hijo={seleccionado} /> : null}
        </>
      )}
    </Pantalla>
  );
}

function FichaHijo({ hijo }: { hijo: Hijo }) {
  const iniciales = hijo.nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <Tarjeta>
      <View style={estilos.ficha}>
        <View style={estilos.avatar} accessibilityElementsHidden importantForAccessibility="no">
          <Text style={estilos.iniciales}>{iniciales}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={estilos.nombre}>{hijo.nombre}</Text>
          <Texto suave>{hijo.curso ?? 'Sin curso asignado'}</Texto>
        </View>
      </View>
      <View style={estilos.dato}>
        <Texto suave>DNI</Texto>
        <Texto style={estilos.fuerte}>{hijo.dni}</Texto>
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  encabezado: { gap: 2 },
  fuerte: { fontFamily: fonts.bodySemibold },
  ficha: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.blue50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iniciales: { fontFamily: fonts.display, fontSize: 20, color: colors.blue600 },
  nombre: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.ink },
  dato: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
});
