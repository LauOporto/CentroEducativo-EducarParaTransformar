import { Router } from 'express';

import { authRouter } from './auth.routes';
import { gradesRouter } from './grades.routes';
import { studentsRouter } from './students.routes';
import { parentRouter } from './parent.routes';
import { attendanceRouter } from './attendance.routes';
import { paymentsRouter } from './payments.routes';
import { announcementsRouter } from './announcements.routes';
import { notificationsRouter } from './notifications.routes';
import { messagesRouter } from './messages.routes';
import { activitiesRouter } from './activities.routes';
import { studyPlansRouter } from './studyPlans.routes';
import { forumRouter } from './forum.routes';
import { adminRouter } from './admin.routes';
import { moderationPublicRouter, moderationAdminRouter, requireAdmin } from './moderation.routes';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    name: 'Educar para Transformar — API',
    version: '0.2.0',
  });
});

router.use('/auth', authRouter);
router.use('/grades', gradesRouter);
router.use('/students', studentsRouter);
router.use('/parent', parentRouter);
router.use('/attendance', attendanceRouter);
router.use('/payments', paymentsRouter);
router.use('/announcements', announcementsRouter);
router.use('/notifications', notificationsRouter);
router.use('/messages', messagesRouter);
router.use('/activities', activitiesRouter);
router.use('/study-plans', studyPlansRouter);
router.use('/forum', forumRouter);
router.use('/admin', adminRouter);
router.use('/public', moderationPublicRouter);
router.use('/admin', ...requireAdmin(), moderationAdminRouter);

export { router as apiRouter };
