import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth';
import { assertCanViewStudent, assertCanManageStudentServices } from '../utils/studentAccess';
import * as panelFamilia from '../services/panelFamilia.facade';

const router = Router();

router.use(requireAuth);

router.get('/estudiantes/:id/resumen', async (req, res, next) => {
  try {
    const estudianteId = Number(req.params.id);
    await assertCanViewStudent(req, estudianteId);
    const resumen = await panelFamilia.obtenerResumenServicios(estudianteId);
    res.json({ exito: true, ...resumen });
  } catch (err) { next(err); }
});

const grupoDeporteSchema = z.object({ grupoDeporteId: z.coerce.number().int().positive() });

router.post('/estudiantes/:id/deportes', async (req, res, next) => {
  try {
    const estudianteId = Number(req.params.id);
    await assertCanManageStudentServices(req, estudianteId);
    const { grupoDeporteId } = grupoDeporteSchema.parse(req.body);
    const grupo = await panelFamilia.inscribirDeporte(estudianteId, grupoDeporteId);
    res.json({ exito: true, grupo });
  } catch (err) { next(err); }
});

router.delete('/estudiantes/:id/deportes/:grupoDeporteId', async (req, res, next) => {
  try {
    const estudianteId = Number(req.params.id);
    await assertCanManageStudentServices(req, estudianteId);
    const grupoDeporteId = Number(req.params.grupoDeporteId);
    await panelFamilia.desinscribirDeporte(estudianteId, grupoDeporteId);
    res.json({ exito: true });
  } catch (err) { next(err); }
});

const recorridoSchema = z.object({ recorridoId: z.coerce.number().int().positive() });

router.put('/estudiantes/:id/transporte', async (req, res, next) => {
  try {
    const estudianteId = Number(req.params.id);
    await assertCanManageStudentServices(req, estudianteId);
    const { recorridoId } = recorridoSchema.parse(req.body);
    const transporte = await panelFamilia.inscribirTransporte(estudianteId, recorridoId);
    res.json({ exito: true, transporte });
  } catch (err) { next(err); }
});

router.delete('/estudiantes/:id/transporte', async (req, res, next) => {
  try {
    const estudianteId = Number(req.params.id);
    await assertCanManageStudentServices(req, estudianteId);
    await panelFamilia.desinscribirTransporte(estudianteId);
    res.json({ exito: true });
  } catch (err) { next(err); }
});

const turnoSchema = z.object({ turnoId: z.coerce.number().int().positive() });

router.put('/estudiantes/:id/comedor', async (req, res, next) => {
  try {
    const estudianteId = Number(req.params.id);
    await assertCanManageStudentServices(req, estudianteId);
    const { turnoId } = turnoSchema.parse(req.body);
    const comedor = await panelFamilia.inscribirComedor(estudianteId, turnoId);
    res.json({ exito: true, comedor });
  } catch (err) { next(err); }
});

router.delete('/estudiantes/:id/comedor', async (req, res, next) => {
  try {
    const estudianteId = Number(req.params.id);
    await assertCanManageStudentServices(req, estudianteId);
    await panelFamilia.desinscribirComedor(estudianteId);
    res.json({ exito: true });
  } catch (err) { next(err); }
});

export { router as inscripcionesRouter };
