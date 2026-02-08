/**
 * Lead Management Service
 * Handle lead stages, scoring, and CRM automation
 */

const { getPool } = require('../../infra/mysql/mysql');

// Lead stage definitions
const LEAD_STAGES = {
    POTENTIAL: 'potential',
    TRIAL: 'trial',
    QUALIFIED: 'qualified',
    OPPORTUNITY: 'opportunity',
    CUSTOMER: 'customer',
    CHURNED: 'churned'
};

const LEAD_STAGE_LABELS = {
    potential: 'Tiềm năng',
    trial: 'Dùng thử',
    qualified: 'Chất lượng',
    opportunity: 'Cơ hội',
    customer: 'Khách hàng',
    churned: 'Đã mất'
};

const LEAD_STAGE_COLORS = {
    potential: '#6B7280',
    trial: '#3B82F6',
    qualified: '#8B5CF6',
    opportunity: '#F59E0B',
    customer: '#10B981',
    churned: '#EF4444'
};

/**
 * Update lead stage for a conversation
 */
const updateLeadStage = async (conversationId, newStage, userKey = null, note = null) => {
    const pool = getPool();

    if (!Object.values(LEAD_STAGES).includes(newStage)) {
        throw new Error(`Invalid stage: ${newStage}`);
    }

    const [currentRows] = await pool.execute(
        'SELECT ConversationKey, LeadStage FROM iam_WidgetConversations WHERE ConversationId = ?',
        [conversationId]
    );

    if (!currentRows[0]) {
        throw new Error('Conversation not found');
    }

    const { ConversationKey, LeadStage: oldStage } = currentRows[0];

    await pool.execute(
        'UPDATE iam_WidgetConversations SET LeadStage = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE ConversationId = ?',
        [newStage, conversationId]
    );

    await pool.execute(
        `INSERT INTO iam_LeadStageHistory 
        (ConversationKey, FromStage, ToStage, ChangedByUserKey, Note)
        VALUES (?, ?, ?, ?, ?)`,
        [ConversationKey, oldStage, newStage, userKey, note]
    );

    return {
        conversationId,
        fromStage: oldStage,
        toStage: newStage,
        stageLabel: LEAD_STAGE_LABELS[newStage]
    };
};

/**
 * Update lead score
 */
const updateLeadScore = async (conversationId, scoreDelta) => {
    const pool = getPool();

    await pool.execute(
        'UPDATE iam_WidgetConversations SET LeadScore = LeadScore + ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE ConversationId = ?',
        [scoreDelta, conversationId]
    );

    const [rows] = await pool.execute(
        'SELECT LeadScore as newScore FROM iam_WidgetConversations WHERE ConversationId = ?',
        [conversationId]
    );

    return rows[0]?.newScore || 0;
};

/**
 * Get lead stage history
 */
const getStageHistory = async (conversationId) => {
    const pool = getPool();

    const [rows] = await pool.execute(
        `SELECT 
            h.FromStage as fromStage,
            h.ToStage as toStage,
            h.Note as note,
            h.CreatedAt as changedAt,
            u.DisplayName as changedBy
        FROM iam_LeadStageHistory h
        INNER JOIN iam_WidgetConversations c ON h.ConversationKey = c.ConversationKey
        LEFT JOIN iam_Users u ON h.ChangedByUserKey = u.UserKey
        WHERE c.ConversationId = ?
        ORDER BY h.CreatedAt DESC`,
        [conversationId]
    );

    return rows.map(row => ({
        ...row,
        fromStageLabel: LEAD_STAGE_LABELS[row.fromStage],
        toStageLabel: LEAD_STAGE_LABELS[row.toStage]
    }));
};

/**
 * Get lead statistics for a workspace
 */
const getLeadStats = async (workspaceId) => {
    const pool = getPool();

    const [rows] = await pool.execute(
        `SELECT 
            IFNULL(c.LeadStage, 'potential') as stage,
            COUNT(*) as count
        FROM iam_WidgetConversations c
        INNER JOIN iam_Widgets w ON c.WidgetKey = w.WidgetKey
        INNER JOIN iam_Workspaces ws ON w.WorkspaceKey = ws.WorkspaceKey
        WHERE ws.WorkspaceId = ?
        GROUP BY c.LeadStage`,
        [workspaceId]
    );

    const stats = {};
    Object.values(LEAD_STAGES).forEach(stage => {
        stats[stage] = {
            count: 0,
            label: LEAD_STAGE_LABELS[stage],
            color: LEAD_STAGE_COLORS[stage]
        };
    });

    rows.forEach(row => {
        if (stats[row.stage]) {
            stats[row.stage].count = row.count;
        }
    });

    return stats;
};

/**
 * Set follow-up reminder
 */
const setFollowUp = async (conversationId, followUpDate) => {
    const pool = getPool();

    await pool.execute(
        'UPDATE iam_WidgetConversations SET NextFollowUpAt = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE ConversationId = ?',
        [followUpDate, conversationId]
    );

    return { conversationId, nextFollowUpAt: followUpDate };
};

/**
 * Get conversations due for follow-up
 */
const getDueFollowUps = async (workspaceId) => {
    const pool = getPool();

    const [rows] = await pool.execute(
        `SELECT 
            c.ConversationId as id,
            c.VisitorName as visitorName,
            c.VisitorPhone as phone,
            c.LeadStage as stage,
            c.NextFollowUpAt as dueAt,
            c.LastMessagePreview as lastMessage
        FROM iam_WidgetConversations c
        INNER JOIN iam_Widgets w ON c.WidgetKey = w.WidgetKey
        INNER JOIN iam_Workspaces ws ON w.WorkspaceKey = ws.WorkspaceKey
        WHERE ws.WorkspaceId = ?
        AND c.NextFollowUpAt IS NOT NULL
        AND c.NextFollowUpAt <= DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 1 HOUR)
        ORDER BY c.NextFollowUpAt ASC`,
        [workspaceId]
    );

    return rows;
};

/**
 * Auto-score lead based on engagement
 */
const calculateLeadScore = (messageCount, hasPhone, hasEmail, responseTime) => {
    let score = 0;

    if (messageCount >= 10) score += 20;
    else if (messageCount >= 5) score += 10;
    else if (messageCount >= 2) score += 5;

    if (hasPhone) score += 30;
    if (hasEmail) score += 20;

    if (responseTime && responseTime < 5) score += 10;

    return Math.min(score, 100);
};

module.exports = {
    LEAD_STAGES,
    LEAD_STAGE_LABELS,
    LEAD_STAGE_COLORS,
    updateLeadStage,
    updateLeadScore,
    getStageHistory,
    getLeadStats,
    setFollowUp,
    getDueFollowUps,
    calculateLeadScore
};
