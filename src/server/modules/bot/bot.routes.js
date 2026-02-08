/**
 * Bot Routes - API endpoints for bot management
 */
const express = require('express');
const router = express.Router({ mergeParams: true });
const botController = require('./bot.controller');

// All routes require workspace context (from parent router)

// Rules CRUD
router.get('/rules', botController.getRules.bind(botController));
router.post('/rules', botController.createRule.bind(botController));
router.put('/rules/:ruleId', botController.updateRule.bind(botController));
router.delete('/rules/:ruleId', botController.deleteRule.bind(botController));
router.patch('/rules/:ruleId/toggle', botController.toggleRule.bind(botController));

// Settings
router.get('/settings', botController.getSettings.bind(botController));
router.put('/settings', botController.updateSettings.bind(botController));

// Testing
router.post('/test', botController.testMessage.bind(botController));

module.exports = router;
