import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

import { env } from '../config/env';
import { HttpError } from '../utils/httpError';

interface AccessTokenPayload {
  id: number;
  usuario: string;
  role: Role;
}

interface RefreshTokenPayload {
  id: number;
  v: number;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(HttpError.unauthorized('Falta el token de acceso.'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    req.authUser = { id: decoded.id, usuario: decoded.usuario, role: decoded.role };
    next();
  } catch {
    next(HttpError.unauthorized('Token inválido o expirado.'));
  }
};

export function requireRole(...allowed: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.authUser) return next(HttpError.unauthorized());
    if (!allowed.includes(req.authUser.role)) {
      return next(HttpError.forbidden('Tu rol no tiene permiso para esta acción.'));
    }
    next();
  };
}

// Docentes y administradores comparten permisos en la mayoría de las rutas
// académicas (asistencia, calificaciones, actividades, anuncios, etc.).
// Se nombra la combinación una sola vez acá en lugar de repetir
// requireRole(Role.DOCENTE, Role.ADMIN) en cada archivo de rutas.
export const requireStaffRole: RequestHandler = requireRole(Role.DOCENTE, Role.ADMIN);
