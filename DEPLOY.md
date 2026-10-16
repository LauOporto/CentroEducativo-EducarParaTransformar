# Despliegue en Railway

Esta app es un solo servicio: el backend (Express) sirve el build del
frontend (React/Vite) desde el mismo proceso y puerto. En Railway eso
significa **un servicio Node + un plugin de PostgreSQL**, nada más.

## 1. Crear el proyecto

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → elegí este repositorio.
2. En el servicio que se crea, confirmá que el **Root Directory** sea la raíz del repo (no `backend/`) — el build necesita compilar `client/` y `backend/` juntos, y en runtime el backend busca `client/dist` como carpeta hermana.
3. **New** → **Database** → **Add PostgreSQL** dentro del mismo proyecto.

Railway va a detectar `railway.json` (ya está en el repo) y usarlo para build/deploy automáticamente — no hace falta tocar nada en la UI para eso.

## 2. Variables de entorno

En el servicio del backend → **Variables**, agregá:

| Variable | Valor | Notas |
|---|---|---|
| `NODE_ENV` | `production` | |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Referencia al plugin de Postgres del mismo proyecto — Railway la resuelve sola, no copies y pegues un connection string a mano. |
| `JWT_ACCESS_SECRET` | *(generar nuevo)* | **No reuses** el de tu `.env` local. Generalo con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. |
| `JWT_REFRESH_SECRET` | *(generar otro distinto)* | Mismo comando, otra corrida. |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | |
| `JWT_REFRESH_EXPIRES_IN` | `24h` | |
| `CORS_ORIGIN` | `https://tu-app.up.railway.app` | El dominio que Railway te asigna (Settings → Networking → Generate Domain). Como frontend y backend son el mismo origen, esto casi no se usa, pero hay que setearlo igual porque es obligatorio. |
| `UPLOAD_DIR` | `/data/uploads` | Ver paso 3 — tiene que coincidir con el mount path del volumen. |
| `MAX_UPLOAD_SIZE_MB` | `20` | |
| `PORT` | *(no la pongas)* | Railway la inyecta sola; el backend ya la respeta (`env.PORT`). |

## 3. Volumen para los archivos subidos

Sin esto, cada `CV` de una postulación y cada imagen de la galería **se borra en el próximo deploy** (el filesystem de Railway es efímero).

1. En el servicio del backend → **Settings** → **Volumes** → **New Volume**.
2. Mount path: `/data/uploads`.
3. Confirmá que `UPLOAD_DIR=/data/uploads` esté seteada (paso 2) — el backend ya resuelve rutas absolutas correctamente, no hace falta tocar código.

## 4. Deploy

Con las variables y el volumen listos, el primer deploy ya corre solo (push a la rama conectada, o **Deploy** manual desde la UI). La secuencia que ejecuta Railway es:

```
pnpm install --frozen-lockfile && pnpm run build   # build: cliente (vite) + backend (tsc)
pnpm --filter backend run deploy:start             # prisma migrate deploy && node dist/index.js
```

`prisma migrate deploy` aplica las migraciones existentes contra la base de Railway — no corre el seed (eso es intencional, el seed trae ~40 usuarios de prueba con contraseña `123456`, no algo para producción).

## 5. Crear el primer admin real

`migrate deploy` deja la base con las tablas pero sin usuarios. Para crear un admin real (no el del seed), corré esto una sola vez desde el **Shell** del servicio en Railway (o localmente apuntando `DATABASE_URL` a la base de Railway):

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

Cambiá la contraseña y el email antes de correrlo. Después de esto, borrá el comando de tu historial de shell (va a quedar la contraseña en texto plano ahí).

## Problemas conocidos / troubleshooting

- **El build falla compilando `bcrypt`**: es un módulo nativo. Si Nixpacks no tiene las herramientas de compilación, el build va a fallar en ese paquete específico. Si pasa, la solución es migrar `bcrypt` → `bcryptjs` (API idéntica, sin compilación nativa) en `backend/package.json` y en los 2 imports (`auth.routes.ts`, `admin.routes.ts`).
- **Los uploads siguen desapareciendo**: revisá que el volumen esté montado en `/data/uploads` *exactamente* como el valor de `UPLOAD_DIR`, y que el volumen esté asignado al servicio correcto (no al plugin de Postgres).
- **Error de CORS en el navegador**: no debería pasar en este esquema (mismo origen), pero si lo ves, confirmá que `CORS_ORIGIN` tenga el dominio público exacto que te dio Railway, sin `/` al final.
