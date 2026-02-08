const fs = require('fs');
const path = require('path');
const { connectMySQL, getPool } = require('../infra/mysql/mysql');

async function seed() {
    try {
        const sqlPath = path.join(__dirname, '../infra/sql/seed_permissions.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8')
            .replace(/GO/g, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/--.*$/gm, '')
            .trim();

        console.log('Connecting to database...');
        await connectMySQL();
        const pool = getPool();

        console.log('Executing seed script...');
        // Split by semicolons and execute each statement
        const statements = sqlContent.split(';').filter(s => s.trim());
        for (const stmt of statements) {
            if (stmt.trim()) {
                await pool.execute(stmt.trim());
            }
        }

        console.log('Permissions seeded successfully.');
    } catch (err) {
        console.error('Failed to seed permissions:', err);
    } finally {
        process.exit(0);
    }
}

seed();
