import type { Request } from 'express';
import type { Role } from '@prisma/client';

// Patrón Strategy para el Motor de Reportes (RF-25 a RF-33 del Plan de
// Trabajo): cada reporte expone la misma interfaz — filtros, roles
// autorizados y el método que ejecuta la consulta —, y el motor
// (motor.ts) selecciona la estrategia por clave sin conocer el detalle
// interno de cada una. Acá solo se registra "por-alumno"; el resto de
// los 9 reportes se suman como nuevas estrategias, sin tocar el motor
// ni el router.
export interface ReportStrategy<TParams = unknown, TData = unknown> {
  key: string;
  titulo: string;
  descripcion: string;
  rolesAutorizados: Role[];
  parseParams(req: Request): TParams | Promise<TParams>;
  obtenerDatos(params: TParams): Promise<TData>;
  renderPdf(doc: PDFKit.PDFDocument, data: TData): void;
  nombreArchivo(data: TData): string;
}
