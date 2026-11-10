import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { hayNombreEquivalente } from '../utils/texto';
import { requireAuth, requireRole } from '../middleware/auth';
import { actualizarPrecio, conMonto } from '../services/precios.service';

const router = Router();

// Lectura: cualquier usuario autenticado (lo consumen los selects de
// curso en varios paneles). El alta pública (RF-4.1) no necesita esto
// porque elige directamente el curso, no el nivel.
router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const niveles = await prisma.nivelEducativo.findMany({ orderBy: { id: 'asc' } });
    res.json({ exito: true, niveles: niveles.map((n) => conMonto(n, 'cuotaMensual')) });
  } catch (err) {
    next(err);
  }
});

router.use(requireAuth, requireRole(Role.ADMIN));

// Parte 3: valor mensual de la cuota del nivel. Solo ADMIN (el router ya lo exige).
// Rige para las facturas que se emitan después; las emitidas no cambian.
router.put('/:id/cuota', async (req, res, next) => {
  try {
    const nivel = await actualizarPrecio('nivel', Number(req.params.id), req.body?.precio, req.authUser!.id);
    res.json({ exito: true, nivel });
  } catch (err) {
    next(err);
  }
});

const nivelSchema = z.object({ nombre: z.string().trim().min(2).max(40) });

router.post('/', async (req, res, next) => {
  try {
    const data = nivelSchema.parse(req.body);
    const existe = hayNombreEquivalente(
      await prisma.nivelEducativo.findMany({ select: { id: true, nombre: true } }),
      data.nombre,
    );
    if (existe) throw HttpError.conflict('Ya existe un nivel educativo con ese nombre.');
    const nivel = await prisma.nivelEducativo.create({ data });
    res.json({ exito: true, nivel: conMonto(nivel, 'cuotaMensual') });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = nivelSchema.parse(req.body);
    const conflicto = hayNombreEquivalente(
      await prisma.nivelEducativo.findMany({ select: { id: true, nombre: true } }),
      data.nombre,
      id,
    );
    if (conflicto) throw HttpError.conflict('Ya existe un nivel educativo con ese nombre.');
    const nivel = await prisma.nivelEducativo.update({ where: { id }, data });
    res.json({ exito: true, nivel: conMonto(nivel, 'cuotaMensual') });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const cursosAsociados = await prisma.curso.count({ where: { nivelId: id } });
    if (cursosAsociados > 0) {
      throw HttpError.conflict(
        'No se puede eliminar: el nivel tiene cursos asociados. Eliminalos o reasignalos primero.',
      );
    }
    await prisma.nivelEducativo.delete({ where: { id } });
    res.json({ exito: true });
  } catch (err) {
    next(err);
  }
});

export { router as nivelesRouter };
