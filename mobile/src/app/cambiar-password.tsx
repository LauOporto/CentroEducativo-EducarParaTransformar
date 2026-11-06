import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth, type Aviso } from '@/auth/AuthContext';
import { AvisoBanner, Boton, Campo, Pantalla, Texto, Titulo } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { RespuestaMensaje } from '@/lib/tipos';
import { spacing } from '@/theme';

// RF-48 (cambio de contraseña con la sesión iniciada). El backend cierra
// todas las sesiones del usuario, así que después hay que volver a entrar.
export default function CambiarPassword() {
  const { terminarSesion } = useAuth();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [errores, setErrores] = useState<Record<string, string | undefined>>({});
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    const nuevos = {
      actual: actual ? undefined : 'Ingresá tu contraseña actual.',
      nueva: nueva.length >= 6 ? undefined : 'Usá al menos 6 caracteres.',
      repetida: repetida === nueva ? undefined : 'Las contraseñas no coinciden.',
    };
    setErrores(nuevos);
    if (nuevos.actual || nuevos.nueva || nuevos.repetida) return;

    setEnviando(true);
    setAviso(null);
    try {
      const r = await api<RespuestaMensaje>('/auth/password/cambiar', {
        method: 'POST',
        body: { passwordActual: actual, passwordNueva: nueva },
      });
      await terminarSesion({ tipo: 'exito', texto: r.mensaje });
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'Algo salió mal. Probá de nuevo.' });
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pantalla bordes={['top', 'bottom']}>
        <Boton titulo="Volver" variante="texto" icono="arrow-back" alInicio onPress={() => router.back()} />
        <View style={estilos.encabezado}>
          <Titulo>Cambiar contraseña</Titulo>
          <Texto suave>
            Por seguridad, después de cambiarla vas a tener que iniciar sesión de nuevo en todos tus dispositivos.
          </Texto>
        </View>

        {aviso ? <AvisoBanner aviso={aviso} /> : null}

        <Campo
          etiqueta="Contraseña actual"
          value={actual}
          onChangeText={setActual}
          error={errores.actual}
          secreto
          textContentType="password"
          autoComplete="current-password"
        />
        <Campo
          etiqueta="Contraseña nueva"
          value={nueva}
          onChangeText={setNueva}
          error={errores.nueva}
          ayuda="Al menos 6 caracteres y distinta de la actual."
          secreto
          textContentType="newPassword"
          autoComplete="new-password"
        />
        <Campo
          etiqueta="Repetí la contraseña nueva"
          value={repetida}
          onChangeText={setRepetida}
          error={errores.repetida}
          secreto
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={guardar}
        />
        <Boton titulo="Guardar contraseña" onPress={guardar} cargando={enviando} />
      </Pantalla>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  encabezado: { gap: spacing.sm },
});
