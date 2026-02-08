const { connectMySQL, getPool } = require('../infra/mysql/mysql');

async function fixPermissions() {
    try {
        console.log('Connecting to database...');
        await connectMySQL();
        const pool = getPool();

        console.log('Backfilling missing permissions for Owner roles...');
        const [result] = await pool.execute(`
            INSERT INTO iam_RolePermissionGrants (RoleKey, PermissionKey, Effect)
            SELECT r.RoleKey, p.PermissionKey, 1
            FROM iam_Roles r
            CROSS JOIN iam_Permissions p
            WHERE r.Name = 'Owner'
              AND NOT EXISTS (
                SELECT 1 FROM iam_RolePermissionGrants g
                WHERE g.RoleKey = r.RoleKey AND g.PermissionKey = p.PermissionKey
              )
        `);
        console.log(`Inserted ${result.affectedRows} missing grants.`);

        console.log('Rebuilding effective permissions for affected memberships...');
        const [memberships] = await pool.execute(`
            SELECT DISTINCT m.MembershipKey
            FROM iam_Memberships m
            JOIN iam_MembershipRoles mr ON mr.MembershipKey = m.MembershipKey
            JOIN iam_Roles r ON r.RoleKey = mr.RoleKey
            WHERE r.Name = 'Owner'
        `);

        for (const record of memberships) {
            console.log(`Rebuilding for MembershipKey: ${record.MembershipKey}`);
            // Note: MySQL doesn't have stored procedures by default.
            // This rebuilds effective permissions inline.
            await pool.execute(`
                DELETE FROM iam_MembershipEffectivePermissions WHERE MembershipKey = ?
            `, [record.MembershipKey]);

            await pool.execute(`
                INSERT INTO iam_MembershipEffectivePermissions (MembershipKey, PermissionKey, ResourceKeyNN, Effect)
                SELECT mr.MembershipKey, rpg.PermissionKey, 0, rpg.Effect
                FROM iam_MembershipRoles mr
                JOIN iam_RolePermissionGrants rpg ON rpg.RoleKey = mr.RoleKey
                WHERE mr.MembershipKey = ?
            `, [record.MembershipKey]);
        }

        console.log('Fix complete.');
    } catch (err) {
        console.error('Failed to fix permissions:', err);
    } finally {
        process.exit(0);
    }
}

fixPermissions();
