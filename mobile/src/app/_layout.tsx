import { useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { HankenGrotesk_400Regular } from '@expo-google-fonts/hanken-grotesk/400Regular';
import { HankenGrotesk_500Medium } from '@expo-google-fonts/hanken-grotesk/500Medium';
import { HankenGrotesk_600SemiBold } from '@expo-google-fonts/hanken-grotesk/600SemiBold';
import { HankenGrotesk_700Bold } from '@expo-google-fonts/hanken-grotesk/700Bold';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { AvisoServidorLento } from '@/components/AvisoServidorLento';
import { Boton, Pantalla, Texto, Titulo } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

// RNF-57: al volver a la app se refrescan los datos, así un cambio hecho en
// el web (por ejemplo, un comprobante aprobado) se ve sin reiniciarla.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((alCambiarFoco) => {
    const sub = AppState.addEventListener('change', (estado) => alCambiarFoco(estado === 'active'));
    return () => sub.remove();
  });
}

function crearQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Un 401/403/404 no se arregla reintentando; un corte de red, sí.
        retry: (fallos, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && fallos < 2,
      },
    },
  });
}

export default function RootLayout() {
  const [queryClient] = useState(crearQueryClient);
  const [fuentesListas, errorFuentes] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
  });

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          {fuentesListas || errorFuentes ? <Navegacion /> : null}
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function Navegacion() {
  const { estado, reintentar } = useAuth();
  const listo = estado.estado !== 'cargando';

  useEffect(() => {
    if (listo) void SplashScreen.hideAsync();
  }, [listo]);

  if (!listo) return null;

  if (estado.estado === 'sinConexion') {
    return (
      <Pantalla centrada bordes={['top', 'bottom']}>
        <Titulo>No pudimos conectarnos</Titulo>
        <Texto suave>{estado.mensaje}</Texto>
        <Boton titulo="Reintentar" icono="refresh" onPress={reintentar} />
      </Pantalla>
    );
  }

  const conSesion = estado.estado === 'conSesion';
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Protected guard={!conSesion}>
          <Stack.Screen name="login" />
          <Stack.Screen name="recuperar" />
        </Stack.Protected>
        <Stack.Protected guard={conSesion}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="cambiar-password" />
        </Stack.Protected>
      </Stack>
      <AvisoServidorLento />
    </View>
  );
}
