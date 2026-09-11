# Educar para Transformar — Campus Virtual

Plataforma del campus virtual del colegio "Educar para Transformar". Monorepo con backend en Node/Express/Prisma y frontend en React 18 + Tailwind (Vite). En producción (o corriendo `pnpm run backend:dev` con el cliente ya compilado) el backend sirve directamente el build de `client/` desde un único puerto — no hace falta un servidor aparte para el frontend.

## Estructura

```
.
├── backend/    # API REST + servidor (Node + Express + Prisma + PostgreSQL)
├── client/     # SPA en React 18 + Tailwind (Vite) — lo que sirve el backend
└── frontend/   # Sitio estático anterior (HTML + CSS + JS) — en desuso, reemplazado por client/
```

## Requisitos

- Node.js >= 22.13
- pnpm >= 9 (el repo usa pnpm 11 vía `packageManager`)
- PostgreSQL 16 corriendo localmente (o accesible por red)

## Setup

### 1. Instalar dependencias

```bash
pnpm install
```

Esto instala las dependencias de `backend` y `client` (el `frontend` viejo no tiene `package.json`: son archivos estáticos que ya no se usan).

### 2. Configurar variables de entorno

```bash
cp backend/.env.example backend/.env
```

Editá `backend/.env` y completá al menos:

- `DATABASE_URL` — cadena de conexión a tu PostgreSQL local (usuario, password y nombre de la base).
- `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` — secretos largos y aleatorios. Podés generarlos con:

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

El resto de las variables (`PORT`, `CORS_ORIGIN`, `UPLOAD_DIR`) ya tienen valores por defecto razonables para desarrollo local.

### 3. Crear la base de datos

Creá una base vacía en tu instancia de PostgreSQL con el nombre que pusiste en `DATABASE_URL` (por defecto `educar_transformar_db`), por ejemplo:

```bash
psql -U postgres -c "CREATE DATABASE educar_transformar_db;"
```

### 4. Aplicar migraciones y cargar datos de prueba

```bash
pnpm --filter backend prisma:migrate
pnpm --filter backend prisma:seed
```

El seed crea usuarios de prueba para cada rol (admin, docentes, estudiantes, padres). La contraseña de todos es `123456`; el login acepta `usuario` o `email`. Revisá [backend/prisma/seed.ts](backend/prisma/seed.ts) para ver los usuarios disponibles (ej. `admin` / `123456`).

## Correr el programa

Hay dos formas de levantarlo, según qué estés haciendo.

### Opción A — Desarrollando el frontend (con hot-reload)

Dos terminales:

```bash
pnpm run backend:dev   # API en http://localhost:4000
pnpm run client:dev    # Vite en http://localhost:5173, con hot-reload
```

Abrí **http://localhost:5173**. Vite tiene un proxy configurado (`client/vite.config.js`) que reenvía `/api` y `/uploads` al backend en el puerto 4000, así que desde el navegador todo se ve como si fuera un solo origen.

### Opción B — Un solo proceso (como en producción)

```bash
pnpm run client:build   # compila client/ a client/dist
pnpm run backend:dev    # (o pnpm --filter backend start, con el backend ya compilado)
```

Abrí **http://localhost:4000** — el backend sirve la API y el build de React desde el mismo puerto y proceso. Usá esta opción para probar el comportamiento real antes de desplegar, o cuando no necesites hot-reload del frontend.

En ambos casos:
- **Health check:** http://localhost:4000/health
- **API:** http://localhost:4000/api

`pnpm run dev` (a nivel raíz) es un alias de `backend:dev`.

## Otros comandos útiles

```bash
pnpm --filter backend typecheck      # chequeo de tipos sin compilar
pnpm --filter backend build          # compila a backend/dist
pnpm --filter backend start          # corre la build compilada
pnpm --filter backend prisma:studio  # explorador visual de la base de datos
pnpm --filter backend db:reset       # resetea la base y vuelve a correr migraciones + seed
pnpm run client:build                # compila client/ a client/dist (lo que sirve el backend)
pnpm --filter client dev             # solo Vite, sin pasar por el script de raíz
```

## Roles

- **Estudiante** — accede a su boletín, planes de estudio, asistencia y foros.
- **Docente** — carga calificaciones y asistencia, publica planes de estudio y participa en los foros.
- **Padre / Tutor** — visualiza el boletín, las materias y la asistencia de los hijos vinculados a su cuenta.
- **Admin** — administra usuarios, vínculos padre-hijo, aprobación de cuentas docentes y modera inscripciones, opiniones y postulaciones de empleo.

## Estado

En construcción — rama de trabajo: `fabri`.
# CentroEducativo---II
