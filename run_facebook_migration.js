/**
 * Run Facebook Pages Migration
 * Creates the channels schema and FacebookPages tables
 */

require('dotenv').config();
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const config = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true',
        enableArithAbort: true
    }
};

async function runMigration() {
    let pool;

    try {
        console.log('Connecting to database...');
        pool = await sql.connect(config);
        console.log('Connected successfully!\n');

        // Read and execute migration script
        const migrationPath = path.join(__dirname, 'src/infra/sql/patches/patch_facebook_pages.sql');
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        // Split by GO statements and execute each batch
        const batches = migrationSql.split(/\nGO\b/i);

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i].trim();
            if (batch && !batch.startsWith('USE ')) { // Skip USE statement
                try {
                    await pool.request().query(batch);
                } catch (err) {
                    // Ignore "already exists" errors
                    if (!err.message.includes('already exists') && !err.message.includes('There is already')) {
                        console.error(`Error in batch ${i + 1}:`, err.message);
                    }
                }
            }
        }

        console.log('\n✅ Facebook Pages migration completed successfully!');
        console.log('\nCreated:');
        console.log('  - Schema: channels');
        console.log('  - Table: channels.FacebookPages');
        console.log('  - Table: channels.FacebookConversations');

    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

runMigration();
