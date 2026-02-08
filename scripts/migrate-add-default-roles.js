/**
 * Migration script to add default roles (Admin, Agent) to existing workspaces
 * Run: node scripts/migrate-add-default-roles.js
 */

const { getPool, sql } = require('../src/infra/sql/pool');
const constants = require('../src/config/constants');
require('dotenv').config();

async function migrateWorkspaceRoles() {
    const pool = getPool();

    try {
        console.log('Starting migration: Add default roles to workspaces...\n');

        // Get all active workspaces
        const workspacesResult = await pool.request()
            .query('SELECT WorkspaceKey, WorkspaceId, Name FROM iam.Workspaces WHERE Status = 1');

        const workspaces = workspacesResult.recordset;
        console.log(`Found ${workspaces.length} active workspaces\n`);

        for (const workspace of workspaces) {
            console.log(`Processing workspace: ${workspace.Name} (${workspace.WorkspaceId})`);

            // Check if Admin role exists
            const adminCheck = await pool.request()
                .input('workspaceKey', sql.BigInt, workspace.WorkspaceKey)
                .query(`SELECT RoleKey FROM iam.Roles WHERE WorkspaceKey = @workspaceKey AND Name = 'Admin'`);

            if (adminCheck.recordset.length === 0) {
                // Create Admin role
                const adminRole = await pool.request()
                    .input('workspaceKey', sql.BigInt, workspace.WorkspaceKey)
                    .query(`
                        INSERT INTO iam.Roles (WorkspaceKey, Name)
                        OUTPUT inserted.RoleKey
                        VALUES (@workspaceKey, 'Admin')
                    `);

                const adminRoleKey = adminRole.recordset[0].RoleKey;
                console.log(`  ✓ Created Admin role (RoleKey: ${adminRoleKey})`);

                // Get Admin permissions
                const adminPermRequest = pool.request();
                constants.ADMIN_DEFAULT_PERMISSIONS.forEach((code, i) => {
                    adminPermRequest.input(`p${i}`, sql.NVarChar(100), code);
                });

                const placeholders = constants.ADMIN_DEFAULT_PERMISSIONS.map((_, i) => `@p${i}`).join(',');
                const adminPermissions = await adminPermRequest.query(`
                    SELECT PermissionKey FROM iam.Permissions
                    WHERE Code IN (${placeholders})
                `);

                // Grant permissions to Admin role
                for (const perm of adminPermissions.recordset) {
                    await pool.request()
                        .input('roleKey', sql.BigInt, adminRoleKey)
                        .input('permissionKey', sql.BigInt, perm.PermissionKey)
                        .query(`
                            IF NOT EXISTS (SELECT 1 FROM iam.RoleGrants WHERE RoleKey = @roleKey AND PermissionKey = @permissionKey)
                            INSERT INTO iam.RoleGrants (RoleKey, PermissionKey, Effect)
                            VALUES (@roleKey, @permissionKey, 1)
                        `);
                }
                console.log(`  ✓ Granted ${adminPermissions.recordset.length} permissions to Admin role`);
            } else {
                console.log(`  - Admin role already exists`);
            }

            // Check if Agent role exists
            const agentCheck = await pool.request()
                .input('workspaceKey', sql.BigInt, workspace.WorkspaceKey)
                .query(`SELECT RoleKey FROM iam.Roles WHERE WorkspaceKey = @workspaceKey AND Name = 'Agent'`);

            if (agentCheck.recordset.length === 0) {
                // Create Agent role
                const agentRole = await pool.request()
                    .input('workspaceKey', sql.BigInt, workspace.WorkspaceKey)
                    .query(`
                        INSERT INTO iam.Roles (WorkspaceKey, Name)
                        OUTPUT inserted.RoleKey
                        VALUES (@workspaceKey, 'Agent')
                    `);

                const agentRoleKey = agentRole.recordset[0].RoleKey;
                console.log(`  ✓ Created Agent role (RoleKey: ${agentRoleKey})`);

                // Get Agent permissions
                const agentPermRequest = pool.request();
                constants.AGENT_DEFAULT_PERMISSIONS.forEach((code, i) => {
                    agentPermRequest.input(`p${i}`, sql.NVarChar(100), code);
                });

                const placeholders2 = constants.AGENT_DEFAULT_PERMISSIONS.map((_, i) => `@p${i}`).join(',');
                const agentPermissions = await agentPermRequest.query(`
                    SELECT PermissionKey FROM iam.Permissions
                    WHERE Code IN (${placeholders2})
                `);

                // Grant permissions to Agent role
                for (const perm of agentPermissions.recordset) {
                    await pool.request()
                        .input('roleKey', sql.BigInt, agentRoleKey)
                        .input('permissionKey', sql.BigInt, perm.PermissionKey)
                        .query(`
                            IF NOT EXISTS (SELECT 1 FROM iam.RoleGrants WHERE RoleKey = @roleKey AND PermissionKey = @permissionKey)
                            INSERT INTO iam.RoleGrants (RoleKey, PermissionKey, Effect)
                            VALUES (@roleKey, @permissionKey, 1)
                        `);
                }
                console.log(`  ✓ Granted ${agentPermissions.recordset.length} permissions to Agent role`);
            } else {
                console.log(`  - Agent role already exists`);
            }

            console.log('');
        }

        console.log('✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
migrateWorkspaceRoles();
