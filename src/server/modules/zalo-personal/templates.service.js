/**
 * Message Templates Service
 * CRUD operations for message templates with shortcuts
 */

const { getPool } = require('../../infra/mysql/mysql');

/**
 * Get all templates for a workspace
 */
const getTemplates = async (workspaceId, options = {}) => {
    const pool = getPool();
    const { category, isActive = true } = options;

    let query = `
        SELECT 
            t.TemplateId as id,
            t.Name as name,
            t.Category as category,
            t.Content as content,
            t.Shortcut as shortcut,
            t.UsageCount as usageCount,
            t.IsActive as isActive,
            t.CreatedAt as createdAt,
            t.UpdatedAt as updatedAt
        FROM iam_MessageTemplates t
        INNER JOIN iam_Workspaces w ON t.WorkspaceKey = w.WorkspaceKey
        WHERE w.WorkspaceId = ?
    `;

    const params = [workspaceId];

    if (isActive !== undefined) {
        query += ` AND t.IsActive = ?`;
        params.push(isActive ? 1 : 0);
    }
    if (category) {
        query += ` AND t.Category = ?`;
        params.push(category);
    }

    query += ` ORDER BY t.UsageCount DESC, t.Name ASC`;

    const [rows] = await pool.execute(query, params);
    return rows;
};

/**
 * Get template by shortcut (for quick reply feature)
 */
const getTemplateByShortcut = async (workspaceId, shortcut) => {
    const pool = getPool();

    const [rows] = await pool.execute(
        `SELECT 
            t.TemplateId as id,
            t.Content as content,
            t.Name as name
        FROM iam_MessageTemplates t
        INNER JOIN iam_Workspaces w ON t.WorkspaceKey = w.WorkspaceKey
        WHERE w.WorkspaceId = ? 
        AND LOWER(t.Shortcut) = ?
        AND t.IsActive = 1`,
        [workspaceId, shortcut.toLowerCase()]
    );

    if (rows[0]) {
        // Increment usage count
        await pool.execute(
            `UPDATE iam_MessageTemplates t
             INNER JOIN iam_Workspaces w ON t.WorkspaceKey = w.WorkspaceKey
             SET t.UsageCount = t.UsageCount + 1
             WHERE w.WorkspaceId = ? AND LOWER(t.Shortcut) = ?`,
            [workspaceId, shortcut.toLowerCase()]
        );
    }

    return rows[0] || null;
};

/**
 * Create a new template
 */
const createTemplate = async (workspaceId, templateData, userKey = null) => {
    const pool = getPool();
    const { name, category = 'general', content, shortcut } = templateData;

    const [wsRows] = await pool.execute(
        'SELECT WorkspaceKey FROM iam_Workspaces WHERE WorkspaceId = ?',
        [workspaceId]
    );

    if (!wsRows[0]) {
        throw new Error('Workspace not found');
    }

    const workspaceKey = wsRows[0].WorkspaceKey;

    const [result] = await pool.execute(
        `INSERT INTO iam_MessageTemplates 
        (WorkspaceKey, Name, Category, Content, Shortcut, CreatedByUserKey)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [workspaceKey, name, category, content, shortcut ? shortcut.toLowerCase() : null, userKey]
    );

    const [rows] = await pool.execute(
        'SELECT TemplateId as id, Name as name, Category as category, Content as content, Shortcut as shortcut FROM iam_MessageTemplates WHERE TemplateKey = ?',
        [result.insertId]
    );

    return rows[0];
};

/**
 * Update a template
 */
const updateTemplate = async (templateId, templateData) => {
    const pool = getPool();
    const { name, category, content, shortcut, isActive } = templateData;

    const updates = [];
    const params = [];

    if (name !== undefined) {
        updates.push('Name = ?');
        params.push(name);
    }
    if (category !== undefined) {
        updates.push('Category = ?');
        params.push(category);
    }
    if (content !== undefined) {
        updates.push('Content = ?');
        params.push(content);
    }
    if (shortcut !== undefined) {
        updates.push('Shortcut = ?');
        params.push(shortcut ? shortcut.toLowerCase() : null);
    }
    if (isActive !== undefined) {
        updates.push('IsActive = ?');
        params.push(isActive);
    }

    if (updates.length === 0) {
        return null;
    }

    updates.push('UpdatedAt = UTC_TIMESTAMP(3)');
    params.push(templateId);

    await pool.execute(
        `UPDATE iam_MessageTemplates SET ${updates.join(', ')} WHERE TemplateId = ?`,
        params
    );

    const [rows] = await pool.execute(
        'SELECT TemplateId as id, Name as name, Category as category, Content as content, Shortcut as shortcut, IsActive as isActive FROM iam_MessageTemplates WHERE TemplateId = ?',
        [templateId]
    );

    return rows[0] || null;
};

/**
 * Delete a template
 */
const deleteTemplate = async (templateId) => {
    const pool = getPool();
    await pool.execute('DELETE FROM iam_MessageTemplates WHERE TemplateId = ?', [templateId]);
    return true;
};

/**
 * Search templates by content (for suggestions)
 */
const searchTemplates = async (workspaceId, searchTerm) => {
    const pool = getPool();

    const [rows] = await pool.execute(
        `SELECT 
            t.TemplateId as id,
            t.Name as name,
            t.Content as content,
            t.Shortcut as shortcut,
            t.Category as category
        FROM iam_MessageTemplates t
        INNER JOIN iam_Workspaces w ON t.WorkspaceKey = w.WorkspaceKey
        WHERE w.WorkspaceId = ? 
        AND t.IsActive = 1
        AND (t.Name LIKE ? OR t.Content LIKE ? OR t.Shortcut LIKE ?)
        ORDER BY t.UsageCount DESC
        LIMIT 5`,
        [workspaceId, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
    );

    return rows;
};

/**
 * Get default templates (seed data)
 */
const getDefaultTemplates = () => [
    {
        name: 'Chào khách',
        category: 'greeting',
        content: 'Xin chào! Em có thể giúp gì cho anh/chị ạ? 😊',
        shortcut: '/hi'
    },
    {
        name: 'Cảm ơn',
        category: 'closing',
        content: 'Cảm ơn anh/chị đã liên hệ! Chúc anh/chị một ngày tốt lành! 🙏',
        shortcut: '/thanks'
    },
    {
        name: 'Xin SĐT',
        category: 'support',
        content: 'Anh/chị vui lòng cho em xin số điện thoại để nhân viên liên hệ tư vấn chi tiết hơn ạ!',
        shortcut: '/phone'
    },
    {
        name: 'Đang xử lý',
        category: 'support',
        content: 'Dạ em đã ghi nhận yêu cầu của anh/chị. Em sẽ kiểm tra và phản hồi sớm nhất có thể ạ!',
        shortcut: '/wait'
    },
    {
        name: 'Hẹn gọi lại',
        category: 'support',
        content: 'Nhân viên sẽ liên hệ lại với anh/chị trong vòng 15 phút ạ. Cảm ơn anh/chị đã chờ đợi!',
        shortcut: '/callback'
    }
];

/**
 * Seed default templates for a workspace
 */
const seedDefaultTemplates = async (workspaceId, userKey = null) => {
    const defaults = getDefaultTemplates();
    const results = [];

    for (const template of defaults) {
        try {
            const created = await createTemplate(workspaceId, template, userKey);
            results.push(created);
        } catch (err) {
            console.warn(`[Templates] Could not seed template ${template.name}:`, err.message);
        }
    }

    return results;
};

module.exports = {
    getTemplates,
    getTemplateByShortcut,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    searchTemplates,
    seedDefaultTemplates,
    getDefaultTemplates
};
