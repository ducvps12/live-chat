import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

// Prisma Client singleton — prevents multiple instances in dev (hot reload)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient() {
    const adapter = new PrismaMariaDb({
        host: process.env.MYSQL_HOST || 'localhost',
        port: Number(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'livechatnemark',
        connectionLimit: 10,
        connectTimeout: 30000,       // 30s — wait longer for remote DB
        acquireTimeout: 30000,       // 30s — pool acquisition timeout
        idleTimeout: 60000,          // 60s — close idle connections
        resetAfterUse: false,        // reuse connections without reset
    });

    return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
