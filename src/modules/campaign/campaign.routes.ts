import { Router } from 'express';
import { campaignController } from './campaign.controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { scopeCheck } from '../../middlewares/scopeCheck';
import { requirePermission } from '../../middlewares/permission.middleware';
import { PERMISSIONS } from '../../config/permissions';

const router = Router({ mergeParams: true }); // /api/v1/workspaces/:workspaceId/campaigns

router.use(requireAuth);
router.use(scopeCheck);

// ── Campaign CRUD ──
router.get('/stats', requirePermission(PERMISSIONS.CAMPAIGN_READ), campaignController.getStats);         // GET  — workspace-level stats
router.get('/telegram/status', requirePermission(PERMISSIONS.CAMPAIGN_READ), campaignController.telegramStatus);
router.get('/telegram/destinations', requirePermission(PERMISSIONS.CAMPAIGN_READ), campaignController.telegramDestinations);
router.get('/', requirePermission(PERMISSIONS.CAMPAIGN_READ), campaignController.list);                   // GET  — list campaigns
router.post('/', requirePermission(PERMISSIONS.CAMPAIGN_MANAGE), campaignController.create);                // POST — create draft
router.get('/:campaignId', requirePermission(PERMISSIONS.CAMPAIGN_READ), campaignController.getById);     // GET  — single campaign + live progress
router.put('/:campaignId', requirePermission(PERMISSIONS.CAMPAIGN_MANAGE), campaignController.update);      // PUT  — update draft

// ── Campaign Execution ──
router.post('/:campaignId/start', requirePermission(PERMISSIONS.CAMPAIGN_MANAGE), campaignController.start);    // POST — start
router.post('/:campaignId/pause', requirePermission(PERMISSIONS.CAMPAIGN_MANAGE), campaignController.pause);    // POST — pause
router.post('/:campaignId/resume', requirePermission(PERMISSIONS.CAMPAIGN_MANAGE), campaignController.resume);  // POST — resume
router.delete('/:campaignId', requirePermission(PERMISSIONS.CAMPAIGN_MANAGE), campaignController.cancel);       // DELETE — cancel/delete

export const campaignRoutes = router;
