# Educar para Transformar — Campus Virtual

Plataforma del campus virtual del colegio "Educar para Transformar". Monorepo con backend en Node/Express/Prisma. El frontend (HTML/CSS/JS estático) es servido directamente por el backend — no requiere un servidor de desarrollo aparte.

## Estructura

```
.
├── backend/    # API REST + servidor (Node + Express + Prisma + PostgreSQL)
└── frontend/   # Sitio estático (HTML + CSS + JS), servido por el backend
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

Esto instala las dependencias del workspace `backend` (el `frontend` no tiene `package.json`: son archivos estáticos, no requiere instalación).

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

```bash
pnpm run backend:dev
```

Levanta la API con recarga automática (`tsx watch`) y sirve el frontend estático desde el mismo proceso. Abrí:

- **App:** http://localhost:4000
- **Health check:** http://localhost:4000/health
- **API:** http://localhost:4000/api

`pnpm run dev` (a nivel raíz) hace lo mismo, ya que el único paquete del workspace con script `dev` es `backend`.

## Otros comandos útiles

```bash
pnpm --filter backend typecheck      # chequeo de tipos sin compilar
pnpm --filter backend build          # compila a backend/dist
pnpm --filter backend start          # corre la build compilada
pnpm --filter backend prisma:studio  # explorador visual de la base de datos
pnpm --filter backend db:reset       # resetea la base y vuelve a correr migraciones + seed
```

## Roles

- **Estudiante** — accede a su boletín, planes de estudio, asistencia y foros.
- **Docente** — carga calificaciones y asistencia, publica planes de estudio y participa en los foros.
- **Padre / Tutor** — visualiza el boletín, las materias y la asistencia de los hijos vinculados a su cuenta.
- **Admin** — administra usuarios, vínculos padre-hijo, aprobación de cuentas docentes y modera inscripciones, opiniones y postulaciones de empleo.

## Estado

En construcción — rama de trabajo: `fabri`.
# CentroEducativo---II
