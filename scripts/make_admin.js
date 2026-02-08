/**
 * Standalone script to make existing user an admin
 * Run: node scripts/make_admin.js <email>
 * Example: node scripts/make_admin.js mtienduc@gmail.com
 */
const sql = require('mssql');

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

const targetEmail = process.argv[2];

if (!targetEmail) {
    console.error('❌ Usage: node scripts/make_admin.js <email>');
    console.error('   Example: node scripts/make_admin.js mtienduc@gmail.com');
    process.exit(1);
}

async function makeAdmin() {
    console.log(`🔧 Making ${targetEmail} a System Admin...`);

    let pool;
    try {
        pool = await sql.connect(config);
        console.log('✅ Connected to MSSQL');

        // Check if user exists
        const existingUser = await pool.request()
            .input('email', sql.NVarChar, targetEmail.toLowerCase())
            .query('SELECT * FROM iam.Users WHERE EmailNormalized = @email');

        if (existingUser.recordset.length === 0) {
            console.error('❌ User not found:', targetEmail);
            return;
        }

        const user = existingUser.recordset[0];
        console.log('📝 Found user:', user.DisplayName || user.Email, '(UserKey:', user.UserKey + ')');

        if (user.IsSystemAdmin) {
            console.log('ℹ️  User is already a System Admin');
            return;
        }

        // Update to admin
        await pool.request()
            .input('userKey', sql.BigInt, user.UserKey)
            .query('UPDATE iam.Users SET IsSystemAdmin = 1, EmailVerified = 1 WHERE UserKey = @userKey');

        console.log('✅ Successfully updated user to System Admin!');
        console.log('');
        console.log('================================');
        console.log('Email:', targetEmail);
        console.log('IsSystemAdmin: true');
        console.log('================================');
        console.log('');
        console.log('🔄 Please logout and login again to see the changes.');

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

makeAdmin();
