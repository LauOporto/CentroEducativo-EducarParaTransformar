// URL del backend. Por defecto, producción (Render). Para desarrollar contra
// el backend local se define EXPO_PUBLIC_API_URL en mobile/.env.local, por
// ejemplo http://192.168.0.10:4000 (la IP de la PC en la red, no localhost,
// cuando se prueba desde un celular).
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://educar-para-transformar-iffe.onrender.com').replace(
  /\/+$/,
  '',
);

// Render (plan free) apaga el servicio sin tráfico y tarda 30-50 s en
// despertar: el timeout tiene que cubrir ese primer arranque.
export const REQUEST_TIMEOUT_MS = 70_000;

// A partir de este tiempo de espera se avisa que el servidor está despertando.
export const SLOW_REQUEST_MS = 4_000;
