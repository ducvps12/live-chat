/**
 * Analytics Routes
 */
const express = require('express');
const router = express.Router({ mergeParams: true });
const analyticsController = require('./analytics.controller');

// All routes require workspace context (from parent router)

// Dashboard (all metrics)
router.get('/dashboard', analyticsController.getDashboard.bind(analyticsController));

// Individual endpoints
router.get('/conversations', analyticsController.getConversationStats.bind(analyticsController));
router.get('/messages', analyticsController.getMessageStats.bind(analyticsController));
router.get('/chart', analyticsController.getChartData.bind(analyticsController));

module.exports = router;
