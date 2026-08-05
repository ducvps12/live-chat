import { Router } from 'express';
import { emailController } from './email.controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { scopeCheck } from '../../middlewares/scopeCheck';
import { requirePermission } from '../../middlewares/permission.middleware';
import { PERMISSIONS } from '../../config/permissions';

const router = Router();

router.get('/workspace/:workspaceId', requireAuth, scopeCheck, requirePermission(PERMISSIONS.SETTINGS_READ), emailController.list);
router.get('/workspace/:workspaceId/:accountId', requireAuth, scopeCheck, requirePermission(PERMISSIONS.SETTINGS_READ), emailController.getById);
router.post('/workspace/:workspaceId', requireAuth, scopeCheck, requirePermission(PERMISSIONS.SETTINGS_UPDATE), emailController.create);
router.post('/workspace/:workspaceId/test-smtp', requireAuth, scopeCheck, requirePermission(PERMISSIONS.SETTINGS_UPDATE), emailController.testSmtp);
router.patch('/workspace/:workspaceId/:accountId', requireAuth, scopeCheck, requirePermission(PERMISSIONS.SETTINGS_UPDATE), emailController.update);
router.delete('/workspace/:workspaceId/:accountId', requireAuth, scopeCheck, requirePermission(PERMISSIONS.SETTINGS_UPDATE), emailController.remove);

export default router;
