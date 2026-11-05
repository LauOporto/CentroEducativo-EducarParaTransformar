import { randomInt } from 'node:crypto';
import bcrypt from 'bcrypt';
import { AccionAuditoria, CanalNotificacion, type User } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { logger } from '../utils/logger';
import { registrarAuditoria } from './auditoria.service';
import { crearNotificacion } from './notificaciones/notificacionFactory';
import { HASH_FICTICIO } from './sesion.service';

// RF-48 (D2 / A2): recuperar la contraseña con un código por email y
// cambiarla con la sesión iniciada. Las dos operaciones terminan igual:
// contraseña nueva con bcrypt y TODAS las sesiones del usuario borradas,
// así que cualquier refresh viejo (web o app) deja de servir.
export const RESET_TTL_MS = 1000 * 60 * 15; // 15min
export const RESET_MAX_INTENTOS = 5;
const BCRYPT_COSTO = 10;

export const MSG_OLVIDE = 'Si los datos corresponden a una cuenta activa, te enviamos un código por email.';
export const MSG_CODIGO_INVALIDO = 'Código inválido o vencido.';
export const MSG_PASSWORD_RESTABLECIDA = 'Contraseña restablecida. Iniciá sesión con la nueva contraseña.';

// identificador = nombre de usuario (exacto) o email (sin distinguir
// mayúsculas). Primero se prueba el usuario, que es único y exacto.
async function buscarPorIdentificador(identificador: string): Promise<User | null> {
  const valor = identificador.trim();
  if (!valor) return null;
  const porUsuario = await prisma.user.findUnique({ where: { usuario: valor } });
  if (porUsuario) return porUsuario;
  return prisma.user.findFirst({ where: { email: { equals: valor, mode: 'insensitive' } } });
}

function generarCodigo(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

// POST /auth/password/olvide. La respuesta al usuario es siempre la misma
// (MSG_OLVIDE), exista o no la cuenta: esta función no devuelve nada que
// lo revele, y un fallo del envío solo queda en el log.
export async function solicitarRecuperacion(identificador: string): Promise<void> {
  const user = await buscarPorIdentificador(identificador);
  if (!user || !user.isActive) {
    // Mismo costo de bcrypt que el camino real, para no delatar la cuenta
    // por el tiempo de respuesta.
    await bcrypt.hash(generarCodigo(), BCRYPT_COSTO);
    return;
  }

  const codigo = generarCodigo();
  const codigoHash = await bcrypt.hash(codigo, BCRYPT_COSTO);
  const ahora = new Date();
  await prisma.$transaction([
    // Un solo código vigente por usuario: pedir otro invalida los previos.
    prisma.passwordReset.updateMany({
      where: { usuarioId: user.id, usadoEn: null },
      data: { usadoEn: ahora },
    }),
    prisma.passwordReset.create({
      data: { usuarioId: user.id, codigoHash, expiraEn: new Date(ahora.getTime() + RESET_TTL_MS) },
    }),
  ]);

  try {
    // Siempre por EMAIL (no por el canal preferido del usuario): el código
    // no puede quedar en la campanita de una cuenta a la que no se accede.
    await crearNotificacion(CanalNotificacion.EMAIL, {
      destinatarioId: user.id,
      titulo: 'Código para restablecer tu contraseña',
      contenido: `Tu código para restablecer la contraseña es ${codigo}. Vence en 15 minutos. Si no lo pediste, ignorá este mensaje.`,
    }).enviar();
  } catch (err) {
    logger.error('No se pudo enviar el código de recuperación', {
      usuarioId: user.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

// POST /auth/password/restablecer. Cualquier fallo (cuenta inexistente,
// sin código vigente, código vencido o incorrecto) responde el mismo 400.
export async function restablecerPassword(params: {
  identificador: string;
  codigo: string;
  nuevaPassword: string;
}): Promise<void> {
  const invalido = () => HttpError.badRequest(MSG_CODIGO_INVALIDO);

  const user = await buscarPorIdentificador(params.identificador);
  if (!user || !user.isActive) {
    await bcrypt.compare(params.codigo, HASH_FICTICIO);
    throw invalido();
  }

  const ahora = new Date();
  const reset = await prisma.passwordReset.findFirst({
    where: { usuarioId: user.id, usadoEn: null, expiraEn: { gt: ahora } },
    orderBy: { createdAt: 'desc' },
  });
  if (!reset || reset.intentos >= RESET_MAX_INTENTOS) {
    await bcrypt.compare(params.codigo, HASH_FICTICIO);
    throw invalido();
  }

  const ok = await bcrypt.compare(params.codigo, reset.codigoHash);
  if (!ok) {
    // increment es atómico: dos intentos simultáneos no pisan el contador.
    const actualizado = await prisma.passwordReset.update({
      where: { id: reset.id },
      data: { intentos: { increment: 1 } },
    });
    if (actualizado.intentos >= RESET_MAX_INTENTOS) {
      await prisma.passwordReset.update({ where: { id: reset.id }, data: { usadoEn: ahora } });
    }
    throw invalido();
  }

  const hash = await bcrypt.hash(params.nuevaPassword, BCRYPT_COSTO);
  await prisma.$transaction(async (tx) => {
    // Se marca como usado solo si nadie lo usó en el medio (un único uso).
    const marcado = await tx.passwordReset.updateMany({
      where: { id: reset.id, usadoEn: null },
      data: { usadoEn: ahora },
    });
    if (marcado.count !== 1) throw invalido();
    await tx.user.update({ where: { id: user.id }, data: { password: hash } });
    await tx.session.deleteMany({ where: { usuarioId: user.id } });
  });

  await registrarAuditoria({
    usuarioId: user.id,
    accion: AccionAuditoria.MODIFICACION,
    entidad: 'User',
    entidadId: user.id,
    detalle: 'restablecimiento de contraseña',
  });
}
