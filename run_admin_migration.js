/**
 * Admin Migration Script
 * 
 * This script:
 * 1. Adds UserLevel column to iam.Users table (0=Normal, 1=Demo, 9=SuperAdmin)
 * 2. Adds Status column if not exists (1=Active, 0=Inactive/Banned)
 * 3. Creates default admin account: admin / Admin@123
 * 4. Creates demo account: demo / Demo@123
 */

require('dotenv/config');
const { getPool, sql, connectSql } = require('./src/infra/sql/pool');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const generateUserId = () => `u_${crypto.randomBytes(8).toString('hex')}`;

async function runMigration() {
    console.log('🚀 Starting Admin Migration...\n');

    try {
        await connectSql();
        const pool = getPool();

        // Step 1: Add UserLevel column
        console.log('1️⃣  Checking UserLevel column...');
        const checkUserLevel = await pool.request().query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'iam' AND TABLE_NAME = 'Users' AND COLUMN_NAME = 'UserLevel'
        `);

        if (checkUserLevel.recordset.length === 0) {
            await pool.request().query(`
                ALTER TABLE iam.Users ADD UserLevel INT DEFAULT 0 NOT NULL
            `);
            console.log('   ✅ UserLevel column added');
        } else {
            console.log('   ⏭️  UserLevel column already exists');
        }

        // Step 2: Check Status column
        console.log('2️⃣  Checking Status column...');
        const checkStatus = await pool.request().query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'iam' AND TABLE_NAME = 'Users' AND COLUMN_NAME = 'Status'
        `);

        if (checkStatus.recordset.length === 0) {
            await pool.request().query(`
                ALTER TABLE iam.Users ADD Status INT DEFAULT 1 NOT NULL
            `);
            console.log('   ✅ Status column added');
        } else {
            console.log('   ⏭️  Status column already exists');
        }

        // Step 3: Create Admin account
        console.log('3️⃣  Creating admin account...');
        const adminEmail = 'admin@livechat.local';
        const adminPassword = 'Admin@123';

        const existingAdmin = await pool.request()
            .input('email', sql.NVarChar, adminEmail.toLowerCase())
            .query(`SELECT UserKey FROM iam.Users WHERE EmailNormalized = @email`);

        if (existingAdmin.recordset.length === 0) {
            const hashedPassword = await bcrypt.hash(adminPassword, 12);

            // Insert user
            const insertUser = await pool.request()
                .input('email', sql.NVarChar, adminEmail)
                .input('emailNorm', sql.NVarChar, adminEmail.toLowerCase())
                .input('displayName', sql.NVarChar, 'System Admin')
                .input('userLevel', sql.Int, 9)
                .input('emailVerified', sql.Bit, 1)
                .query(`
                    INSERT INTO iam.Users (Email, EmailNormalized, DisplayName, UserId, UserLevel, EmailVerified, Status)
                    OUTPUT inserted.UserKey
                    VALUES (@email, @emailNorm, @displayName, NEWID(), @userLevel, @emailVerified, 1)
                `);

            const adminUserKey = insertUser.recordset[0].UserKey;

            // Insert credential
            await pool.request()
                .input('userKey', sql.BigInt, adminUserKey)
                .input('passwordHash', sql.NVarChar, hashedPassword)
                .input('passwordAlgo', sql.NVarChar, 'bcrypt')
                .query(`
                    INSERT INTO iam.UserCredentials (UserKey, PasswordHash, PasswordAlgo)
                    VALUES (@userKey, @passwordHash, @passwordAlgo)
                `);

            console.log('   ✅ Admin account created');
            console.log(`      📧 Email: ${adminEmail}`);
            console.log(`      🔑 Password: ${adminPassword}`);
        } else {
            // Update existing admin to SuperAdmin level
            await pool.request()
                .input('email', sql.NVarChar, adminEmail.toLowerCase())
                .query(`UPDATE iam.Users SET UserLevel = 9 WHERE EmailNormalized = @email`);
            console.log('   ⏭️  Admin account already exists, updated to SuperAdmin');
        }

        // Step 4: Create Demo account
        console.log('4️⃣  Creating demo account...');
        const demoEmail = 'demo@livechat.local';
        const demoPassword = 'Demo@123';

        const existingDemo = await pool.request()
            .input('email', sql.NVarChar, demoEmail.toLowerCase())
            .query(`SELECT UserKey FROM iam.Users WHERE EmailNormalized = @email`);

        if (existingDemo.recordset.length === 0) {
            const hashedDemoPassword = await bcrypt.hash(demoPassword, 12);

            const insertDemo = await pool.request()
                .input('email', sql.NVarChar, demoEmail)
                .input('emailNorm', sql.NVarChar, demoEmail.toLowerCase())
                .input('displayName', sql.NVarChar, 'Demo User')
                .input('userLevel', sql.Int, 1)
                .input('emailVerified', sql.Bit, 1)
                .query(`
                    INSERT INTO iam.Users (Email, EmailNormalized, DisplayName, UserId, UserLevel, EmailVerified, Status)
                    OUTPUT inserted.UserKey
                    VALUES (@email, @emailNorm, @displayName, NEWID(), @userLevel, @emailVerified, 1)
                `);

            const demoUserKey = insertDemo.recordset[0].UserKey;

            await pool.request()
                .input('userKey', sql.BigInt, demoUserKey)
                .input('passwordHash', sql.NVarChar, hashedDemoPassword)
                .input('passwordAlgo', sql.NVarChar, 'bcrypt')
                .query(`
                    INSERT INTO iam.UserCredentials (UserKey, PasswordHash, PasswordAlgo)
                    VALUES (@userKey, @passwordHash, @passwordAlgo)
                `);

            console.log('   ✅ Demo account created');
            console.log(`      📧 Email: ${demoEmail}`);
            console.log(`      🔑 Password: ${demoPassword}`);
        } else {
            console.log('   ⏭️  Demo account already exists');
        }

        console.log('\n✅ Migration completed successfully!\n');
        console.log('═══════════════════════════════════════');
        console.log('📋 ACCOUNT SUMMARY:');
        console.log('═══════════════════════════════════════');
        console.log(`🔐 Admin: ${adminEmail} / ${adminPassword}`);
        console.log(`👁️  Demo:  ${demoEmail} / ${demoPassword}`);
        console.log('═══════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        process.exit(0);
    }
}

runMigration().catch(err => {
    console.error(err);
    process.exit(1);
});
