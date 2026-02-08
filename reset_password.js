const sql = require('mssql');
const bcrypt = require('bcrypt');

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

        // Generate new password hash
        const newPassword = 'Duchit845@';
        const hash = await bcrypt.hash(newPassword, 10);
        console.log('Generated hash:', hash);

        // Update password
        await sql.query`
      UPDATE iam.UserCredentials 
      SET PasswordHash = ${hash}, 
          FailedLoginAttempts = 0, 
          LockUntil = NULL 
      WHERE UserKey IN (SELECT UserKey FROM iam.Users WHERE Email = 'mtienduc@gmail.com')
    `;

        console.log('Password updated successfully!');

        // Verify
        const result = await sql.query`
      SELECT c.PasswordHash 
      FROM iam.UserCredentials c 
      JOIN iam.Users u ON c.UserKey = u.UserKey 
      WHERE u.Email = 'mtienduc@gmail.com'
    `;
        console.log('Saved hash:', result.recordset[0].PasswordHash);

        // Test compare
        const match = await bcrypt.compare(newPassword, result.recordset[0].PasswordHash);
        console.log('Password match:', match);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await sql.close();
    }
}

main();
