import { prisma } from './prisma';

export const connectDB = async () => {
    try {
        // Test the connection
        await prisma.$connect();
        console.log(`[DB] MySQL Connected via Prisma`);
    } catch (error) {
        const name = error instanceof Error ? error.name : 'database_connection_error';
        // Do not log driver messages here: connection strings or credentials
        // can be embedded in provider errors. The bootstrap reports a safe
        // degraded event and owns the process exit policy.
        console.error(`[DB] MySQL Connection Error (${name})`);
        throw error;
    }
};

export const disconnectDB = async () => {
    await prisma.$disconnect();
    console.log('[DB] MySQL Disconnected');
};
