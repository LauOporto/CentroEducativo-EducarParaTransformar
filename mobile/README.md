# App móvil — Padres y Tutores

Aplicación de la Parte 3 (RF-48 a RF-50 y RF-54) hecha con **Expo SDK 58**, React Native, TypeScript estricto y expo-router. Consume la **misma API REST** que el campus web (RNF-56): no tiene base ni sesión propias.

Vive en `mobile/` **fuera del workspace de pnpm**: usa npm y su propio `package-lock.json`, así no toca el build de Render ni el del cliente web.

## Cómo correrla

```bash
cd mobile
npm install
npx expo start
```

- **En el celular:** instalar **Expo Go** (Play Store o App Store) y escanear el QR que muestra la terminal. El celular y la PC tienen que estar en la misma red Wi-Fi.
- **En el navegador:** `npx expo start --web` (abre `http://localhost:8081`).

Por defecto la app usa la API de producción (`https://educar-para-transformar-iffe.onrender.com`). El primer pedido puede tardar hasta un minuto porque Render despierta el servicio; la app lo avisa con una franja arriba de la pantalla.

### Contra el backend local

Crear `mobile/.env.local` (está en el `.gitignore`):

```bash
# Desde el navegador de la PC:
EXPO_PUBLIC_API_URL=http://localhost:4000
# Desde un celular: la IP de la PC en la red, no localhost.
# EXPO_PUBLIC_API_URL=http://192.168.0.10:4000
```

Para la versión web, el backend tiene que aceptar el origen de Expo: en `backend/.env`, `CORS_ORIGIN=http://localhost:5173,http://localhost:8081`. La app nativa no manda `Origin`, así que no lo necesita.

### Usuarios de prueba (seed)

Contraseña `123456`. La app solo deja entrar a Padres/Tutores:

| Usuario | Hijos |
|---|---|
| `mgomezp` | María Gómez e Ignacio Flores (sirve para probar el selector de hijo) |
| `rperez` | Juan Pérez |
| `pbarrabino` | Franco Barrabino |

## Pagos

Pestaña **Pagos** (RF-49 y RF-50): estado de cuenta por hijo, deuda por ítem, facturas, historial de pagos, comprobantes de pago y carga de la transferencia. Solo se paga por transferencia bancaria.

Cómo probar el flujo contra el backend local (con `mobile/.env.local` apuntando a `http://localhost:4000`):

1. Entrar con `pbarrabino` / `123456` y abrir **Pagos**. Probar el filtro de período (presets y "Personalizado") y desplegar una fila de **Deuda por ítem**.
2. Tocar una factura con saldo → elegir ítems (o "Elegir todo lo pendiente") → **Generar comprobante de pago**.
3. En el comprobante: copiar CBU o alias, descargar el PDF y completar **Cargar transferencia** con una foto, una imagen de la galería o un PDF (hasta 5 MB). El monto tiene que ser exactamente el total. Queda **En revisión**.
4. Aprobar o rechazar como administrador. Mientras no esté el panel web (F7), por API:

   ```bash
   TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login -H 'Content-Type: application/json' \
     -d '{"usuario":"admin","password":"123456"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).usuario.token')
   curl -X POST http://localhost:4000/api/admin/pagos/comprobantes/<id>/aprobar -H "Authorization: Bearer $TOKEN"
   curl -X POST http://localhost:4000/api/admin/pagos/comprobantes/<id>/rechazar -H "Authorization: Bearer $TOKEN" \
     -H 'Content-Type: application/json' -d '{"motivo":"La transferencia no figura en el banco"}'
   ```

   Con la pantalla del comprobante abierta, el cambio aparece solo en hasta 20 segundos (RNF-57).
5. Un comprobante **Generado** se puede anular: sus ítems vuelven a estar pendientes.

Para tener ítems pendientes nuevos, el administrador puede emitir el período siguiente: `POST /api/admin/facturacion/generar { "periodo": "AAAA-MM" }`.

Tests de la app: `npm test` (formatos, rango de fechas, selección de ítems, cliente HTTP y pantallas de pagos).

## Estructura

```
src/
  app/              rutas de expo-router
    _layout.tsx     providers, fuentes y rutas protegidas según haya sesión
    login.tsx, recuperar.tsx, cambiar-password.tsx
    (tabs)/         Inicio (hijos) y Mi cuenta
  auth/             sesión (AuthContext)
  hijos/            hijo seleccionado (HijosContext)
  lib/api.ts        cliente HTTP: header X-Client-Type, access en memoria, refresh y reintento ante 401
  lib/tokenStore.ts refresh token en expo-secure-store (localStorage solo en la versión web)
  components/       piezas de interfaz compartidas
  theme.ts          paleta y tipografías del campus web
```

## Verificación

```bash
npm run typecheck
npx expo export --platform web --output-dir dist   # lo mismo que corre el job "mobile" del CI
```
