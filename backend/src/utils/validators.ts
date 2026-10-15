import { z } from 'zod';

// RNF-40: el DNI debe contener únicamente entre 7 y 8 dígitos numéricos.
export const dniSchema = z
  .string()
  .regex(/^\d{7,8}$/, 'El DNI debe contener entre 7 y 8 dígitos numéricos.');

// RNF-40: el teléfono debe contener solo dígitos.
export const telefonoSchema = z
  .string()
  .regex(/^\d{6,20}$/, 'El teléfono debe contener solo dígitos (entre 6 y 20).');

export const fechaNacimientoSchema = z.coerce
  .date()
  .max(new Date(), 'La fecha de nacimiento no puede ser futura.');

export const legajoSchema = z.string().trim().min(2).max(20);

export const estadoAlumnoSchema = z.enum(['ACTIVO', 'INACTIVO', 'EGRESADO']);

// RF-12: ficha de profesor.
export const especialidadSchema = z.string().trim().min(3).max(80);

export const estadoProfesorSchema = z.enum(['ACTIVO', 'LICENCIA', 'INACTIVO']);
