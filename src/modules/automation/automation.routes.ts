import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import prisma from '../../infra/prisma';
import { requireAuth } from '../../middlewares/auth.middleware';
import { scopeCheck } from '../../middlewares/scopeCheck';
import { requirePermission } from '../../middlewares/permission.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { AppError } from '../../middlewares/errorHandler';

const router = Router();
// Only advertise configurations that have a real runtime. Additional triggers
// and actions can be added after their executor and audit path are available.
const triggers = new Set(['message_received']);
const actions = new Set(['draft_reply', 'tag_conversation']);
const approvalModes = new Set(['required', 'automatic_safe']);
const routeParam = (value: string | string[]) => Array.isArray(value) ? value[0] : value;

router.get('/workspaces/:workspaceId', requireAuth, scopeCheck, requirePermission(PERMISSIONS.WORKSPACE_UPDATE), asyncHandler(async (req, res) => {
    const data = await prisma.automationWorkflow.findMany({ where: { workspaceId: routeParam(req.params.workspaceId) }, orderBy: { updatedAt: 'desc' } });
    res.json({ success: true, data });
}));

router.get('/workspaces/:workspaceId/runs', requireAuth, scopeCheck, requirePermission(PERMISSIONS.WORKSPACE_UPDATE), asyncHandler(async (req, res) => {
    const data = await prisma.automationRun.findMany({
        where: { workspaceId: routeParam(req.params.workspaceId) },
        orderBy: { createdAt: 'desc' },
        take: 30,
    });
    res.json({ success: true, data });
}));

router.post('/workspaces/:workspaceId', requireAuth, scopeCheck, requirePermission(PERMISSIONS.WORKSPACE_UPDATE), asyncHandler(async (req: any, res) => {
    const body = req.body || {};
    const triggerType = String(body.triggerType || 'conversation_created');
    const actionType = String(body.actionType || 'draft_reply');
    const approvalMode = String(body.approvalMode || 'required');
    if (!triggers.has(triggerType) || !actions.has(actionType) || !approvalModes.has(approvalMode)) throw new AppError('Unsupported workflow configuration', 400, 'VALIDATION_ERROR');
    if (approvalMode === 'automatic_safe' && actionType !== 'tag_conversation') throw new AppError('This action requires human approval', 400, 'APPROVAL_REQUIRED');
    const data = await prisma.automationWorkflow.create({ data: { workspaceId: routeParam(req.params.workspaceId), createdById: req.user.id, name: String(body.name || 'Workflow mới').slice(0, 80), triggerType, actionType, approvalMode, config: body.config && typeof body.config === 'object' ? body.config : {} } });
    res.status(201).json({ success: true, data });
}));

router.patch('/workspaces/:workspaceId/:workflowId', requireAuth, scopeCheck, requirePermission(PERMISSIONS.WORKSPACE_UPDATE), asyncHandler(async (req, res) => {
    const existing = await prisma.automationWorkflow.findFirst({ where: { id: routeParam(req.params.workflowId), workspaceId: routeParam(req.params.workspaceId) } });
    if (!existing) throw new AppError('Workflow not found', 404, 'NOT_FOUND');
    const active = Boolean(req.body?.isActive);
    const data = await prisma.automationWorkflow.update({ where: { id: existing.id }, data: { isActive: active } });
    res.json({ success: true, data });
}));

export default router;
