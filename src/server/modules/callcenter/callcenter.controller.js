const callcenterService = require('./callcenter.service');

// ==================== SETTINGS ====================

const getSettings = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const settings = await callcenterService.getSettings(workspaceKey);
        res.json({ success: true, settings });
    } catch (error) {
        console.error('[CallCenter] Get settings error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const saveCredentials = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const { accountSid, authToken } = req.body;

        if (!accountSid || !authToken) {
            return res.status(400).json({ success: false, error: 'Account SID và Auth Token bắt buộc' });
        }

        await callcenterService.saveCredentials(workspaceKey, accountSid, authToken);
        res.json({ success: true, message: 'Đã lưu thông tin Twilio' });
    } catch (error) {
        console.error('[CallCenter] Save credentials error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

const updateSettings = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const settings = await callcenterService.updateSettings(workspaceKey, req.body);
        res.json({ success: true, settings });
    } catch (error) {
        console.error('[CallCenter] Update settings error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

// ==================== NUMBERS ====================

const searchNumbers = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const { country = 'VN', type = 'local' } = req.query;

        const numbers = await callcenterService.searchAvailableNumbers(workspaceKey, country, type);
        res.json({ success: true, numbers });
    } catch (error) {
        console.error('[CallCenter] Search numbers error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

const purchaseNumber = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const { phoneNumber, friendlyName } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ success: false, error: 'Số điện thoại bắt buộc' });
        }

        const number = await callcenterService.purchaseNumber(workspaceKey, phoneNumber, friendlyName);
        res.json({ success: true, number });
    } catch (error) {
        console.error('[CallCenter] Purchase number error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

const getNumbers = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const numbers = await callcenterService.getNumbers(workspaceKey);
        res.json({ success: true, numbers });
    } catch (error) {
        console.error('[CallCenter] Get numbers error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const releaseNumber = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const { numberId } = req.params;

        await callcenterService.releaseNumber(workspaceKey, numberId);
        res.json({ success: true, message: 'Đã hủy số điện thoại' });
    } catch (error) {
        console.error('[CallCenter] Release number error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

// ==================== CALLS ====================

const getCalls = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const { limit = 50, offset = 0 } = req.query;

        const calls = await callcenterService.getCalls(workspaceKey, parseInt(limit), parseInt(offset));
        res.json({ success: true, calls });
    } catch (error) {
        console.error('[CallCenter] Get calls error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const makeCall = async (req, res) => {
    try {
        const { workspaceKey } = req.workspace;
        const { fromNumberId, toNumber } = req.body;

        if (!fromNumberId || !toNumber) {
            return res.status(400).json({ success: false, error: 'fromNumberId và toNumber bắt buộc' });
        }

        const call = await callcenterService.makeCall(workspaceKey, fromNumberId, toNumber);
        res.json({ success: true, call });
    } catch (error) {
        console.error('[CallCenter] Make call error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

// ==================== WEBHOOKS ====================

const handleIncomingCall = async (req, res) => {
    try {
        const twiml = await callcenterService.handleIncomingCall(req.body);
        res.type('text/xml').send(twiml);
    } catch (error) {
        console.error('[CallCenter] Incoming call error:', error);
        res.status(500).send('Error');
    }
};

const handleStatusCallback = async (req, res) => {
    try {
        await callcenterService.handleStatusCallback(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('[CallCenter] Status callback error:', error);
        res.sendStatus(200); // Always 200 to Twilio
    }
};

const handleRecordingCallback = async (req, res) => {
    // Recording callback is handled in status callback
    res.sendStatus(200);
};

// ==================== TOKEN ====================

const getAccessToken = async (req, res) => {
    try {
        const { workspaceKey, user } = req.workspace;
        const identity = `agent-${user.UserKey}`;

        const token = await callcenterService.generateAccessToken(workspaceKey, identity);
        res.json({ success: true, token, identity });
    } catch (error) {
        console.error('[CallCenter] Get token error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};

module.exports = {
    // Settings
    getSettings,
    saveCredentials,
    updateSettings,
    // Numbers
    searchNumbers,
    purchaseNumber,
    getNumbers,
    releaseNumber,
    // Calls
    getCalls,
    makeCall,
    // Webhooks
    handleIncomingCall,
    handleStatusCallback,
    handleRecordingCallback,
    // Token
    getAccessToken
};
