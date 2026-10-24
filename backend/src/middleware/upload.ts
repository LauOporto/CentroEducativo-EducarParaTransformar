import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { HttpError } from '../utils/httpError';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
});

/**
 * Middleware de subida de un único archivo: lo recibe en memoria (multer) y
 * lo sube a Cloudinary, dejando la URL pública en `req.fileUrl`. Reemplaza
 * al disco local porque el plan free de Render no tiene almacenamiento
 * persistente entre reinicios del servicio.
 */
function single(fieldName: string) {
  const parseField = multerUpload.single(fieldName);

  return (req: Request, res: Response, next: NextFunction) => {
    parseField(req, res, (err) => {
      if (err) return next(err);
      if (!req.file) return next();

      const stream = cloudinary.uploader.upload_stream(
        { folder: 'educar-para-transformar', resource_type: 'auto' },
        (uploadErr, result) => {
          if (uploadErr || !result) {
            return next(uploadErr ?? HttpError.internal('No se pudo subir el archivo.'));
          }
          req.fileUrl = result.secure_url;
          next();
        },
      );
      stream.end(req.file.buffer);
    });
  };
}

export const upload = { single };
