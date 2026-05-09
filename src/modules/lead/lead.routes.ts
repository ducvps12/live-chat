import { Router } from 'express';
import { leadController } from './lead.controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { scopeCheck } from '../../middlewares/scopeCheck';

const router = Router({ mergeParams: true });

// All lead routes require auth — mounted under /workspaces/:workspaceId/leads
router.get('/', requireAuth, scopeCheck, leadController.list);
router.get('/stats', requireAuth, scopeCheck, leadController.getStats);
router.post('/', requireAuth, scopeCheck, leadController.create);
router.post('/convert', requireAuth, scopeCheck, leadController.convertFromContact);
router.post('/convert-group', requireAuth, scopeCheck, leadController.bulkConvertFromGroup);

// ── AI Analysis Routes ──
router.post('/ai-analyze/:conversationId', requireAuth, scopeCheck, leadController.aiAnalyze);
router.post('/ai-analyze-bulk', requireAuth, scopeCheck, leadController.aiAnalyzeBulk);
router.get('/ai-analysis/:conversationId', requireAuth, scopeCheck, leadController.getAIAnalysis);
router.post('/auto-score', requireAuth, scopeCheck, leadController.autoScore);

// ── CRM Intelligence Routes ──
router.get('/duplicates', requireAuth, scopeCheck, leadController.findDuplicates);
router.post('/merge', requireAuth, scopeCheck, leadController.mergeLeads);
router.get('/dashboard', requireAuth, scopeCheck, leadController.getDashboard);

router.get('/:leadId', requireAuth, scopeCheck, leadController.getById);
router.get('/:leadId/timeline', requireAuth, scopeCheck, leadController.getTimeline);
router.patch('/:leadId', requireAuth, scopeCheck, leadController.update);
router.patch('/:leadId/stage', requireAuth, scopeCheck, leadController.updateStage);
router.post('/:leadId/notes', requireAuth, scopeCheck, leadController.addNote);
router.delete('/:leadId', requireAuth, scopeCheck, leadController.delete);

export default router;
