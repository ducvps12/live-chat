/**
 * Zalo Personal API Controller
 * Extended endpoints for CRM features
 */

const express = require('express');
const router = express.Router();

const templateService = require('./templates.service');
const leadService = require('./lead.service');
const autoreplyService = require('./autoreply.service');

// =============================================
// MESSAGE TEMPLATES ENDPOINTS
// =============================================

/**
 * GET /api/zalo-personal/:workspaceId/templates
 * Get all message templates for workspace
 */
router.get('/:workspaceId/templates', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { category, active } = req.query;

        const templates = await templateService.getTemplates(workspaceId, {
            category,
            isActive: active !== 'false'
        });

        res.json({ success: true, data: templates });
    } catch (error) {
        console.error('[ZaloAPI] Get templates error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/zalo-personal/:workspaceId/templates/shortcut/:shortcut
 * Get template by shortcut (for quick reply)
 */
router.get('/:workspaceId/templates/shortcut/:shortcut', async (req, res) => {
    try {
        const { workspaceId, shortcut } = req.params;

        const template = await templateService.getTemplateByShortcut(workspaceId, shortcut);

        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        res.json({ success: true, data: template });
    } catch (error) {
        console.error('[ZaloAPI] Get template by shortcut error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/zalo-personal/:workspaceId/templates
 * Create a new template
 */
router.post('/:workspaceId/templates', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const userKey = req.user?.userKey || null;

        const template = await templateService.createTemplate(workspaceId, req.body, userKey);

        res.status(201).json({ success: true, data: template });
    } catch (error) {
        console.error('[ZaloAPI] Create template error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/zalo-personal/templates/:templateId
 * Update a template
 */
router.put('/templates/:templateId', async (req, res) => {
    try {
        const { templateId } = req.params;

        const template = await templateService.updateTemplate(templateId, req.body);

        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        res.json({ success: true, data: template });
    } catch (error) {
        console.error('[ZaloAPI] Update template error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/zalo-personal/templates/:templateId
 * Delete a template
 */
router.delete('/templates/:templateId', async (req, res) => {
    try {
        const { templateId } = req.params;

        await templateService.deleteTemplate(templateId);

        res.json({ success: true, message: 'Template deleted' });
    } catch (error) {
        console.error('[ZaloAPI] Delete template error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/zalo-personal/:workspaceId/templates/seed
 * Seed default templates for workspace
 */
router.post('/:workspaceId/templates/seed', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const userKey = req.user?.userKey || null;

        const templates = await templateService.seedDefaultTemplates(workspaceId, userKey);

        res.json({ success: true, data: templates, count: templates.length });
    } catch (error) {
        console.error('[ZaloAPI] Seed templates error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =============================================
// LEAD MANAGEMENT ENDPOINTS
// =============================================

/**
 * GET /api/zalo-personal/:workspaceId/leads/stats
 * Get lead statistics by stage
 */
router.get('/:workspaceId/leads/stats', async (req, res) => {
    try {
        const { workspaceId } = req.params;

        const stats = await leadService.getLeadStats(workspaceId);

        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[ZaloAPI] Get lead stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/zalo-personal/leads/:conversationId/stage
 * Update lead stage
 */
router.put('/leads/:conversationId/stage', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { stage, note } = req.body;
        const userKey = req.user?.userKey || null;

        const result = await leadService.updateLeadStage(conversationId, stage, userKey, note);

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[ZaloAPI] Update lead stage error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/zalo-personal/leads/:conversationId/history
 * Get lead stage history
 */
router.get('/leads/:conversationId/history', async (req, res) => {
    try {
        const { conversationId } = req.params;

        const history = await leadService.getStageHistory(conversationId);

        res.json({ success: true, data: history });
    } catch (error) {
        console.error('[ZaloAPI] Get lead history error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/zalo-personal/leads/:conversationId/followup
 * Set follow-up reminder
 */
router.put('/leads/:conversationId/followup', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { date } = req.body;

        const result = await leadService.setFollowUp(conversationId, new Date(date));

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[ZaloAPI] Set follow-up error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/zalo-personal/:workspaceId/leads/due
 * Get leads due for follow-up
 */
router.get('/:workspaceId/leads/due', async (req, res) => {
    try {
        const { workspaceId } = req.params;

        const leads = await leadService.getDueFollowUps(workspaceId);

        res.json({ success: true, data: leads });
    } catch (error) {
        console.error('[ZaloAPI] Get due follow-ups error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =============================================
// AUTO-REPLY RULES ENDPOINTS
// =============================================

/**
 * GET /api/zalo-personal/:workspaceId/autoreply
 * Get all auto-reply rules
 */
router.get('/:workspaceId/autoreply', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { active } = req.query;

        const rules = await autoreplyService.getRules(workspaceId, active !== 'false');

        res.json({ success: true, data: rules });
    } catch (error) {
        console.error('[ZaloAPI] Get auto-reply rules error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/zalo-personal/:workspaceId/autoreply
 * Create a new auto-reply rule
 */
router.post('/:workspaceId/autoreply', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const userKey = req.user?.userKey || null;

        const rule = await autoreplyService.createRule(workspaceId, req.body, userKey);

        res.status(201).json({ success: true, data: rule });
    } catch (error) {
        console.error('[ZaloAPI] Create auto-reply rule error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/zalo-personal/autoreply/:ruleId
 * Update an auto-reply rule
 */
router.put('/autoreply/:ruleId', async (req, res) => {
    try {
        const { ruleId } = req.params;

        const rule = await autoreplyService.updateRule(ruleId, req.body);

        if (!rule) {
            return res.status(404).json({ success: false, error: 'Rule not found' });
        }

        res.json({ success: true, data: rule });
    } catch (error) {
        console.error('[ZaloAPI] Update auto-reply rule error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/zalo-personal/autoreply/:ruleId
 * Delete an auto-reply rule
 */
router.delete('/autoreply/:ruleId', async (req, res) => {
    try {
        const { ruleId } = req.params;

        await autoreplyService.deleteRule(ruleId);

        res.json({ success: true, message: 'Rule deleted' });
    } catch (error) {
        console.error('[ZaloAPI] Delete auto-reply rule error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/zalo-personal/:workspaceId/autoreply/seed
 * Seed default auto-reply rules
 */
router.post('/:workspaceId/autoreply/seed', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const userKey = req.user?.userKey || null;

        const rules = await autoreplyService.seedDefaultRules(workspaceId, userKey);

        res.json({ success: true, data: rules, count: rules.length });
    } catch (error) {
        console.error('[ZaloAPI] Seed auto-reply rules error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/zalo-personal/lead-stages
 * Get available lead stages
 */
router.get('/lead-stages', (req, res) => {
    res.json({
        success: true,
        data: {
            stages: leadService.LEAD_STAGES,
            labels: leadService.LEAD_STAGE_LABELS,
            colors: leadService.LEAD_STAGE_COLORS
        }
    });
});

module.exports = router;
