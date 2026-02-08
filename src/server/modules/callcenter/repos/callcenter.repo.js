const { getPool } = require('../../../infra/mysql/mysql');

// ==================== NUMBERS ====================

const insertNumber = async (workspaceKey, data) => {
    const pool = getPool();
    const [result] = await pool.execute(
        `INSERT INTO channels_CallCenterNumbers (WorkspaceKey, PhoneNumber, FriendlyName, Provider, ProviderNumberSid, Capabilities, Settings)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [workspaceKey, data.phoneNumber, data.friendlyName || null, data.provider || 'twilio',
            data.providerNumberSid, JSON.stringify(data.capabilities || {}), JSON.stringify(data.settings || {})]
    );
    const [rows] = await pool.execute(
        'SELECT NumberKey, NumberId, PhoneNumber, FriendlyName, Status, CreatedAt FROM channels_CallCenterNumbers WHERE NumberKey = ?',
        [result.insertId]
    );
    return rows[0];
};

const findNumbersByWorkspace = async (workspaceKey) => {
    const [rows] = await getPool().execute(
        `SELECT NumberKey, NumberId, PhoneNumber, FriendlyName, Provider, ProviderNumberSid,
            Capabilities, Status, Settings, CreatedAt, UpdatedAt
     FROM channels_CallCenterNumbers WHERE WorkspaceKey = ? ORDER BY CreatedAt DESC`,
        [workspaceKey]
    );
    return rows;
};

const findNumberById = async (numberId) => {
    const [rows] = await getPool().execute(
        `SELECT NumberKey, NumberId, WorkspaceKey, PhoneNumber, FriendlyName, Provider,
            ProviderNumberSid, Capabilities, Status, Settings, CreatedAt
     FROM channels_CallCenterNumbers WHERE NumberId = ?`,
        [numberId]
    );
    return rows[0] || null;
};

const findNumberByPhone = async (phoneNumber) => {
    const [rows] = await getPool().execute(
        `SELECT NumberKey, NumberId, WorkspaceKey, PhoneNumber, ProviderNumberSid, Status
     FROM channels_CallCenterNumbers WHERE PhoneNumber = ?`,
        [phoneNumber]
    );
    return rows[0] || null;
};

const deleteNumber = async (numberKey) => {
    await getPool().execute('DELETE FROM channels_CallCenterNumbers WHERE NumberKey = ?', [numberKey]);
};

// ==================== CALLS ====================

const insertCall = async (data) => {
    const pool = getPool();
    const [result] = await pool.execute(
        `INSERT INTO channels_Calls (WorkspaceKey, NumberKey, ProviderCallSid, Direction, FromNumber, ToNumber, CallerName, Status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.workspaceKey, data.numberKey, data.providerCallSid || null, data.direction,
        data.fromNumber, data.toNumber, data.callerName || null, data.status || 'queued']
    );
    const [rows] = await pool.execute(
        'SELECT CallKey, CallId, Direction, FromNumber, ToNumber, Status, CreatedAt FROM channels_Calls WHERE CallKey = ?',
        [result.insertId]
    );
    return rows[0];
};

const findCallsByWorkspace = async (workspaceKey, limit = 50, offset = 0) => {
    const [rows] = await getPool().execute(
        `SELECT c.CallKey, c.CallId, c.Direction, c.FromNumber, c.ToNumber, c.CallerName,
            c.Status, c.Duration, c.RecordingUrl, c.StartedAt, c.EndedAt, c.CreatedAt,
            n.PhoneNumber as LineNumber, n.FriendlyName as LineName
     FROM channels_Calls c
     JOIN channels_CallCenterNumbers n ON c.NumberKey = n.NumberKey
     WHERE c.WorkspaceKey = ? ORDER BY c.CreatedAt DESC LIMIT ? OFFSET ?`,
        [workspaceKey, limit, offset]
    );
    return rows;
};

const findCallByProviderSid = async (providerCallSid) => {
    const [rows] = await getPool().execute(
        `SELECT CallKey, CallId, WorkspaceKey, NumberKey, Direction, FromNumber, ToNumber, Status
     FROM channels_Calls WHERE ProviderCallSid = ?`,
        [providerCallSid]
    );
    return rows[0] || null;
};

const updateCallStatus = async (callKey, status, extras = {}) => {
    const updates = ['Status = ?'];
    const params = [status];

    if (extras.duration !== undefined) { updates.push('Duration = ?'); params.push(extras.duration); }
    if (extras.recordingUrl) { updates.push('RecordingUrl = ?'); params.push(extras.recordingUrl); }
    if (extras.recordingSid) { updates.push('RecordingSid = ?'); params.push(extras.recordingSid); }
    if (status === 'in-progress' && !extras.answeredAt) { updates.push('AnsweredAt = UTC_TIMESTAMP(3)'); }
    if (['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(status)) { updates.push('EndedAt = UTC_TIMESTAMP(3)'); }
    params.push(callKey);

    await getPool().execute(`UPDATE channels_Calls SET ${updates.join(', ')} WHERE CallKey = ?`, params);
};

// ==================== SETTINGS ====================

const getSettings = async (workspaceKey) => {
    const [rows] = await getPool().execute(
        `SELECT TwilioAccountSid, TwilioAuthToken, TwilioApiKeySid, TwilioApiKeySecret,
            RecordCalls, TranscribeCalls, MaxQueueTime, WelcomeMessage, HoldMusicUrl,
            WorkingHours, OutOfHoursMessage, CreatedAt, UpdatedAt
     FROM channels_CallCenterSettings WHERE WorkspaceKey = ?`,
        [workspaceKey]
    );
    return rows[0] || null;
};

const upsertSettings = async (workspaceKey, data) => {
    const existing = await getSettings(workspaceKey);

    if (existing) {
        const updates = [];
        const params = [];

        if (data.twilioAccountSid !== undefined) { updates.push('TwilioAccountSid = ?'); params.push(data.twilioAccountSid); }
        if (data.twilioAuthToken !== undefined) { updates.push('TwilioAuthToken = ?'); params.push(data.twilioAuthToken); }
        if (data.recordCalls !== undefined) { updates.push('RecordCalls = ?'); params.push(data.recordCalls ? 1 : 0); }
        if (data.welcomeMessage !== undefined) { updates.push('WelcomeMessage = ?'); params.push(data.welcomeMessage); }
        if (data.workingHours !== undefined) { updates.push('WorkingHours = ?'); params.push(JSON.stringify(data.workingHours)); }
        updates.push('UpdatedAt = UTC_TIMESTAMP(3)');
        params.push(workspaceKey);
        await getPool().execute(`UPDATE channels_CallCenterSettings SET ${updates.join(', ')} WHERE WorkspaceKey = ?`, params);
    } else {
        await getPool().execute(
            `INSERT INTO channels_CallCenterSettings (WorkspaceKey, TwilioAccountSid, TwilioAuthToken, RecordCalls, WelcomeMessage)
       VALUES (?, ?, ?, ?, ?)`,
            [workspaceKey, data.twilioAccountSid || null, data.twilioAuthToken || null, data.recordCalls ? 1 : 0, data.welcomeMessage || null]
        );
    }
    return await getSettings(workspaceKey);
};

module.exports = {
    insertNumber, findNumbersByWorkspace, findNumberById, findNumberByPhone, deleteNumber,
    insertCall, findCallsByWorkspace, findCallByProviderSid, updateCallStatus,
    getSettings, upsertSettings
};
