/**
 * AI Routes
 */
const express = require('express');
const router = express.Router();
const aiController = require('./ai.controller');
const authenticate = require('../../middlewares/authenticate');

// All routes require authentication
router.use(authenticate);

// Test AI connection
router.post('/test', aiController.testAi);

// Generate AI response (for UI testing)
router.post('/generate', aiController.generateResponse);

// Get available models
router.get('/models', aiController.getModels);

// AI settings per workspace
router.get('/settings/:workspaceKey', aiController.getSettings);
router.put('/settings/:workspaceKey', aiController.updateSettings);

// AI usage statistics
router.get('/usage/:workspaceKey', aiController.getUsage);

module.exports = router;
