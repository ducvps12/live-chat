const express = require('express');
const router = express.Router();
const controller = require('./onboarding.controller');
const authenticate = require('../../middlewares/authenticate');

// All routes require authentication
router.use(authenticate);

router.get('/status', controller.checkStatus);
router.post('/complete', controller.completeOnboarding);

module.exports = router;
