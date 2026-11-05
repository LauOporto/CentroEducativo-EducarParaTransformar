import type { Request } from 'express';

// D1: la app móvil se identifica con el header "X-Client-Type: mobile"
// (sin importar mayúsculas). Sin el header, la request es del campus web.
export function esClienteMovil(req: Pick<Request, 'get'>): boolean {
  return req.get('x-client-type')?.trim().toLowerCase() === 'mobile';
}
