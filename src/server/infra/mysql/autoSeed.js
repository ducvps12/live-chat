/**
 * Auto-seed: Create tables and seed initial data on MySQL startup
 */
const { getPool } = require('./mysql');
const fs = require('fs');
const path = require('path');

const REQUIRED_PERMISSIONS = [
    { code: 'workspace.manage', resource: 'workspace', action: 'manage' },
    { code: 'member.invite', resource: 'member', action: 'invite' },
    { code: 'member.read', resource: 'member', action: 'read' },
    { code: 'member.remove', resource: 'member', action: 'remove' },
    { code: 'role.manage', resource: 'role', action: 'manage' },
    { code: 'role.read', resource: 'role', action: 'read' },
    { code: 'permission.read', resource: 'permission', action: 'read' },
    { code: 'widget.manage', resource: 'widget', action: 'manage' },
    { code: 'widget.read', resource: 'widget', action: 'read' },
    { code: 'conversation.read', resource: 'conversation', action: 'read' },
    { code: 'conversation.reply', resource: 'conversation', action: 'reply' },
    { code: 'conversation.assign', resource: 'conversation', action: 'assign' },
    { code: 'conversation.close', resource: 'conversation', action: 'close' },
    { code: 'conversation.note', resource: 'conversation', action: 'note' },
    { code: 'conversation.tag', resource: 'conversation', action: 'tag' },
    { code: 'contact.read', resource: 'contact', action: 'read' },
    { code: 'contact.create', resource: 'contact', action: 'create' },
    { code: 'contact.update', resource: 'contact', action: 'update' },
    { code: 'contact.merge', resource: 'contact', action: 'merge' },
    { code: 'report.view', resource: 'report', action: 'view' },
    { code: 'report.export', resource: 'report', action: 'export' },
    { code: 'audit.read', resource: 'audit', action: 'read' },
    { code: 'integration.manage', resource: 'integration', action: 'manage' },
    { code: 'billing.view', resource: 'billing', action: 'view' },
    { code: 'billing.manage', resource: 'billing', action: 'manage' },
];

/**
 * Run schema.sql to create all tables
 */
async function createTablesIfNeeded() {
    try {
        const pool = getPool();
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Split by semicolons and execute each statement
        const statements = schemaSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('SET'));

        for (const stmt of statements) {
            try {
                await pool.execute(stmt);
            } catch (err) {
                // Ignore "already exists" errors
                if (!err.message.includes('already exists')) {
                    console.warn('[Auto-seed] Table creation warning:', err.message.substring(0, 100));
                }
            }
        }
        console.log('[Auto-seed] Tables created/verified');
    } catch (err) {
        console.error('[Auto-seed] Failed to create tables:', err.message);
    }
}

/**
 * Seed permissions if not present
 */
async function seedPermissionsIfNeeded() {
    try {
        const pool = getPool();

        const [rows] = await pool.execute('SELECT COUNT(*) as cnt FROM iam_Permissions');
        const existingCount = rows[0].cnt;

        if (existingCount >= REQUIRED_PERMISSIONS.length) {
            console.log(`[Auto-seed] Permissions already seeded (${existingCount} found)`);
            return;
        }

        console.log(`[Auto-seed] Found ${existingCount} permissions, seeding ${REQUIRED_PERMISSIONS.length}...`);

        for (const perm of REQUIRED_PERMISSIONS) {
            await pool.execute(
                `INSERT IGNORE INTO iam_Permissions (Code, Resource, \`Action\`) VALUES (?, ?, ?)`,
                [perm.code, perm.resource, perm.action]
            );
        }

        console.log('[Auto-seed] Permissions seeded successfully');
    } catch (err) {
        console.error('[Auto-seed] Failed to seed permissions:', err.message);
    }
}

/**
 * Run all auto-seed operations
 */
async function runAutoSeed() {
    await createTablesIfNeeded();
    await seedPermissionsIfNeeded();
}

module.exports = { runAutoSeed, seedPermissionsIfNeeded, createTablesIfNeeded };
