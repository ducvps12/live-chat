/**
 * Standalone script to create admin user
 * Run: node scripts/create_admin.js
 */
const sql = require('mssql');
const bcrypt = require('bcryptjs');

const config = {
    server: '127.0.0.1',
    database: 'live_chat_nemark',
    user: 'sa',
    password: '123456',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

const ADMIN_EMAIL = 'admin@nemark.vn';
const ADMIN_PASSWORD = 'Admin@123456';
const ADMIN_DISPLAY_NAME = 'System Admin';

async function createAdmin() {
    console.log('🔧 Connecting to database...');

    let pool;
    try {
        pool = await sql.connect(config);
        console.log('✅ Connected to MSSQL');

        // Check if user already exists
        const existingUser = await pool.request()
            .input('email', sql.NVarChar, ADMIN_EMAIL.toLowerCase())
            .query('SELECT * FROM iam.Users WHERE EmailNormalized = @email');

        if (existingUser.recordset.length > 0) {
            console.log('⚠️  User already exists:', ADMIN_EMAIL);

            // Update to admin if not already
            const user = existingUser.recordset[0];
            if (!user.IsSystemAdmin) {
                await pool.request()
                    .input('userKey', sql.BigInt, user.UserKey)
                    .query('UPDATE iam.Users SET IsSystemAdmin = 1, EmailVerified = 1 WHERE UserKey = @userKey');
                console.log('✅ Updated user to System Admin');
            } else {
                console.log('ℹ️  User is already a System Admin');
            }

            console.log('\n================================');
            console.log('Email:', ADMIN_EMAIL);
            console.log('Password:', ADMIN_PASSWORD);
            console.log('================================');
            return;
        }

        // Hash password
        console.log('🔐 Hashing password...');
        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

        // Create user with transaction
        const txn = pool.transaction();
        await txn.begin();

        try {
            // Insert user
            const userResult = await txn.request()
                .input('email', sql.NVarChar, ADMIN_EMAIL)
                .input('emailNorm', sql.NVarChar, ADMIN_EMAIL.toLowerCase())
                .input('displayName', sql.NVarChar, ADMIN_DISPLAY_NAME)
                .query(`
          INSERT INTO iam.Users (Email, EmailNormalized, DisplayName, IsSystemAdmin, EmailVerified)
          OUTPUT inserted.*
          VALUES (@email, @emailNorm, @displayName, 1, 1)
        `);

            const user = userResult.recordset[0];
            console.log('✅ Created user with UserKey:', user.UserKey);

            // Insert credential
            await txn.request()
                .input('userKey', sql.BigInt, user.UserKey)
                .input('passwordHash', sql.NVarChar, passwordHash)
                .input('algo', sql.NVarChar, 'bcrypt')
                .query(`
          INSERT INTO iam.UserCredentials (UserKey, PasswordHash, PasswordAlgo)
          VALUES (@userKey, @passwordHash, @algo)
        `);

            console.log('✅ Created credential');

            await txn.commit();
            console.log('\n✅ Admin user created successfully!');
            console.log('================================');
            console.log('Email:', ADMIN_EMAIL);
            console.log('Password:', ADMIN_PASSWORD);
            console.log('================================');
            console.log('\nYou can now login at: https://kiennt.mtdvps.com/auth/login');

        } catch (err) {
            await txn.rollback();
            throw err;
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err);
    } finally {
        if (pool) {
            await pool.close();
        }
        process.exit(0);
    }
}

createAdmin();
