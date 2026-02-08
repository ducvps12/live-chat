const { connectMySQL, getPool } = require('../infra/mysql/mysql');
const constants = require('../config/constants');

// Extended default roles beyond just Owner
const DEFAULT_ROLES = {
    'Admin': constants.ADMIN_DEFAULT_PERMISSIONS,
    'Agent': constants.AGENT_DEFAULT_PERMISSIONS,
};

async function fixDefaultRoles() {
    try {
        console.log('Connecting to database...');
        await connectMySQL();
        const pool = getPool();

        console.log('Fetching all workspaces...');
        const [workspaces] = await pool.execute('SELECT WorkspaceKey, Name FROM iam_Workspaces WHERE Status = 1');

        console.log(`Found ${workspaces.length} workspaces.`);

        for (const ws of workspaces) {
            console.log(`Processing workspace: ${ws.Name} (${ws.WorkspaceKey})`);
            const conn = await pool.getConnection();

            try {
                await conn.beginTransaction();

                for (const [roleName, permissions] of Object.entries(DEFAULT_ROLES)) {
                    let roleKey;
                    const [roleRows] = await conn.execute(
                        'SELECT RoleKey FROM iam_Roles WHERE WorkspaceKey = ? AND Name = ?',
                        [ws.WorkspaceKey, roleName]
                    );

                    if (roleRows.length > 0) {
                        roleKey = roleRows[0].RoleKey;
                    } else {
                        console.log(`  Creating role '${roleName}'...`);
                        const [createRes] = await conn.execute(
                            'INSERT INTO iam_Roles (WorkspaceKey, Name) VALUES (?, ?)',
                            [ws.WorkspaceKey, roleName]
                        );
                        roleKey = createRes.insertId;
                    }

                    if (permissions && permissions.length > 0) {
                        const placeholders = permissions.map(() => '?').join(',');

                        await conn.execute(`
                            INSERT INTO iam_RolePermissionGrants (RoleKey, PermissionKey, Effect)
                            SELECT ?, p.PermissionKey, 1
                            FROM iam_Permissions p
                            WHERE p.Code IN (${placeholders})
                            AND NOT EXISTS (
                                SELECT 1 FROM iam_RolePermissionGrants g
                                WHERE g.RoleKey = ? AND g.PermissionKey = p.PermissionKey
                            )
                        `, [roleKey, ...permissions, roleKey]);
                    }
                }

                await conn.commit();
            } catch (wsErr) {
                console.error(`  Failed to process workspace ${ws.Name}:`, wsErr);
                await conn.rollback();
            } finally {
                conn.release();
            }
        }

        console.log('Fix complete.');
    } catch (err) {
        console.error('Failed to fix default roles:', err);
    } finally {
        process.exit(0);
    }
}

fixDefaultRoles();
