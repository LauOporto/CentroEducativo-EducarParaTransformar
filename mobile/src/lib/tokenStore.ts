import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// El refresh token se guarda cifrado en el dispositivo (Keychain en iOS,
// Keystore en Android). El access token nunca se persiste: vive solo en
// memoria (api.ts). SecureStore no existe en web, así que la versión web
// de desarrollo usa localStorage.
const CLAVE = 'educar.refreshToken';

export async function leerRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(CLAVE) ?? null;
  return SecureStore.getItemAsync(CLAVE);
}

export async function guardarRefreshToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(CLAVE, token);
    return;
  }
  await SecureStore.setItemAsync(CLAVE, token);
}

export async function borrarRefreshToken(): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(CLAVE);
    return;
  }
  await SecureStore.deleteItemAsync(CLAVE);
}
