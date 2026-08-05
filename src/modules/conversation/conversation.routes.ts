import { Router } from 'express';
import { conversationController } from './conversation.controller';
import { conversationValidate } from './conversation.validate';
import { validateRequest } from '../../middlewares/validateRequest';
import { requireAuth } from '../../middlewares/auth.middleware';
import { scopeCheck } from '../../middlewares/scopeCheck';
import { requirePermission } from '../../middlewares/permission.middleware';
import { PERMISSIONS } from '../../config/permissions';

const router = Router();

// ────────── Public endpoints (widget calls, no auth) ──────────
router.post(
    '/public/find-or-create',
    validateRequest(conversationValidate.findOrCreate),
    conversationController.findOrCreate
);

router.get(
    '/public/visitor/:visitorId/widget/:widgetId',
    conversationController.getByVisitor
);

router.get(
    '/public/:conversationId/messages',
    conversationController.getMessages
);

router.post(
    '/public/:conversationId/messages',
    validateRequest(conversationValidate.sendMessage),
    conversationController.sendMessage
);

router.patch(
    '/public/:conversationId/tracking',
    conversationController.updateTracking
);

router.patch(
    '/public/visitor/enrich',
    conversationController.enrichVisitor
);

router.get(
    '/public/:conversationId/sync',
    conversationController.syncMessages
);

// ────────── Authenticated endpoints (agent dashboard) ──────────
router.get(
    '/workspace/:workspaceId',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_READ),
    conversationController.getByWorkspace
);

router.get(
    '/workspace/:workspaceId/domains',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_READ),
    conversationController.getDomainsByWorkspace
);

router.get(
    '/workspace/:workspaceId/unread-count',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_READ),
    conversationController.getUnreadCount
);

router.delete(
    '/workspace/:workspaceId/reset-messages',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.WORKSPACE_UPDATE),
    conversationController.resetMessages
);

// ────────── Visitors (must be before generic /:conversationId) ──────────
router.get(
    '/workspace/:workspaceId/visitors',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_READ),
    conversationController.getVisitors
);

router.get(
    '/workspace/:workspaceId/visitors/export',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_READ),
    conversationController.exportVisitors
);

router.get(
    '/workspace/:workspaceId/visitors/:visitorId',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_READ),
    conversationController.getVisitor
);

router.patch(
    '/workspace/:workspaceId/visitors/:visitorId',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_ASSIGN),
    conversationController.updateVisitor
);

// ────────── Search conversations by message content ──────────
router.get(
    '/workspace/:workspaceId/search',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_READ),
    conversationController.searchByMessage
);

// ────────── Forward messages to other conversations ──────────
router.post(
    '/workspace/:workspaceId/forward',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_REPLY),
    conversationController.forwardMessages
);

// ────────── SLA (must be before generic /:conversationId) ──────────
router.get(
    '/workspace/:workspaceId/sla/check',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_READ),
    conversationController.checkSLA
);

// ────────── Conversation-specific routes ──────────
router.get(
    '/workspace/:workspaceId/:conversationId',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_READ),
    conversationController.getOne
);

router.get(
    '/workspace/:workspaceId/:conversationId/messages',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_READ),
    conversationController.getConversationMessages
);

router.post(
    '/workspace/:workspaceId/:conversationId/messages',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_REPLY),
    validateRequest(conversationValidate.agentSendMessage),
    conversationController.agentSendMessage
);

router.patch(
    '/workspace/:workspaceId/:conversationId/close',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_CLOSE),
    conversationController.closeConversation
);

router.patch(
    '/workspace/:workspaceId/:conversationId/reopen',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_CLOSE),
    conversationController.reopenConversation
);

router.patch(
    '/workspace/:workspaceId/:conversationId/pending',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_ASSIGN),
    conversationController.setPending
);

router.patch(
    '/workspace/:workspaceId/:conversationId/assign',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_ASSIGN),
    conversationController.assignToMe
);

router.patch(
    '/workspace/:workspaceId/:conversationId/unassign',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_ASSIGN),
    conversationController.unassign
);

router.patch(
    '/workspace/:workspaceId/:conversationId/assign-agent',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_ASSIGN),
    conversationController.assignToAgent
);

router.patch(
    '/workspace/:workspaceId/:conversationId/transfer',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_ASSIGN),
    conversationController.transfer
);

router.patch(
    '/workspace/:workspaceId/:conversationId/read',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_READ),
    conversationController.markRead
);

router.patch(
    '/workspace/:workspaceId/:conversationId/priority',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_ASSIGN),
    conversationController.setPriority
);

router.get(
    '/workspace/:workspaceId/:conversationId/messages/:messageId/context',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_READ),
    conversationController.getMessageContext
);

router.get(
    '/workspace/:workspaceId/:conversationId/receipts',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_READ),
    conversationController.getReceipts
);

router.patch(
    '/workspace/:workspaceId/:conversationId/messages/:messageId',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_REPLY),
    validateRequest(conversationValidate.editMessage),
    conversationController.editMessage
);

router.delete(
    '/workspace/:workspaceId/:conversationId/messages/:messageId',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_REPLY),
    conversationController.recallMessage
);
// ────────── Tags on conversation ──────────
router.post(
    '/workspace/:workspaceId/:conversationId/tags',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_ASSIGN),
    conversationController.addTag
);

router.delete(
    '/workspace/:workspaceId/:conversationId/tags',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_ASSIGN),
    conversationController.removeConvTag
);

// ────────── Pin / Unpin ──────────
router.patch(
    '/workspace/:workspaceId/:conversationId/pin',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_ASSIGN),
    conversationController.togglePin
);

// ────────── Mark as unread ──────────
router.patch(
    '/workspace/:workspaceId/:conversationId/mark-unread',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_READ),
    conversationController.markUnread
);

// ────────── Internal notes ──────────
router.post(
    '/workspace/:workspaceId/:conversationId/notes',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_REPLY),
    validateRequest(conversationValidate.addNote),
    conversationController.addNote
);

// ────────── Conversation metadata (lead stage, star) ──────────
router.patch(
    '/workspace/:workspaceId/:conversationId/metadata',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_ASSIGN),
    conversationController.updateConversationMetadata
);

// ────────── Message reactions ──────────
router.put(
    '/workspace/:workspaceId/messages/:messageId/reactions',
    requireAuth,
    scopeCheck,
    requirePermission(PERMISSIONS.CONVERSATION_REPLY),
    conversationController.updateReactions
);

export default router;
