import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useAuth } from '@/auth/AuthContext';
import { AvisoBanner, Boton, Cargando, Pantalla, Tarjeta, Texto, Titulo } from '@/components/ui';
import { api } from '@/lib/api';
import type { RespuestaPerfil } from '@/lib/tipos';
import { colors, fonts, spacing } from '@/theme';

export default function Cuenta() {
  const { salir } = useAuth();
  const [saliendo, setSaliendo] = useState(false);
  const perfil = useQuery({
    queryKey: ['perfil'],
    queryFn: () => api<RespuestaPerfil>('/auth/me').then((r) => r.usuario),
  });

  return (
    <Pantalla>
      <Titulo>Mi cuenta</Titulo>

      {perfil.isPending ? (
        <Cargando />
      ) : perfil.error ? (
        <AvisoBanner aviso={{ tipo: 'error', texto: perfil.error.message }} />
      ) : (
        <Tarjeta>
          <Dato etiqueta="Nombre" valor={perfil.data.nombre} />
          <Dato etiqueta="Usuario" valor={perfil.data.usuario} />
          <Dato etiqueta="Email" valor={perfil.data.email} />
          <Dato etiqueta="DNI" valor={perfil.data.dni} ultimo />
        </Tarjeta>
      )}

      <Boton
        titulo="Cambiar contraseña"
        variante="secundario"
        icono="key-outline"
        onPress={() => router.push('/cambiar-password')}
      />
      <Boton
        titulo="Cerrar sesión"
        variante="secundario"
        icono="log-out-outline"
        cargando={saliendo}
        onPress={async () => {
          setSaliendo(true);
          await salir();
        }}
      />

      <Texto suave style={estilos.version}>
        Educar para Transformar · versión {Constants.expoConfig?.version ?? '—'}
      </Texto>
    </Pantalla>
  );
}

function Dato({ etiqueta, valor, ultimo = false }: { etiqueta: string; valor: string; ultimo?: boolean }) {
  return (
    <View style={[estilos.dato, !ultimo && estilos.separador]}>
      <Texto suave>{etiqueta}</Texto>
      <Texto style={estilos.valor} numberOfLines={1}>
        {valor}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  dato: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingBottom: spacing.md },
  separador: { borderBottomWidth: 1, borderBottomColor: colors.line },
  valor: { fontFamily: fonts.bodySemibold, flexShrink: 1, textAlign: 'right' },
  version: { textAlign: 'center', fontSize: 13, marginTop: spacing.lg },
});
