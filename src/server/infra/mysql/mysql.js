const mysql = require('mysql2/promise');
const env = require('../../config/env');

let pool = null;
let dbStatus = { connected: false, error: null, lastCheck: null };

const connectMySQL = async () => {
    try {
        if (pool) return pool;

        pool = mysql.createPool({
            host: env.mysql.host,
            port: env.mysql.port,
            user: env.mysql.user,
            password: env.mysql.password,
            database: env.mysql.database,
            waitForConnections: true,
            connectionLimit: 20,
            queueLimit: 0,
            charset: 'utf8mb4',
            timezone: '+00:00', // UTC
            dateStrings: false,
        });

        // Test connection
        const conn = await pool.getConnection();
        console.log('✅ Connected to MySQL');
        dbStatus = { connected: true, error: null, lastCheck: new Date().toISOString() };
        conn.release();

        return pool;
    } catch (err) {
        console.error('❌ Failed to connect to MySQL:', err.message);
        dbStatus = { connected: false, error: err.message, lastCheck: new Date().toISOString() };
        throw err;
    }
};

const getPool = () => {
    if (!pool) throw new Error('Pool not initialized, call connectMySQL first');
    return pool;
};

const getDbStatus = () => dbStatus;

/**
 * Check current DB connectivity (live ping)
 */
const checkConnection = async () => {
    try {
        if (!pool) {
            dbStatus = { connected: false, error: 'Pool not initialized', lastCheck: new Date().toISOString() };
            return dbStatus;
        }
        const conn = await pool.getConnection();
        await conn.ping();
        conn.release();
        dbStatus = { connected: true, error: null, lastCheck: new Date().toISOString() };
    } catch (err) {
        dbStatus = { connected: false, error: err.message, lastCheck: new Date().toISOString() };
    }
    return dbStatus;
};

module.exports = {
    connectMySQL,
    getPool,
    getDbStatus,
    checkConnection,
};
