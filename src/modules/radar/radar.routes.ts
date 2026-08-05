import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { requireAuth, type AuthRequest } from '../../middlewares/auth.middleware';
import { scopeCheck } from '../../middlewares/scopeCheck';
import { requirePermission } from '../../middlewares/permission.middleware';
import { AppError } from '../../middlewares/errorHandler';
import { PERMISSIONS } from '../../config/permissions';
import { signalRadarService } from './radar.service';

const router = Router();
const param = (value: string | string[]) => Array.isArray(value) ? value[0] : value;

router.use('/:workspaceId', requireAuth, scopeCheck);

router.get('/:workspaceId/entitlements', requirePermission(PERMISSIONS.WORKSPACE_READ), asyncHandler(async (req, res) => {
    res.json({ success: true, data: await signalRadarService.entitlements(param(req.params.workspaceId)) });
}));

router.get('/:workspaceId/monitors', requirePermission(PERMISSIONS.WORKSPACE_READ), asyncHandler(async (req, res) => {
    res.json({ success: true, data: await signalRadarService.list(param(req.params.workspaceId)) });
}));

router.post('/:workspaceId/monitors', requirePermission(PERMISSIONS.WORKSPACE_UPDATE), asyncHandler(async (req, res) => {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) throw new AppError('Not authorized to access this route', 401, 'UNAUTHORIZED');
    const data = await signalRadarService.create(param(req.params.workspaceId), userId, req.body);
    res.status(201).json({ success: true, data });
}));

router.patch('/:workspaceId/monitors/:monitorId', requirePermission(PERMISSIONS.WORKSPACE_UPDATE), asyncHandler(async (req, res) => {
    const data = await signalRadarService.update(param(req.params.workspaceId), param(req.params.monitorId), req.body);
    res.json({ success: true, data });
}));

router.delete('/:workspaceId/monitors/:monitorId', requirePermission(PERMISSIONS.WORKSPACE_UPDATE), asyncHandler(async (req, res) => {
    await signalRadarService.remove(param(req.params.workspaceId), param(req.params.monitorId));
    res.json({ success: true });
}));

router.post('/:workspaceId/monitors/:monitorId/check', requirePermission(PERMISSIONS.WORKSPACE_UPDATE), asyncHandler(async (req, res) => {
    const data = await signalRadarService.check(param(req.params.workspaceId), param(req.params.monitorId));
    res.json({ success: true, data });
}));

router.get('/:workspaceId/alerts', requirePermission(PERMISSIONS.WORKSPACE_UPDATE), asyncHandler(async (req, res) => {
    res.json({ success: true, data: await signalRadarService.getAlertSetting(param(req.params.workspaceId)) });
}));

router.put('/:workspaceId/alerts', requirePermission(PERMISSIONS.WORKSPACE_UPDATE), asyncHandler(async (req, res) => {
    const data = await signalRadarService.saveAlertSetting(param(req.params.workspaceId), req.body);
    res.json({ success: true, data });
}));

router.post('/:workspaceId/alerts/test', requirePermission(PERMISSIONS.WORKSPACE_UPDATE), asyncHandler(async (req, res) => {
    const data = await signalRadarService.testAlert(param(req.params.workspaceId), req.body);
    res.json({ success: true, data });
}));

export default router;
