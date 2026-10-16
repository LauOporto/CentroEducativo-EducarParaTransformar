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

## 2. Web Service — Render

1. [render.com](https://render.com) → crear cuenta con GitHub (sin tarjeta) → **New** → **Web Service** → elegí este repositorio.
2. Render va a detectar `render.yaml` (ya está en el repo) y precargar build/start command solos. Si te pregunta el **Root Directory**, dejalo vacío (raíz del repo) — el build compila `client/` y `backend/` juntos, y en runtime el backend busca `client/dist` como carpeta hermana.
3. Plan: **Free**.

## 3. Variables de entorno

`render.yaml` ya define casi todo. Las que quedan en blanco (`sync: false`) las completás vos en **Environment** una vez creado el servicio:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | El connection string de Neon (paso 1). |
| `CORS_ORIGIN` | El dominio que Render te asigna — lo ves recién después del primer deploy (`https://educar-para-transformar.onrender.com` o similar, sin `/` al final). |

El resto (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `NODE_ENV`, etc.) ya vienen generadas/seteadas por el blueprint.

## 4. Deploy

Guardá las variables → Render buildea y levanta solo. La secuencia:

```
corepack enable && pnpm install --frozen-lockfile && pnpm run build
pnpm --filter backend run deploy:start   # prisma migrate deploy && node dist/index.js
```

`prisma migrate deploy` aplica las migraciones contra la base de Neon — no corre el seed (tiene ~40 usuarios de prueba con contraseña `123456`, no es para producción).

Con la URL ya generada, volvé a **Environment** y completá `CORS_ORIGIN` con esa URL exacta — eso dispara un redeploy automático.

## 5. Crear el primer admin real

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

- **Los archivos subidos no persisten**: el plan free de Render no tiene disco persistente (a diferencia de Railway, acá ni pagando el plan más chico lo da). Cada CV de una postulación y cada imagen de la galería se pierde en el próximo deploy o reinicio del servicio. Para una demo académica es aceptable; si en algún momento hace falta que persistan de verdad, la solución es subirlos a un storage externo (ej. Cloudinary, tiene plan free) en vez de al disco local — eso sí implica cambiar código (`backend/src/middleware/upload.ts`), no es solo configuración.
- **El servicio "duerme"**: sin tráfico durante 15 minutos, Render apaga la instancia. El próximo request la despierta, pero tarda entre 30 y 50 segundos en responder. No es un error — si vas a hacer una demo en vivo, abrí la URL un par de minutos antes para que esté despierta.

## Problemas conocidos / troubleshooting

- **El build falla compilando `bcrypt`**: es un módulo nativo. Si el build falla justo ahí, la solución es migrar `bcrypt` → `bcryptjs` (API idéntica, sin compilación nativa) en `backend/package.json` y en los 2 imports (`auth.routes.ts`, `admin.routes.ts`).
- **Error de conexión a la base**: confirmá que el connection string de Neon tenga `?sslmode=require` al final y que no le falte ningún caracter al copiarlo.
- **Error de CORS en el navegador**: no debería pasar en este esquema (mismo origen), pero si lo ves, confirmá que `CORS_ORIGIN` tenga el dominio público exacto que te dio Render, sin `/` al final.
