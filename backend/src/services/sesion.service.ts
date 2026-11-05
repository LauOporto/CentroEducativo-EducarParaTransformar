import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { Role, type User } from '@prisma/client';

import { prisma } from '../db/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../middleware/auth';
import { HttpError } from '../utils/httpError';

// RNF-38/39: tope absoluto de 24hs desde el login, e invalidación tras
// 30min de inactividad. El access token (15min, stateless) no se vuelve
// a chequear contra la sesión en cada request — eso violaría el
// principio de "capa de aplicación sin estado" del diseño — así que
// estos dos límites se verifican acá, en el único punto con estado real:
// cuando el cliente pide refrescar el access token vencido.
// RF-48 / RNF-56: el web y la app móvil comparten esta misma tabla Session
// y estas mismas reglas; solo cambia por dónde viaja el refresh (cookie en
// el web, body en la app — ver auth.routes.ts).
export const SESSION_MAX_MS = 1000 * 60 * 60 * 24; // 24hs
export const SESSION_INACTIVITY_MS = 1000 * 60 * 30; // 30min

export const MSG_CREDENCIALES_INVALIDAS = 'Usuario o contraseña incorrectos.';
export const MSG_SOLO_PADRES = 'La app móvil es exclusiva para Padres/Tutores. Ingresá desde el campus web.';
export const MSG_SESION_INVALIDA = 'Sesión inválida. Iniciá sesión de nuevo.';
export const MSG_SESION_VENCIDA = 'La sesión expiró (máximo 24hs desde el login). Iniciá sesión de nuevo.';
export const MSG_SESION_INACTIVA = 'Sesión cerrada por 30min de inactividad. Iniciá sesión de nuevo.';
export const MSG_CUENTA_DESHABILITADA = 'Cuenta deshabilitada.';

// Hash bcrypt (costo 10, igual que las contraseñas reales) de 32 bytes
// aleatorios que se descartan: nunca coincide con nada. Se genera en memoria
// la primera vez que se usa (no queda ningún hash literal en el código) y se
// reutiliza para todo el proceso.
let hashFicticioCache: string | undefined;
export function hashFicticio(): string {
  hashFicticioCache ??= bcrypt.hashSync(randomBytes(32).toString('hex'), 10);
  return hashFicticioCache;
}

export interface SesionEmitida {
  user: User;
  accessToken: string;
  refreshToken: string;
}

function emitirTokens(user: User, sessionId: number): SesionEmitida {
  return {
    user,
    accessToken: signAccessToken({ id: user.id, usuario: user.usuario, role: user.role }),
    refreshToken: signRefreshToken({ sessionId }),
  };
}

// A2: usuario inexistente y contraseña errónea responden lo mismo, y el
// bcrypt se ejecuta igual contra un hash ficticio para que el tiempo de
// respuesta tampoco delate si la cuenta existe. Recién con la contraseña
// correcta se informa el estado de la cuenta.
export async function verificarCredenciales(usuario: string, password: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { usuario } });
  const ok = await bcrypt.compare(password, user?.password ?? hashFicticio());
  if (!user || !ok) {
    throw HttpError.unauthorized(MSG_CREDENCIALES_INVALIDAS);
  }
  if (!user.isActive) {
    if (user.role === Role.DOCENTE) {
      throw HttpError.unauthorized('Tu cuenta de docente está pendiente de aprobación por un administrador.');
    }
    throw HttpError.unauthorized('La cuenta está deshabilitada.');
  }
  return user;
}

// D1: la app móvil es solo para PADRE. El chequeo va después de validar la
// contraseña (no revela el rol de cuentas ajenas) y antes de crear la
// sesión (un 403 no deja filas en Session).
export async function iniciarSesion(params: {
  usuario: string;
  password: string;
  movil: boolean;
}): Promise<SesionEmitida> {
  const user = await verificarCredenciales(params.usuario, params.password);
  if (params.movil && user.role !== Role.PADRE) {
    throw HttpError.forbidden(MSG_SOLO_PADRES);
  }
  const session = await prisma.session.create({
    data: { usuarioId: user.id, expiraEn: new Date(Date.now() + SESSION_MAX_MS) },
  });
  return emitirTokens(user, session.id);
}

// Valida el refresh contra la tabla Session (24hs / 30min / inexistente /
// cuenta deshabilitada), renueva ultimaActividad y emite tokens nuevos.
// Cada refresh devuelto es distinto (jwtid propio); el tope de 24hs sigue
// atado a la sesión, que nunca se extiende.
export async function refrescarSesion(token: string | undefined, opts: { movil: boolean }): Promise<SesionEmitida> {
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
    throw HttpError.unauthorized(MSG_SESION_INVALIDA);
  }

  const session = await prisma.session.findUnique({ where: { id: payload.sessionId } });
  if (!session) throw HttpError.unauthorized(MSG_SESION_INVALIDA);

  const ahora = Date.now();
  const vencida = ahora > session.expiraEn.getTime();
  const inactiva = ahora - session.ultimaActividad.getTime() > SESSION_INACTIVITY_MS;
  if (vencida || inactiva) {
    await prisma.session.delete({ where: { id: session.id } });
    throw HttpError.unauthorized(vencida ? MSG_SESION_VENCIDA : MSG_SESION_INACTIVA);
  }

  const user = await prisma.user.findUnique({ where: { id: session.usuarioId } });
  if (!user || !user.isActive) {
    await prisma.session.delete({ where: { id: session.id } });
    throw HttpError.unauthorized(MSG_CUENTA_DESHABILITADA);
  }
  if (opts.movil && user.role !== Role.PADRE) {
    await prisma.session.delete({ where: { id: session.id } });
    throw HttpError.forbidden(MSG_SOLO_PADRES);
  }

  await prisma.session.update({ where: { id: session.id }, data: { ultimaActividad: new Date() } });
  return emitirTokens(user, session.id);
}

// Cierra la sesión del refresh recibido. Un token inválido, vencido o de
// una sesión ya borrada no es un error: el logout siempre termina bien.
export async function cerrarSesion(token: string | undefined): Promise<void> {
  if (!token) return;
  try {
    const { sessionId } = verifyRefreshToken(token);
    if (typeof sessionId !== 'number') return;
    await prisma.session.deleteMany({ where: { id: sessionId } });
  } catch {
    // Nada que hacer.
  }
}
