/**
 * Reset Password Script
 * Sets password to: Mtdvpscom001@
 */

const { getPool, sql, connectSql } = require('./src/infra/sql/pool');
const passwordUtils = require('./src/utils/password.utils');

async function resetPassword() {
    console.log('Connecting to database...');
    await connectSql();
    const pool = getPool();

    const email = 'mtienduc@gmail.com';
    const newPassword = 'Mtdvpscom001@';

    console.log(`Resetting password for: ${email}`);
    console.log(`New password: ${newPassword}`);

    // Generate hash
    const hash = await passwordUtils.hashPassword(newPassword);
    console.log('Generated hash:', hash);

    // Update in database
    const result = await pool.request()
        .input('email', sql.NVarChar, email)
        .input('hash', sql.NVarChar, hash)
        .query(`
      UPDATE iam.UserCredentials 
      SET PasswordHash = @hash, LockUntil = NULL, FailedLoginAttempts = 0 
      WHERE UserKey IN (SELECT UserKey FROM iam.Users WHERE Email = @email);
      SELECT @@ROWCOUNT AS RowsUpdated
    `);

    console.log('Rows updated:', result.recordset[0].RowsUpdated);
    console.log('Password reset successfully!');
    process.exit(0);
}

resetPassword().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
