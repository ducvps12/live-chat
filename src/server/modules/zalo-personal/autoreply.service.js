/**
 * Auto-Reply Rules Service
 * Keyword-based automatic replies for Zalo messages
 */

const { getPool } = require('../../infra/mysql/mysql');

/**
 * Get all auto-reply rules for a workspace
 */
const getRules = async (workspaceId, activeOnly = true) => {
    const pool = getPool();

    let query = `
        SELECT 
            r.RuleId as id,
            r.Name as name,
            r.Keywords as keywords,
            r.MatchType as matchType,
            r.ReplyContent as replyContent,
            r.Channels as channels,
            r.IsActive as isActive,
            r.Priority as priority,
            r.TriggerCount as triggerCount,
            r.CreatedAt as createdAt
        FROM iam_AutoReplyRules r
        INNER JOIN iam_Workspaces w ON r.WorkspaceKey = w.WorkspaceKey
        WHERE w.WorkspaceId = ?
    `;

    const params = [workspaceId];

    if (activeOnly) {
        query += ` AND r.IsActive = 1`;
    }

    query += ` ORDER BY r.Priority DESC, r.TriggerCount DESC`;

    const [rows] = await pool.execute(query, params);
    return rows;
};

/**
 * Find matching rule for a message
 */
const findMatchingRule = async (workspaceId, messageContent, channel = 'all') => {
    const rules = await getRules(workspaceId, true);

    const normalizedMessage = messageContent.toLowerCase().trim();

    for (const rule of rules) {
        if (rule.channels !== 'all' && !rule.channels.includes(channel)) {
            continue;
        }

        const keywords = rule.keywords.split(',').map(k => k.trim().toLowerCase());

        let isMatch = false;

        switch (rule.matchType) {
            case 'exact':
                isMatch = keywords.some(kw => normalizedMessage === kw);
                break;

            case 'contains':
                isMatch = keywords.some(kw => normalizedMessage.includes(kw));
                break;

            case 'regex':
                try {
                    isMatch = keywords.some(kw => new RegExp(kw, 'i').test(messageContent));
                } catch (e) {
                    console.warn('[AutoReply] Invalid regex');
                }
                break;

            default:
                isMatch = keywords.some(kw => normalizedMessage.includes(kw));
        }

        if (isMatch) {
            const pool = getPool();
            await pool.execute(
                'UPDATE iam_AutoReplyRules SET TriggerCount = TriggerCount + 1 WHERE RuleId = ?',
                [rule.id]
            );

            return rule;
        }
    }

    return null;
};

/**
 * Create a new auto-reply rule
 */
const createRule = async (workspaceId, ruleData, userKey = null) => {
    const pool = getPool();
    const { name, keywords, matchType = 'contains', replyContent, channels = 'all', priority = 0 } = ruleData;

    const [wsRows] = await pool.execute(
        'SELECT WorkspaceKey FROM iam_Workspaces WHERE WorkspaceId = ?',
        [workspaceId]
    );

    if (!wsRows[0]) {
        throw new Error('Workspace not found');
    }

    const workspaceKey = wsRows[0].WorkspaceKey;

    const [result] = await pool.execute(
        `INSERT INTO iam_AutoReplyRules 
        (WorkspaceKey, Name, Keywords, MatchType, ReplyContent, Channels, Priority, CreatedByUserKey)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [workspaceKey, name, keywords, matchType, replyContent, channels, priority, userKey]
    );

    const [rows] = await pool.execute(
        'SELECT RuleId as id, Name as name, Keywords as keywords, MatchType as matchType, ReplyContent as replyContent FROM iam_AutoReplyRules WHERE RuleKey = ?',
        [result.insertId]
    );

    return rows[0];
};

/**
 * Update a rule
 */
const updateRule = async (ruleId, ruleData) => {
    const pool = getPool();
    const { name, keywords, matchType, replyContent, channels, priority, isActive } = ruleData;

    const updates = [];
    const params = [];

    if (name !== undefined) {
        updates.push('Name = ?');
        params.push(name);
    }
    if (keywords !== undefined) {
        updates.push('Keywords = ?');
        params.push(keywords);
    }
    if (matchType !== undefined) {
        updates.push('MatchType = ?');
        params.push(matchType);
    }
    if (replyContent !== undefined) {
        updates.push('ReplyContent = ?');
        params.push(replyContent);
    }
    if (channels !== undefined) {
        updates.push('Channels = ?');
        params.push(channels);
    }
    if (priority !== undefined) {
        updates.push('Priority = ?');
        params.push(priority);
    }
    if (isActive !== undefined) {
        updates.push('IsActive = ?');
        params.push(isActive);
    }

    if (updates.length === 0) {
        return null;
    }

    updates.push('UpdatedAt = UTC_TIMESTAMP(3)');
    params.push(ruleId);

    await pool.execute(
        `UPDATE iam_AutoReplyRules SET ${updates.join(', ')} WHERE RuleId = ?`,
        params
    );

    const [rows] = await pool.execute(
        'SELECT RuleId as id, Name as name, IsActive as isActive FROM iam_AutoReplyRules WHERE RuleId = ?',
        [ruleId]
    );

    return rows[0] || null;
};

/**
 * Delete a rule
 */
const deleteRule = async (ruleId) => {
    const pool = getPool();
    await pool.execute('DELETE FROM iam_AutoReplyRules WHERE RuleId = ?', [ruleId]);
    return true;
};

/**
 * Get default auto-reply rules
 */
const getDefaultRules = () => [
    {
        name: 'Chào hỏi',
        keywords: 'xin chào,hello,hi,chào,alo',
        matchType: 'contains',
        replyContent: 'Xin chào! Cảm ơn bạn đã liên hệ. Nhân viên sẽ hỗ trợ bạn ngay ạ! 👋',
        priority: 10
    },
    {
        name: 'Hỏi giá',
        keywords: 'giá,bao nhiêu,price,chi phí,báo giá',
        matchType: 'contains',
        replyContent: 'Cảm ơn bạn đã quan tâm! Để nhận báo giá chi tiết, vui lòng cho mình xin thông tin:\n- Sản phẩm/dịch vụ quan tâm\n- Số lượng cần mua\n\nNhân viên sẽ báo giá ngay ạ! 📋',
        priority: 8
    },
    {
        name: 'Offline',
        keywords: '',
        matchType: 'contains',
        replyContent: 'Hiện tại đang ngoài giờ làm việc. Chúng tôi sẽ phản hồi bạn vào giờ hành chính (8:00 - 22:00). Cảm ơn bạn đã chờ đợi! 🙏',
        priority: 0,
        isActive: false
    }
];

/**
 * Seed default rules for a workspace
 */
const seedDefaultRules = async (workspaceId, userKey = null) => {
    const defaults = getDefaultRules();
    const results = [];

    for (const rule of defaults) {
        if (!rule.keywords) continue;

        try {
            const created = await createRule(workspaceId, rule, userKey);
            results.push(created);
        } catch (err) {
            console.warn(`[AutoReply] Could not seed rule ${rule.name}:`, err.message);
        }
    }

    return results;
};

module.exports = {
    getRules,
    findMatchingRule,
    createRule,
    updateRule,
    deleteRule,
    seedDefaultRules,
    getDefaultRules
};
