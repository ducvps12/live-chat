import { Router } from 'express';
import { knowledgeController } from './knowledge.controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { scopeCheck } from '../../middlewares/scopeCheck';
import { requirePermission } from '../../middlewares/permission.middleware';
import { PERMISSIONS } from '../../config/permissions';

const router = Router({ mergeParams: true });

// All routes are isolated to a workspace. Mutations require workspace admin/owner rights.
router.use(requireAuth, scopeCheck);

// ────────── Sync from Google Sheets ──────────
router.post('/sync', requirePermission(PERMISSIONS.WORKSPACE_UPDATE), knowledgeController.syncFromSheet);
router.post('/import-url', requirePermission(PERMISSIONS.WORKSPACE_UPDATE), knowledgeController.importFromUrl);
router.post('/import-text', requirePermission(PERMISSIONS.WORKSPACE_UPDATE), knowledgeController.importFromText);

// ────────── Search / Suggest ──────────
router.get('/search', knowledgeController.search);
router.get('/suggest', knowledgeController.suggest);

// ────────── Stats & Products ──────────
router.get('/stats', knowledgeController.getStats);
router.get('/products', knowledgeController.getProducts);

// ────────── CRUD ──────────
router.get('/', knowledgeController.getAll);
router.post('/', requirePermission(PERMISSIONS.WORKSPACE_UPDATE), knowledgeController.create);
router.put('/:id', requirePermission(PERMISSIONS.WORKSPACE_UPDATE), knowledgeController.update);
router.delete('/:id', requirePermission(PERMISSIONS.WORKSPACE_UPDATE), knowledgeController.remove);

export default router;
