import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { AvisoBanner, Boton, Campo, Pantalla, Texto, Titulo } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { colors, fonts, spacing } from '@/theme';

// RF-48: login del Padre/Tutor con el mismo usuario y contraseña del campus
// web. El backend rechaza (403) cualquier otro rol cuando la request viene
// de la app.
export default function Login() {
  const { ingresar, aviso, mostrarAviso } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<{ usuario?: string; password?: string }>({});

  async function enviar() {
    const nuevos = {
      usuario: usuario.trim() ? undefined : 'Ingresá tu usuario o email.',
      password: password ? undefined : 'Ingresá tu contraseña.',
    };
    setErrores(nuevos);
    if (nuevos.usuario || nuevos.password) return;

    setEnviando(true);
    mostrarAviso(null);
    try {
      await ingresar(usuario, password);
    } catch (err) {
      mostrarAviso({
        tipo: 'error',
        texto: err instanceof ApiError ? err.message : 'No pudimos iniciar sesión. Probá de nuevo.',
      });
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pantalla centrada bordes={['top', 'bottom']}>
        <View style={estilos.marca}>
          <Image
            source={require('../../assets/splash-icon.png')}
            style={estilos.logo}
            accessibilityIgnoresInvertColors
            accessible
            accessibilityLabel="Logo de Educar para Transformar"
          />
          <Titulo style={estilos.nombre}>Educar para Transformar</Titulo>
          <Texto suave style={estilos.bajada}>
            App para familias: seguí las cuotas, los pagos y las inscripciones de tus hijos.
          </Texto>
        </View>

        {aviso ? <AvisoBanner aviso={aviso} /> : null}

        <Campo
          etiqueta="Usuario o email"
          value={usuario}
          onChangeText={setUsuario}
          error={errores.usuario}
          textContentType="username"
          autoComplete="username"
          returnKeyType="next"
          placeholder="Ej.: rperez"
        />
        <Campo
          etiqueta="Contraseña"
          value={password}
          onChangeText={setPassword}
          error={errores.password}
          secreto
          textContentType="password"
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={enviar}
        />

        <Boton titulo="Ingresar" onPress={enviar} cargando={enviando} />

        <Link href="/recuperar" style={estilos.enlace}>
          ¿Olvidaste tu contraseña?
        </Link>

        <Texto suave style={estilos.pie}>
          Usá el mismo usuario y contraseña que en el campus web. La app es para Padres y Tutores.
        </Texto>
      </Pantalla>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  marca: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  logo: { width: 96, height: 96 },
  nombre: { textAlign: 'center' },
  bajada: { textAlign: 'center', maxWidth: 320 },
  enlace: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
    color: colors.blue500,
  },
  pie: { textAlign: 'center', fontSize: 13 },
});
