const { connectMySQL, getPool } = require('../infra/mysql/mysql');

async function findUser() {
    try {
        await connectMySQL();
        const pool = getPool();
        const email = 'trungkien2981412@gmail.com';

        const [rows] = await pool.execute(
            'SELECT * FROM iam_Users WHERE EmailNormalized = ?',
            [email.toLowerCase()]
        );

        console.log('User found:', rows[0]);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

findUser();
