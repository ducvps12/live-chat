/**
 * Custom Next.js Server with Express and Socket.IO
 * Merged backend-live-chat into frontend-live-chat
 * 
 * ARCHITECTURE:
 * - HTTP Server handles ALL incoming requests
 * - Next.js internal routes (/_next/, /__nextjs, etc.) bypass Express entirely
 *   This is CRITICAL for HMR SSE (/_next/webpack-hmr) to work properly
 * - Express handles /api routes with security middleware
 * - All other routes fall through to Next.js page handler
 * - Socket.IO attaches to the HTTP server on /socket.io/ path
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Signal to next.config.js that we're running in merged mode
process.env.MERGED_SERVER = 'true';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3001', 10);

// Initialize Next.js
const nextApp = next({ dev, hostname, port });
const nextHandler = nextApp.getRequestHandler();

// Socket.IO instance (exported for use in API routes)
let io = null;

const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized');
    }
    return io;
};

nextApp.prepare().then(async () => {
    // Create Express app for API routes
    const expressApp = express();

    // ============================================
    // Express middleware for API routes ONLY
    // ============================================
    expressApp.use('/api', helmet({ contentSecurityPolicy: false }));
    expressApp.use('/api', cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
    expressApp.use('/api', express.json({ limit: '50mb' }));
    expressApp.use('/api', express.urlencoded({ extended: true, limit: '50mb' }));

    // Initialize database (MySQL)
    let dbConnected = false;
    try {
        const { connectMySQL } = require('./src/server/infra/mysql/mysql');
        const { runAutoSeed } = require('./src/server/infra/mysql/autoSeed');
        await connectMySQL();
        await runAutoSeed();
        dbConnected = true;
        console.log('[Server] ✅ Database connected and seeded');
    } catch (err) {
        console.error('[Server] ❌ Database connection failed:', err.message);
        console.error('[Server] ⚠️  Server will start but DB features will be unavailable');
        console.error('[Server] ⚠️  Check your MySQL connection settings in .env.local');
    }
    global.__dbConnected = dbConnected;

    // Mount backend API routes
    try {
        const apiRoutes = require('./src/server/routes');
        expressApp.use('/api', apiRoutes);
        console.log('[Server] API routes mounted at /api');
    } catch (err) {
        console.error('[Server] Failed to mount API routes:', err.message);
    }

    // ============================================
    // HTTP Server — handles request routing
    // CRITICAL: Next.js routes (/_next, HMR, static) bypass Express entirely
    // This prevents Express from interfering with SSE/WebSocket connections
    // ============================================
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url || '/', true);
        const { pathname } = parsedUrl;

        // Next.js internal routes — bypass Express completely
        // This is essential for HMR (/_next/webpack-hmr) to work with SSE
        if (
            pathname.startsWith('/_next/') ||
            pathname.startsWith('/__nextjs') ||
            pathname === '/favicon.ico'
        ) {
            nextHandler(req, res, parsedUrl);
            return;
        }

        // /api routes — handled by Express
        if (pathname.startsWith('/api/') || pathname === '/api') {
            expressApp(req, res);
            return;
        }

        // /socket.io — handled by Socket.IO (auto-attached to server)
        if (pathname.startsWith('/socket.io')) {
            // Socket.IO handles these via its own listeners
            // Just let it pass through (it's already attached to the server)
            return;
        }

        // All other routes — Next.js pages
        nextHandler(req, res, parsedUrl);
    });

    // Initialize Socket.IO
    io = new Server(server, {
        cors: {
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
        path: '/socket.io/',
    });

    // Handle WebSocket upgrade for both Socket.IO and Next.js HMR
    server.on('upgrade', (req, socket, head) => {
        const { pathname } = parse(req.url || '/', true);
        if (pathname && !pathname.startsWith('/socket.io')) {
            // Next.js handles HMR WebSocket upgrades
            nextApp.getUpgradeHandler()(req, socket, head);
        }
        // Socket.IO handles /socket.io upgrades automatically
    });

    // Socket.IO connection handler
    io.on('connection', (socket) => {
        console.log('[Socket] Client connected:', socket.id);
        socket.on('disconnect', (reason) => {
            console.log('[Socket] Client disconnected:', socket.id, reason);
        });
        socket.on('join_room', (room) => {
            socket.join(room);
            console.log('[Socket] Client joined room:', room);
        });
        socket.on('leave_room', (room) => {
            socket.leave(room);
            console.log('[Socket] Client left room:', room);
        });
    });

    // Export io for use in API routes
    global.io = io;

    // Restore Zalo sessions
    try {
        const { restoreAllSessions } = require('./src/server/services/ZaloBrowser');
        const result = await restoreAllSessions(io);
        console.log(`[Server] Zalo sessions restored: ${result.restored}, failed: ${result.failed}`);
    } catch (e) {
        console.warn('[Server] Could not restore Zalo sessions:', e.message);
    }

    // Start server
    server.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
        console.log(`> API available at http://${hostname}:${port}/api`);
        console.log(`> Socket.IO available at http://${hostname}:${port}`);
    });

    // Graceful shutdown
    const shutdown = () => {
        console.log('[Server] Shutting down...');
        server.close(() => {
            console.log('[Server] HTTP Server closed');
            process.exit(0);
        });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
});

module.exports = { getIO };
