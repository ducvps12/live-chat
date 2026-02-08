const express = require('express');
const router = express.Router();
const callcenterController = require('./callcenter.controller');
const { requireWorkspace } = require('../../middlewares/workspace.middleware');

// Twilio webhooks (no auth - Twilio signs these requests)
router.post('/voice/incoming', callcenterController.handleIncomingCall);
router.post('/voice/status', callcenterController.handleStatusCallback);
router.post('/voice/recording', callcenterController.handleRecordingCallback);
router.post('/voice/outbound', (req, res) => {
    // Connect outbound calls to client
    const twilio = require('twilio');
    const response = new twilio.twiml.VoiceResponse();
    response.dial().number(req.body.To);
    res.type('text/xml').send(response.toString());
});

// Protected routes
router.use(requireWorkspace);

// Settings
router.get('/settings', callcenterController.getSettings);
router.post('/settings/credentials', callcenterController.saveCredentials);
router.patch('/settings', callcenterController.updateSettings);

// Numbers
router.get('/numbers', callcenterController.getNumbers);
router.get('/numbers/search', callcenterController.searchNumbers);
router.post('/numbers/purchase', callcenterController.purchaseNumber);
router.delete('/numbers/:numberId', callcenterController.releaseNumber);

// Calls
router.get('/calls', callcenterController.getCalls);
router.post('/calls', callcenterController.makeCall);

// Token for WebRTC softphone
router.get('/token', callcenterController.getAccessToken);

module.exports = router;
