import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, signAccessToken, signRefreshToken, verifyRefreshToken } from '../middleware/auth';
import { env } from '../config/env';

const REFRESH_COOKIE = 'et_refresh';
const refreshCookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production',
  path: '/api/auth',
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
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
  dni: z.string().min(6).max(15),
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
    await prisma.user.create({
      data: {
        usuario: data.usuario,
        email: data.email,
        dni: data.dni,
        password: hash,
        role,
        nombre: data.nombre,
        curso: data.tipo === 'estudiante' ? data.curso ?? null : null,
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
    const refresh = signRefreshToken({ id: user.id, v: 1 });
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
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || !user.isActive) throw HttpError.unauthorized('Cuenta deshabilitada.');

    const access = signAccessToken({ id: user.id, usuario: user.usuario, role: user.role });
    const newRefresh = signRefreshToken({ id: user.id, v: payload.v + 1 });
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

router.post('/logout', (_req, res) => {
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
        curso: true,
      },
    });
    if (!me) throw HttpError.unauthorized('Sesión inválida.');
    res.json({
      exito: true,
      usuario: { ...me, tipo: roleToTipo[me.role] },
    });
  } catch (err) {
    next(err);
  }
});

export { router as authRouter };
