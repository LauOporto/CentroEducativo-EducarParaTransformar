import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

// D3: CORS_ORIGIN admite varios orígenes separados por coma (ej. el dominio
// de Render y Expo web en desarrollo). Cada uno se valida como URL y se le
// quita la "/" final, porque el navegador manda el Origin sin ella. Las apps
// nativas no mandan Origin, así que no necesitan figurar acá.
export const corsOriginSchema = z
  .string()
  .default('http://localhost:5173')
  .transform((valor) =>
    valor
      .split(',')
      .map((origen) => origen.trim().replace(/\/+$/, ''))
      .filter((origen) => origen.length > 0),
  )
  .pipe(z.array(z.string().url('Cada origen de CORS_ORIGIN debe ser una URL válida')).min(1));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: corsOriginSchema,

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatorio'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  // RNF-38: tope absoluto de sesión de 24hs. La invalidación real vive en
  // la tabla Session (ver auth.routes.ts); esto es solo el límite del JWT.
  JWT_REFRESH_EXPIRES_IN: z.string().default('24h'),

  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(20),

  // Cloudinary: storage externo para los archivos subidos (galería, CVs,
  // planes de estudio). El plan free de Render no tiene disco persistente
  // — sin esto, cada reinicio del servicio borra los archivos.
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME es obligatorio'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY es obligatorio'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET es obligatorio'),

  // D6: dónde se guardan los comprobantes de transferencia ('cloudinary' o
  // 'local'). Opcional: sin cargar se elige solo según NODE_ENV (ver
  // services/almacenamiento.ts). Se guarda como texto libre para que un valor
  // mal escrito no tire el arranque: el servicio lo ignora con un warning.
  STORAGE_DRIVER: z.string().trim().toLowerCase().optional(),

  // Parte 3: datos bancarios del colegio que se muestran en la factura y en
  // el comprobante de pago (solo se aceptan transferencias). Opcionales: los
  // defaults son ficticios, para desarrollo y demo.
  BANCO_TITULAR: z.string().trim().min(1).default('Educar para Transformar S.A.'),
  BANCO_CUIT: z.string().trim().min(1).default('30-71234567-8'),
  BANCO_CBU: z.string().trim().min(1).default('0000003100012345678901'),
  BANCO_ALIAS: z.string().trim().min(1).default('EDUCAR.TRANSFORMAR.CUOTAS'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
