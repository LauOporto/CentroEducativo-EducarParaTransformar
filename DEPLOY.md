# Despliegue en Render + Neon (gratis, sin tarjeta)

Esta app es un solo servicio: el backend (Express) sirve el build del
frontend (React/Vite) desde el mismo proceso y puerto. Eso significa
**un Web Service en Render + una base de Postgres en Neon**, nada más.

(Se usa Neon en vez del Postgres propio de Render porque el de Render
expira a los 90 días en el plan free; el de Neon no expira.)

## 1. Base de datos — Neon

1. [neon.tech](https://neon.tech) → crear cuenta (sin tarjeta) → **New Project**.
2. Una vez creado, Neon te muestra un **Connection string**. Agarrá la variante **sin pooling** (a veces aparece como "Direct connection" — el string NO debe decir `-pooler` en el host). Con el volumen de tráfico de este proyecto no hace falta el pooler de Neon, y evita problemas conocidos de Prisma con PgBouncer.
3. Guardá ese string completo — es tu `DATABASE_URL`. Tiene esta forma:
   ```
   postgresql://usuario:password@ep-algo.region.aws.neon.tech/neondb?sslmode=require
   ```

## 2. Storage de archivos — Cloudinary

Los archivos que suben los usuarios (imágenes de la galería, CVs de postulaciones, planes de estudio) se guardan en Cloudinary en vez del disco del servidor, porque el plan free de Render no tiene disco persistente — cualquier archivo guardado localmente se pierde en el próximo deploy o reinicio del servicio.

1. [cloudinary.com](https://cloudinary.com) → crear cuenta (sin tarjeta).
2. En el dashboard, sección **Product Environment Credentials** / **API Keys**, vas a ver tres valores: **Cloud name**, **API Key** y **API Secret**. Guardalos — son `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`.
3. El plan free incluye 25GB de storage, de sobra para este proyecto.

## 3. Web Service — Render

`render.yaml` solo se aplica automáticamente si creás el servicio con **New → Blueprint** (apunta al repo, Render lee el archivo y precarga todo: build command, start command y variables). Si en cambio usás **New → Web Service** y elegís el repo a mano, Render **ignora `render.yaml`** — hay que cargar cada cosa vos mismo en el dashboard (es lo que pasó en el primer intento de este proyecto). Las dos sirven, elegí una:

- **Blueprint** (menos pasos, recomendado): `New` → `Blueprint` → este repo → Render arma el servicio con el build command, el start command y los secretos JWT ya generados. Solo te va a faltar completar `DATABASE_URL`, `CORS_ORIGIN` y las 3 de Cloudinary a mano (ver paso 4).
- **Web Service manual**: `New` → `Web Service` → este repo → plan **Free** → cargá vos el Build Command y el Start Command (ver paso 4) y **todas** las variables de entorno.

En cualquiera de los dos casos, si te pregunta el **Root Directory**, dejalo vacío (raíz del repo) — el build compila `client/` y `backend/` juntos, y en runtime el backend busca `client/dist` como carpeta hermana.

## 4. Build/Start command y variables de entorno

Si usaste **Web Service manual**, en Settings cargá:

- **Build Command**: `npm install -g pnpm@11.1.1 && pnpm install --frozen-lockfile && pnpm run build`
- **Start Command**: `pnpm --filter backend run deploy:start`

Y en **Environment**, estas variables (con Blueprint ya vienen cargadas salvo las dos marcadas):

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `24h` |
| `MAX_UPLOAD_SIZE_MB` | `20` |
| `JWT_ACCESS_SECRET` | Generalo con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` — 32+ caracteres, obligatorio. |
| `JWT_REFRESH_SECRET` | Mismo comando, otra corrida (tiene que ser distinto al anterior). |
| `DATABASE_URL` ⚠️ siempre manual | El connection string de Neon (paso 1). |
| `CORS_ORIGIN` ⚠️ siempre manual | El dominio que Render te asigna — lo ves arriba del dashboard del servicio una vez creado (`https://algo.onrender.com`, sin `/` al final). |
| `CLOUDINARY_CLOUD_NAME` ⚠️ siempre manual | De tu cuenta de Cloudinary (paso 2). |
| `CLOUDINARY_API_KEY` ⚠️ siempre manual | Ídem. |
| `CLOUDINARY_API_SECRET` ⚠️ siempre manual | Ídem. |

## 5. Deploy

Guardá → Render buildea y levanta solo. La secuencia:

```
npm install -g pnpm@11.1.1 && pnpm install --frozen-lockfile && pnpm run build
pnpm --filter backend run deploy:start   # prisma migrate deploy && node dist/index.js
```

`prisma migrate deploy` aplica las migraciones contra la base de Neon — no corre el seed (tiene ~40 usuarios de prueba con contraseña `123456`, no es para producción).

Con la URL ya generada, volvé a **Environment** y completá `CORS_ORIGIN` con esa URL exacta — eso dispara un redeploy automático.

## 6. Crear el primer admin real

Desde el **Shell** del servicio en Render (pestaña "Shell" del dashboard), corré una sola vez:

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
(async () => {
  const hash = await bcrypt.hash('PONÉ-UNA-CONTRASEÑA-FUERTE-ACÁ', 10);
  const admin = await prisma.user.create({
    data: { usuario: 'admin', email: 'admin@tu-dominio.edu', dni: '00000000', nombre: 'Administrador', role: 'ADMIN', password: hash },
  });
  console.log('Admin creado:', admin.usuario);
  await prisma.\$disconnect();
})();
"
```

Cambiá la contraseña y el email antes de correrlo.

## Limitaciones conocidas del plan free

- **El servicio "duerme"**: sin tráfico durante 15 minutos, Render apaga la instancia. El próximo request la despierta, pero tarda entre 30 y 50 segundos en responder. No es un error — si vas a hacer una demo en vivo, abrí la URL un par de minutos antes para que esté despierta. (Los archivos subidos no se pierden con esto: viven en Cloudinary, no en el disco del servicio.)

## Problemas conocidos / troubleshooting

- **`Variables de entorno inválidas` / `JWT_ACCESS_SECRET debe tener al menos 32 caracteres`** (o `CLOUDINARY_...` / `DATABASE_URL`)**:** falta cargar esa variable en Environment — pasa si el servicio se creó como Web Service manual y no con Blueprint, ver paso 4.
- **El build falla con `Error: Cannot find matching keyid` en `corepack`**: bug conocido de `corepack enable` (intenta resolver la última versión de pnpm contra el registro de npm y falla verificando la firma). Por eso `render.yaml` ya instala pnpm directo con `npm install -g pnpm@11.1.1` en vez de usar corepack — si lo ves igual, confirmá que el build command no haya vuelto a tener `corepack enable`.
- **El build falla compilando `bcrypt`**: es un módulo nativo. Si el build falla justo ahí, la solución es migrar `bcrypt` → `bcryptjs` (API idéntica, sin compilación nativa) en `backend/package.json` y en los 2 imports (`auth.routes.ts`, `admin.routes.ts`).
- **Error de conexión a la base**: confirmá que el connection string de Neon tenga `?sslmode=require` al final y que no le falte ningún caracter al copiarlo.
- **Error de CORS en el navegador**: no debería pasar en este esquema (mismo origen), pero si lo ves, confirmá que `CORS_ORIGIN` tenga el dominio público exacto que te dio Render, sin `/` al final.
