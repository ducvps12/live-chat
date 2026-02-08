const { connectMySQL, getPool } = require('../infra/mysql/mysql');

async function deleteUser() {
    try {
        await connectMySQL();
        const pool = getPool();
        const email = 'trungkien2981412@gmail.com';

        const [userRows] = await pool.execute(
            'SELECT UserKey FROM iam_Users WHERE EmailNormalized = ?',
            [email.toLowerCase()]
        );

        if (userRows.length === 0) {
            console.log('User not found.');
            return;
        }

        const userKey = userRows[0].UserKey;
        console.log(`Deleting user ${email} (Key: ${userKey})...`);

        await pool.execute('DELETE FROM iam_Users WHERE UserKey = ?', [userKey]);

        console.log('User deleted.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

deleteUser();
