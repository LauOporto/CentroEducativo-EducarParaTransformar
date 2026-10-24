import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: number;
        role: Role;
        usuario: string;
      };
      /** URL pública (Cloudinary) del archivo subido en este request, si lo hubo. Ver middleware/upload.ts. */
      fileUrl?: string;
    }
  }
}

export {};
