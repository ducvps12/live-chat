import { Router } from 'express';
import { chatbotController } from './chatbot.controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { scopeCheck } from '../../middlewares/scopeCheck';
import { requirePermission } from '../../middlewares/permission.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { validateRequest } from '../../middlewares/validateRequest';
import { chatbotValidate } from './chatbot.validate';

const router = Router();

router.get('/templates', requireAuth, chatbotController.listTemplates);

router.post(
    '/workspace/:workspaceId/templates/:templateKey/apply',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.WORKSPACE_UPDATE),
    chatbotController.applyTemplate,
);

router.post(
    '/workspace/:workspaceId/actions/shopee-affiliate/preview',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.WORKSPACE_UPDATE),
    chatbotController.previewShopeeAffiliate,
);

// Preview endpoint. Real channel auto-reply is triggered internally after an incoming message is persisted.
router.post(
    '/public/:workspaceId/process',
    requireAuth,
    scopeCheck,
    chatbotController.processMessage
);

// ────────── Authenticated: bot management ──────────
router.get(
    '/workspace/:workspaceId',
    requireAuth,
    scopeCheck,
    chatbotController.list
);

router.get(
    '/workspace/:workspaceId/stats',
    requireAuth,
    scopeCheck,
    chatbotController.getStats
);

router.post(
    '/workspace/:workspaceId/preview',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.WORKSPACE_UPDATE),
    validateRequest(chatbotValidate.preview),
    chatbotController.previewReply
);

router.get(
    '/workspace/:workspaceId/:botId',
    requireAuth,
    scopeCheck,
    chatbotController.getOne
);

router.post(
    '/workspace/:workspaceId',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.WORKSPACE_UPDATE),
    validateRequest(chatbotValidate.create),
    chatbotController.create
);

router.put(
    '/workspace/:workspaceId/:botId',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.WORKSPACE_UPDATE),
    validateRequest(chatbotValidate.update),
    chatbotController.update
);

router.patch(
    '/workspace/:workspaceId/:botId/toggle',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.WORKSPACE_UPDATE),
    validateRequest(chatbotValidate.toggle),
    chatbotController.toggleActive
);

router.delete(
    '/workspace/:workspaceId/:botId',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.WORKSPACE_UPDATE),
    chatbotController.remove
);

// ────────── AI Models ──────────
router.get(
    '/ai/models',
    requireAuth,
    chatbotController.listModels
);

export default router;
