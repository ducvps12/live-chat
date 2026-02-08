const sql = require('mssql');

async function main() {
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

    try {
        await sql.connect(config);

        // Unlock account - reset failed attempts and lock
        await sql.query`
          UPDATE iam.UserCredentials 
          SET FailedLoginAttempts = 0, LockUntil = NULL 
          WHERE UserKey IN (SELECT UserKey FROM iam.Users WHERE Email = 'mtienduc@gmail.com')
        `;

        console.log('✅ Account mtienduc@gmail.com unlocked successfully!');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await sql.close();
    }
}

main();
