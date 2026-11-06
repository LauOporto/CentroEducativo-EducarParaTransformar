import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth, type Aviso } from '@/auth/AuthContext';
import { AvisoBanner, Boton, Campo, Pantalla, Texto, Titulo } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { RespuestaMensaje } from '@/lib/tipos';
import { spacing } from '@/theme';

// RF-48 (recuperación): 1) se pide un código de 6 dígitos que llega por
// email; 2) con ese código se elige una contraseña nueva. El backend cierra
// todas las sesiones abiertas (web y app) al restablecerla.
export default function Recuperar() {
  const { mostrarAviso } = useAuth();
  const [paso, setPaso] = useState<'pedir' | 'restablecer'>('pedir');
  const [identificador, setIdentificador] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [errores, setErrores] = useState<Record<string, string | undefined>>({});
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function pedirCodigo() {
    if (!identificador.trim()) {
      setErrores({ identificador: 'Ingresá tu usuario o email.' });
      return;
    }
    setErrores({});
    setEnviando(true);
    try {
      const r = await api<RespuestaMensaje>('/auth/password/olvide', {
        method: 'POST',
        body: { identificador: identificador.trim() },
        auth: false,
      });
      setAviso({ tipo: 'info', texto: r.mensaje });
      setPaso('restablecer');
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeDe(err) });
    } finally {
      setEnviando(false);
    }
  }

  async function restablecer() {
    const nuevos = {
      codigo: /^\d{6}$/.test(codigo) ? undefined : 'El código tiene 6 números.',
      nueva: nueva.length >= 6 ? undefined : 'Usá al menos 6 caracteres.',
      repetida: repetida === nueva ? undefined : 'Las contraseñas no coinciden.',
    };
    setErrores(nuevos);
    if (nuevos.codigo || nuevos.nueva || nuevos.repetida) return;

    setEnviando(true);
    try {
      const r = await api<RespuestaMensaje>('/auth/password/restablecer', {
        method: 'POST',
        body: { identificador: identificador.trim(), codigo, nuevaPassword: nueva },
        auth: false,
      });
      mostrarAviso({ tipo: 'exito', texto: r.mensaje });
      router.back();
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeDe(err) });
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pantalla bordes={['top', 'bottom']}>
        <Boton titulo="Volver" variante="texto" icono="arrow-back" alInicio onPress={() => router.back()} />
        <View style={estilos.encabezado}>
          <Titulo>Recuperar contraseña</Titulo>
          <Texto suave>
            {paso === 'pedir'
              ? 'Te vamos a mandar un código de 6 números al email de tu cuenta.'
              : 'Ingresá el código que te llegó por email y elegí una contraseña nueva. El código vence a los 15 minutos.'}
          </Texto>
        </View>

        {aviso ? <AvisoBanner aviso={aviso} /> : null}

        {paso === 'pedir' ? (
          <>
            <Campo
              etiqueta="Usuario o email"
              value={identificador}
              onChangeText={setIdentificador}
              error={errores.identificador}
              autoComplete="username"
              returnKeyType="send"
              onSubmitEditing={pedirCodigo}
            />
            <Boton titulo="Enviar código" onPress={pedirCodigo} cargando={enviando} />
          </>
        ) : (
          <>
            <Campo
              etiqueta="Código"
              value={codigo}
              onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
              error={errores.codigo}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
            />
            <Campo
              etiqueta="Contraseña nueva"
              value={nueva}
              onChangeText={setNueva}
              error={errores.nueva}
              ayuda="Al menos 6 caracteres."
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
              onSubmitEditing={restablecer}
            />
            <Boton titulo="Cambiar contraseña" onPress={restablecer} cargando={enviando} />
            <Boton
              titulo="No me llegó el código"
              variante="texto"
              onPress={() => {
                setPaso('pedir');
                setCodigo('');
                setAviso(null);
              }}
            />
          </>
        )}
      </Pantalla>
    </KeyboardAvoidingView>
  );
}

function mensajeDe(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Algo salió mal. Probá de nuevo.';
}

const estilos = StyleSheet.create({
  encabezado: { gap: spacing.sm },
});
