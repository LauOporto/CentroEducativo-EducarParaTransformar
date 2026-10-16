import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, signAccessToken, signRefreshToken, verifyRefreshToken } from '../middleware/auth';
import { env } from '../config/env';
import { CURSO_SELECT, formatCursoLabel, resolveCursoId } from '../utils/cursoLabel';
import { dniSchema } from '../utils/validators';

const REFRESH_COOKIE = 'et_refresh';

// RNF-38/39: tope absoluto de 24hs desde el login, e invalidación tras
// 30min de inactividad. El access token (15min, stateless) no se vuelve
// a chequear contra la sesión en cada request — eso violaría el
// principio de "capa de aplicación sin estado" del diseño — así que
// estos dos límites se verifican acá, en el único punto con estado real:
// cuando el cliente pide refrescar el access token vencido.
const SESSION_MAX_MS = 1000 * 60 * 60 * 24; // 24hs
const SESSION_INACTIVITY_MS = 1000 * 60 * 30; // 30min

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
        OR: [
          { usuario: data.usuario },
          { email: data.email },
          { dni: data.dni },
        ],
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

router.post('/login', async (req, res, next) => {
  try {
    const { usuario, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { usuario } });
    if (!user) {
      throw HttpError.unauthorized('El usuario no existe.');
    }
    if (!user.isActive) {
      if (user.role === Role.DOCENTE) {
        throw HttpError.unauthorized('Tu cuenta de docente está pendiente de aprobación por un administrador.');
      }
      throw HttpError.unauthorized('La cuenta está deshabilitada.');
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw HttpError.unauthorized('Contraseña incorrecta.');
    }

    const token = signAccessToken({
      id: user.id,
      usuario: user.usuario,
      role: user.role,
    });
    const session = await prisma.session.create({
      data: { usuarioId: user.id, expiraEn: new Date(Date.now() + SESSION_MAX_MS) },
    });
    const refresh = signRefreshToken({ sessionId: session.id });
    res.cookie(REFRESH_COOKIE, refresh, refreshCookieOpts);

    res.json({
      exito: true,
      mensaje: 'Bienvenido',
      usuario: {
        id: user.id,
        nombre: user.nombre,
        tipo: roleToTipo[user.role],
        token,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw HttpError.unauthorized('No hay refresh token.');
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw HttpError.unauthorized('Refresh token inválido o expirado.');
    }
    // Cookies de refresh emitidas antes de la tabla Session (formato viejo
    // {id, v}) verifican la firma OK pero no traen sessionId — tratarlas
    // como sesión inválida en vez de dejar que Prisma explote con un 500.
    if (typeof payload.sessionId !== 'number') {
      throw HttpError.unauthorized('Sesión inválida. Iniciá sesión de nuevo.');
    }

    const session = await prisma.session.findUnique({ where: { id: payload.sessionId } });
    if (!session) throw HttpError.unauthorized('Sesión inválida. Iniciá sesión de nuevo.');

    const ahora = Date.now();
    const vencida = ahora > session.expiraEn.getTime();
    const inactiva = ahora - session.ultimaActividad.getTime() > SESSION_INACTIVITY_MS;
    if (vencida || inactiva) {
      await prisma.session.delete({ where: { id: session.id } });
      throw HttpError.unauthorized(
        vencida
          ? 'La sesión expiró (máximo 24hs desde el login). Iniciá sesión de nuevo.'
          : 'Sesión cerrada por 30min de inactividad. Iniciá sesión de nuevo.',
      );
    }

    const user = await prisma.user.findUnique({ where: { id: session.usuarioId } });
    if (!user || !user.isActive) {
      await prisma.session.delete({ where: { id: session.id } });
      throw HttpError.unauthorized('Cuenta deshabilitada.');
    }

    await prisma.session.update({ where: { id: session.id }, data: { ultimaActividad: new Date() } });

    const access = signAccessToken({ id: user.id, usuario: user.usuario, role: user.role });
    const newRefresh = signRefreshToken({ sessionId: session.id });
    res.cookie(REFRESH_COOKIE, newRefresh, refreshCookieOpts);

    res.json({
      exito: true,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        tipo: roleToTipo[user.role],
        token: access,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      const { sessionId } = verifyRefreshToken(token);
      await prisma.session.delete({ where: { id: sessionId } });
    } catch {
      // Token inválido, ya vencido, o sesión ya borrada: nada que hacer.
    }
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.json({ exito: true });
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
