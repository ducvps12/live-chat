const twilio = require('twilio');
const callcenterRepo = require('./repos/callcenter.repo');
const env = require('../../config/env');

const NUMBER_STATUS = {
    ACTIVE: 1,
    SUSPENDED: 2,
    RELEASED: 3
};

// ==================== TWILIO CLIENT ====================

/**
 * Get Twilio client for a workspace
 */
const getTwilioClient = async (workspaceKey) => {
    const settings = await callcenterRepo.getSettings(workspaceKey);
    if (!settings || !settings.TwilioAccountSid || !settings.TwilioAuthToken) {
        throw new Error('Chưa cấu hình Twilio');
    }
    return twilio(settings.TwilioAccountSid, settings.TwilioAuthToken);
};

// ==================== SETTINGS ====================

/**
 * Get call center settings
 */
const getSettings = async (workspaceKey) => {
    const settings = await callcenterRepo.getSettings(workspaceKey);
    if (!settings) {
        return {
            configured: false,
            twilioAccountSid: null,
            recordCalls: false,
            transcribeCalls: false,
            welcomeMessage: null,
            workingHours: null
        };
    }
    return {
        configured: true,
        twilioAccountSid: settings.TwilioAccountSid ? '••••' + settings.TwilioAccountSid.slice(-4) : null,
        recordCalls: settings.RecordCalls,
        transcribeCalls: settings.TranscribeCalls,
        maxQueueTime: settings.MaxQueueTime,
        welcomeMessage: settings.WelcomeMessage,
        holdMusicUrl: settings.HoldMusicUrl,
        workingHours: JSON.parse(settings.WorkingHours || '{}'),
        outOfHoursMessage: settings.OutOfHoursMessage
    };
};

/**
 * Save Twilio credentials
 */
const saveCredentials = async (workspaceKey, accountSid, authToken) => {
    // Validate credentials
    try {
        const client = twilio(accountSid, authToken);
        await client.api.accounts(accountSid).fetch();
    } catch (error) {
        throw new Error('Thông tin Twilio không hợp lệ');
    }

    await callcenterRepo.upsertSettings(workspaceKey, {
        twilioAccountSid: accountSid,
        twilioAuthToken: authToken
    });

    return { success: true };
};

/**
 * Update general settings
 */
const updateSettings = async (workspaceKey, data) => {
    await callcenterRepo.upsertSettings(workspaceKey, data);
    return await getSettings(workspaceKey);
};

// ==================== NUMBERS ====================

/**
 * Search available phone numbers to purchase
 */
const searchAvailableNumbers = async (workspaceKey, countryCode = 'VN', type = 'local') => {
    const client = await getTwilioClient(workspaceKey);

    const params = {
        voiceEnabled: true,
        limit: 20
    };

    let numbers;
    if (type === 'tollfree') {
        numbers = await client.availablePhoneNumbers(countryCode).tollFree.list(params);
    } else if (type === 'mobile') {
        numbers = await client.availablePhoneNumbers(countryCode).mobile.list(params);
    } else {
        numbers = await client.availablePhoneNumbers(countryCode).local.list(params);
    }

    return numbers.map(n => ({
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
        locality: n.locality,
        region: n.region,
        capabilities: n.capabilities,
        monthlyPrice: n.monthlyRecurringCost?.amount || 'N/A'
    }));
};

/**
 * Purchase and provision a phone number
 */
const purchaseNumber = async (workspaceKey, phoneNumber, friendlyName) => {
    const client = await getTwilioClient(workspaceKey);

    // Get webhook base URL
    const baseUrl = env.PUBLIC_URL || 'https://your-domain.com';

    // Buy the number
    const purchased = await client.incomingPhoneNumbers.create({
        phoneNumber,
        friendlyName: friendlyName || `LiveChat - ${phoneNumber}`,
        voiceUrl: `${baseUrl}/api/callcenter/voice/incoming`,
        voiceMethod: 'POST',
        statusCallback: `${baseUrl}/api/callcenter/voice/status`,
        statusCallbackMethod: 'POST',
        smsUrl: `${baseUrl}/api/callcenter/sms/incoming`,
        smsMethod: 'POST'
    });

    // Save to database
    const number = await callcenterRepo.insertNumber(workspaceKey, {
        phoneNumber: purchased.phoneNumber,
        friendlyName: friendlyName || purchased.friendlyName,
        providerNumberSid: purchased.sid,
        capabilities: purchased.capabilities
    });

    return formatNumber(number);
};

/**
 * Get provisioned numbers for workspace
 */
const getNumbers = async (workspaceKey) => {
    const numbers = await callcenterRepo.findNumbersByWorkspace(workspaceKey);
    return numbers.map(formatNumber);
};

/**
 * Format number for API response
 */
const formatNumber = (number) => ({
    numberId: number.NumberId,
    numberKey: number.NumberKey,
    phoneNumber: number.PhoneNumber,
    friendlyName: number.FriendlyName,
    provider: number.Provider,
    capabilities: JSON.parse(number.Capabilities || '{}'),
    status: number.Status,
    statusText: getNumberStatusText(number.Status),
    createdAt: number.CreatedAt
});

const getNumberStatusText = (status) => {
    switch (status) {
        case NUMBER_STATUS.ACTIVE: return 'Hoạt động';
        case NUMBER_STATUS.SUSPENDED: return 'Tạm dừng';
        case NUMBER_STATUS.RELEASED: return 'Đã hủy';
        default: return 'Không xác định';
    }
};

/**
 * Release a phone number
 */
const releaseNumber = async (workspaceKey, numberId) => {
    const number = await callcenterRepo.findNumberById(numberId);
    if (!number || number.WorkspaceKey !== workspaceKey) {
        throw new Error('Số điện thoại không tồn tại');
    }

    const client = await getTwilioClient(workspaceKey);
    await client.incomingPhoneNumbers(number.ProviderNumberSid).remove();

    await callcenterRepo.deleteNumber(number.NumberKey);
};

// ==================== CALLS ====================

/**
 * Get call history
 */
const getCalls = async (workspaceKey, limit = 50, offset = 0) => {
    const calls = await callcenterRepo.findCallsByWorkspace(workspaceKey, limit, offset);
    return calls.map(formatCall);
};

const formatCall = (call) => ({
    callId: call.CallId,
    direction: call.Direction,
    fromNumber: call.FromNumber,
    toNumber: call.ToNumber,
    callerName: call.CallerName,
    status: call.Status,
    duration: call.Duration,
    recordingUrl: call.RecordingUrl,
    lineNumber: call.LineNumber,
    lineName: call.LineName,
    startedAt: call.StartedAt,
    endedAt: call.EndedAt,
    createdAt: call.CreatedAt
});

/**
 * Handle incoming call webhook
 */
const handleIncomingCall = async (body) => {
    const { To, From, CallSid, CallerName } = body;

    // Find the number in our system
    const number = await callcenterRepo.findNumberByPhone(To);
    if (!number) {
        console.warn(`[CallCenter] Incoming call to unknown number: ${To}`);
        const response = new twilio.twiml.VoiceResponse();
        response.say('Sorry, this number is not configured.');
        response.hangup();
        return response.toString();
    }

    // Create call record
    await callcenterRepo.insertCall({
        workspaceKey: number.WorkspaceKey,
        numberKey: number.NumberKey,
        providerCallSid: CallSid,
        direction: 'inbound',
        fromNumber: From,
        toNumber: To,
        callerName: CallerName,
        status: 'ringing'
    });

    // Get workspace settings
    const settings = await callcenterRepo.getSettings(number.WorkspaceKey);

    // Generate TwiML response
    const response = new twilio.twiml.VoiceResponse();

    // Welcome message
    if (settings?.WelcomeMessage) {
        response.say({ language: 'vi-VN' }, settings.WelcomeMessage);
    }

    // Queue the call (agents will answer via softphone)
    const dial = response.dial({
        callerId: To,
        record: settings?.RecordCalls ? 'record-from-answer' : 'do-not-record',
        recordingStatusCallback: `${env.PUBLIC_URL}/api/callcenter/voice/recording`,
        timeout: settings?.MaxQueueTime || 30
    });

    // Connect to client (WebRTC softphone)
    dial.client('workspace-' + number.WorkspaceKey);

    return response.toString();
};

/**
 * Handle call status update webhook
 */
const handleStatusCallback = async (body) => {
    const { CallSid, CallStatus, CallDuration, RecordingUrl, RecordingSid } = body;

    const call = await callcenterRepo.findCallByProviderSid(CallSid);
    if (!call) {
        console.warn(`[CallCenter] Status callback for unknown call: ${CallSid}`);
        return;
    }

    await callcenterRepo.updateCallStatus(call.CallKey, CallStatus, {
        duration: parseInt(CallDuration) || null,
        recordingUrl: RecordingUrl,
        recordingSid: RecordingSid
    });
};

/**
 * Make outbound call
 */
const makeCall = async (workspaceKey, fromNumberId, toNumber) => {
    const number = await callcenterRepo.findNumberById(fromNumberId);
    if (!number || number.WorkspaceKey !== workspaceKey) {
        throw new Error('Số điện thoại không tồn tại');
    }

    const client = await getTwilioClient(workspaceKey);
    const settings = await callcenterRepo.getSettings(workspaceKey);

    const call = await client.calls.create({
        to: toNumber,
        from: number.PhoneNumber,
        url: `${env.PUBLIC_URL}/api/callcenter/voice/outbound`,
        statusCallback: `${env.PUBLIC_URL}/api/callcenter/voice/status`,
        record: settings?.RecordCalls
    });

    const record = await callcenterRepo.insertCall({
        workspaceKey,
        numberKey: number.NumberKey,
        providerCallSid: call.sid,
        direction: 'outbound',
        fromNumber: number.PhoneNumber,
        toNumber,
        status: 'queued'
    });

    return formatCall(record);
};

/**
 * Generate access token for WebRTC softphone
 */
const generateAccessToken = async (workspaceKey, identity) => {
    const settings = await callcenterRepo.getSettings(workspaceKey);
    if (!settings) {
        throw new Error('Call center chưa được cấu hình');
    }

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(
        settings.TwilioAccountSid,
        settings.TwilioApiKeySid || settings.TwilioAccountSid,
        settings.TwilioApiKeySecret || settings.TwilioAuthToken,
        { identity }
    );

    const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: env.TWILIO_TWIML_APP_SID,
        incomingAllow: true
    });

    token.addGrant(voiceGrant);

    return token.toJwt();
};

module.exports = {
    NUMBER_STATUS,
    // Settings
    getSettings,
    saveCredentials,
    updateSettings,
    // Numbers
    searchAvailableNumbers,
    purchaseNumber,
    getNumbers,
    releaseNumber,
    // Calls
    getCalls,
    makeCall,
    // Webhooks
    handleIncomingCall,
    handleStatusCallback,
    // Token
    generateAccessToken
};
