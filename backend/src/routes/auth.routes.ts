import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { Role, type User } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth } from '../middleware/auth';
import { env } from '../config/env';
import { CURSO_SELECT, formatCursoLabel, resolveCursoId } from '../utils/cursoLabel';
import { dniSchema } from '../utils/validators';
import { esClienteMovil } from '../utils/clienteMovil';
import { SESSION_MAX_MS, cerrarSesion, iniciarSesion, refrescarSesion } from '../services/sesion.service';
import {
  MSG_OLVIDE,
  MSG_PASSWORD_RESTABLECIDA,
  restablecerPassword,
  solicitarRecuperacion,
} from '../services/password.service';

// Capa HTTP de la autenticación: la lógica de sesión (credenciales, tabla
// Session, reglas de 24hs / 30min) vive en services/sesion.service.ts.
// Web y app móvil usan los mismos endpoints (RNF-56); la única diferencia
// es por dónde viaja el refresh token (D1): el web lo recibe en la cookie
// httpOnly et_refresh, la app (header X-Client-Type: mobile) en el body.
const REFRESH_COOKIE = 'et_refresh';

const refreshCookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production',
  path: '/api/auth',
  maxAge: SESSION_MAX_MS,
};

const router = Router();

const tipoToRole: Record<string, Role> = {
  estudiante: Role.ESTUDIANTE,
  docente: Role.DOCENTE,
  padre: Role.PADRE,
  admin: Role.ADMIN,
};

const roleToTipo: Record<Role, string> = {
  ESTUDIANTE: 'estudiante',
  DOCENTE: 'docente',
  PADRE: 'padre',
  ADMIN: 'admin',
};

const registerSchema = z.object({
  tipo: z.enum(['estudiante', 'docente', 'padre']),
  nombre: z.string().min(2),
  email: z.string().email(),
  usuario: z.string().min(3).max(40),
  password: z.string().min(6),
  dni: dniSchema,
  curso: z.string().optional().nullable(),
});

router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const exists = await prisma.user.findFirst({
      where: {
        OR: [{ usuario: data.usuario }, { email: data.email }, { dni: data.dni }],
      },
      select: { id: true },
    });
    if (exists) {
      throw HttpError.conflict('El usuario, DNI o correo ya existen.');
    }

    const hash = await bcrypt.hash(data.password, 10);
    const role = tipoToRole[data.tipo];
    // Los docentes quedan inactivos hasta que un ADMIN los apruebe.
    const pendingApproval = role === Role.DOCENTE;
    const cursoId = data.tipo === 'estudiante' ? await resolveCursoId(prisma, data.curso) : null;
    await prisma.user.create({
      data: {
        usuario: data.usuario,
        email: data.email,
        dni: data.dni,
        password: hash,
        role,
        nombre: data.nombre,
        cursoId,
        estado: role === Role.ESTUDIANTE ? 'ACTIVO' : null,
        isActive: !pendingApproval,
      },
    });

    res.json({
      exito: true,
      mensaje: pendingApproval
        ? 'Registro recibido. Tu cuenta de docente está pendiente de aprobación por un administrador.'
        : '¡Registro exitoso!',
      pendingApproval,
    });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  usuario: z.string().min(1),
  password: z.string().min(1),
});

const refreshBodySchema = z.object({ refreshToken: z.string().min(1).optional() }).passthrough();

// El refresh por body (app móvil) tiene prioridad; si no viene, la cookie (web).
function leerRefresh(req: { body?: unknown; cookies?: Record<string, string> }) {
  const body = refreshBodySchema.safeParse(req.body ?? {});
  const enBody = body.success ? body.data.refreshToken : undefined;
  return { token: enBody ?? req.cookies?.[REFRESH_COOKIE], porBody: enBody !== undefined };
}

function usuarioSesion(user: User, token: string) {
  return { id: user.id, nombre: user.nombre, tipo: roleToTipo[user.role], token };
}

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOpts);
}

router.post('/login', async (req, res, next) => {
  try {
    const { usuario, password } = loginSchema.parse(req.body);
    const movil = esClienteMovil(req);
    const sesion = await iniciarSesion({ usuario, password, movil });

    // Web: refresh en cookie httpOnly (sin cambios). Móvil: en el body.
    if (!movil) setRefreshCookie(res, sesion.refreshToken);
    res.json({
      exito: true,
      mensaje: 'Bienvenido',
      usuario: usuarioSesion(sesion.user, sesion.accessToken),
      ...(movil ? { refreshToken: sesion.refreshToken } : {}),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { token, porBody } = leerRefresh(req);
    const sesion = await refrescarSesion(token, { movil: esClienteMovil(req) });

    // Se responde por el mismo canal por el que llegó el refresh.
    if (!porBody) setRefreshCookie(res, sesion.refreshToken);
    res.json({
      exito: true,
      usuario: usuarioSesion(sesion.user, sesion.accessToken),
      ...(porBody ? { refreshToken: sesion.refreshToken } : {}),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res) => {
  const { token } = leerRefresh(req);
  await cerrarSesion(token);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.json({ exito: true });
});

// D2 / A2: 5 pedidos cada 15 min por IP, solo en olvide y restablecer (cada
// endpoint cuenta por separado). La IP real llega por trust proxy (app.ts).
// En los tests se desactiva para no depender del orden de las pruebas.
function limitePassword() {
  return rateLimit({
    windowMs: 1000 * 60 * 15,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    message: {
      error: 'TOO_MANY_REQUESTS',
      message: 'Hiciste demasiados intentos. Esperá 15 minutos y volvé a probar.',
    },
  });
}

// Misma regla de contraseña que el registro.
const nuevaPasswordSchema = z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.');

const olvideSchema = z.object({ identificador: z.string().trim().min(1).max(120) });

router.post('/password/olvide', limitePassword(), async (req, res, next) => {
  try {
    const { identificador } = olvideSchema.parse(req.body);
    await solicitarRecuperacion(identificador);
    res.json({ exito: true, mensaje: MSG_OLVIDE });
  } catch (err) {
    next(err);
  }
});

const restablecerSchema = z.object({
  identificador: z.string().trim().min(1).max(120),
  // Sin regex de formato: un código mal escrito es un intento fallido más
  // y responde el mismo 400 que uno incorrecto.
  codigo: z.string().trim().min(1).max(12),
  nuevaPassword: nuevaPasswordSchema,
});

router.post('/password/restablecer', limitePassword(), async (req, res, next) => {
  try {
    const data = restablecerSchema.parse(req.body);
    await restablecerPassword(data);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.json({ exito: true, mensaje: MSG_PASSWORD_RESTABLECIDA });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.authUser!.id },
      select: {
        id: true,
        usuario: true,
        email: true,
        dni: true,
        nombre: true,
        role: true,
        curso: { select: CURSO_SELECT },
      },
    });
    if (!me) throw HttpError.unauthorized('Sesión inválida.');
    res.json({
      exito: true,
      usuario: { ...me, curso: formatCursoLabel(me.curso), tipo: roleToTipo[me.role] },
    });
  } catch (err) {
    next(err);
  }
});

export { router as authRouter };
