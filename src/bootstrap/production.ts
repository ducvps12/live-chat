import express from 'express';
import http from 'http';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import next from 'next';
import { corsOrigin, env, validateProductionEnv } from '../config/env';
import { connectDB, disconnectDB } from '../infra/db';
import { initSocketGateway } from '../infra/socket';
import rootRouter from '../routes';
import { errorHandler } from '../middlewares/errorHandler';
import { requestIdMiddleware } from '../middlewares/requestId';
import { zaloService } from '../modules/zalo/zalo.service';
import { facebookService } from '../modules/facebook/facebook.service';
import aiGatewayRoutes from '../modules/ai/ai.routes';
import { publicAIRoutes } from '../modules/ai/public-api.routes';
import { mountRuntimeAssets } from './staticAssets';
import { startNotificationOutboxWorker, systemNotificationService } from '../modules/notification/system-notification.service';
import { startRuntimeHealthMonitor } from '../modules/notification/runtime-health-monitor';
import { campaignService, startCampaignScheduler } from '../modules/campaign/campaign.service';
import { startSignalRadarScheduler } from '../modules/radar/radar.service';

/**
 * Production bootstrap: serves Next.js + Express API + Socket.IO on ONE port.
 * Usage:  NODE_ENV=production node --import tsx src/bootstrap/production.ts
 * Or:     NODE_ENV=production tsx src/bootstrap/production.ts
 */
const bootstrap = async () => {
    validateProductionEnv();
    const dev = process.env.NEXT_DEV === 'true';
    const port = Number(process.env.PORT || env.PORT || 4001);

    // 1. Connect to Database
    await connectDB();
    const recoveredCampaigns = await campaignService.recoverInterruptedCampaigns();
    if (recoveredCampaigns > 0) {
        console.warn(`[Server] Recovered ${recoveredCampaigns} interrupted campaign(s) to paused state`);
    }

    // 2. Prepare Next.js
    const nextApp = next({ dev, dir: process.cwd() });
    const nextHandler = nextApp.getRequestHandler();
    await nextApp.prepare();
    console.log(`[Server] Next.js prepared (${dev ? 'development' : 'production'} mode)`);

    // 3. Initialize Express
    const app = express();
    const server = http.createServer(app);

    // 4. Initialize Socket.IO
    initSocketGateway(server);

    // 5. Global Middlewares
    app.use(requestIdMiddleware);

    // Dynamic CORS: public/widget routes reflect any Origin so third-party
    // sites can embed the widget; admin/dashboard routes keep strict allowlist.
    app.use((req, res, next) => {
        const p = req.path;
        const origin = req.headers.origin;
        if (p.includes('/public/') || p.startsWith('/v1/') || p.startsWith('/api/facebook/') || p.startsWith('/widget/')) {
            res.setHeader('Access-Control-Allow-Origin', origin || '*');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Cookie');
            if (req.method === 'OPTIONS') return res.sendStatus(200);
            return next();
        }
        return cors({ origin: corsOrigin, credentials: true })(req, res, next);
    });

    app.use(express.json({
        limit: '20mb',
        verify: (req, _res, buffer) => {
            if (req.originalUrl.includes('/facebook/webhook')) {
                (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
            }
        },
    }));
    app.use(express.urlencoded({ extended: true, limit: '20mb' }));
    app.use(cookieParser());

    // Static files must also be available when the reverse proxy routes
    // /_next/static to the API origin.
    mountRuntimeAssets(app);

    // Logging
    morgan.token('reqId', (req) => (req as typeof req & { requestId?: string }).requestId || '-');
    app.use(morgan(':method :url :status :response-time ms - reqId=:reqId'));

    // 6. Mount the OpenAI-compatible gateway and application API.
    app.use('/v1', aiGatewayRoutes);
    app.use('/v1/public', publicAIRoutes);
    app.use('/api', rootRouter);

    // 7. Let Next.js handle EVERYTHING else (pages, _next statics, etc.)
    app.all('{*path}', (req, res) => {
        return nextHandler(req, res);
    });

    // 8. Error handler (for API routes only — Next.js handles its own errors)
    app.use(errorHandler);

    // 9. Start on single port
    let stopHealthMonitor: () => void = () => undefined;
    let stopSignalRadar: () => void = () => undefined;
    let stopCampaignScheduler: () => void = () => undefined;
    let stopNotificationOutbox: () => void = () => undefined;
    server.listen(port, '0.0.0.0', () => {
        console.log(`[Server] ✅ NemarkChat running on http://localhost:${port}`);
        console.log(`[Server]    API:    http://localhost:${port}/api`);
        console.log(`[Server]    Web:    http://localhost:${port}`);
        console.log(`[Server]    Socket: ws://localhost:${port}`);

        stopHealthMonitor = startRuntimeHealthMonitor();
        stopSignalRadar = startSignalRadarScheduler();
        stopCampaignScheduler = startCampaignScheduler();
        stopNotificationOutbox = startNotificationOutboxWorker();
        void systemNotificationService.appStartup({
            port,
            mode: dev ? 'development' : 'production',
        });

        // Boot Zalo sessions
        zaloService.bootActiveAccounts().catch(err => {
            console.error(`[Server] Failed to boot Zalo accounts (${err instanceof Error ? err.name : 'unknown'})`);
            void systemNotificationService.healthDegraded({
                component: 'zalo_bootstrap',
                status: 'failed',
                detail: err instanceof Error ? err.name : 'zalo_boot_error',
            });
        });

        setTimeout(() => {
            facebookService.syncAllActivePages().catch(err => {
                console.error(`[Server] Failed to auto-sync Facebook pages (${err instanceof Error ? err.name : 'unknown'})`);
                void systemNotificationService.healthDegraded({
                    component: 'facebook_sync',
                    status: 'failed',
                    detail: err instanceof Error ? err.name : 'facebook_sync_error',
                });
            });
        }, 5000);
    });

    let shuttingDown = false;
    const shutdown = async (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`[Server] ${signal} received, shutting down gracefully`);
        stopHealthMonitor();
        stopSignalRadar();
        stopCampaignScheduler();
        stopNotificationOutbox();
        const forceExit = setTimeout(() => process.exit(1), 10_000);
        forceExit.unref();
        const serverClosed = new Promise<void>(resolve => server.close(() => resolve()));
        await Promise.all([
            serverClosed,
            systemNotificationService.appShutdown({ signal }),
        ]);
        await disconnectDB().catch(() => undefined);
        clearTimeout(forceExit);
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
};

process.on('unhandledRejection', (err: Error) => {
    console.error(`[Server] UNHANDLED REJECTION (${err.name}) - shutting down`);
    const forceExit = setTimeout(() => process.exit(1), 9_000);
    forceExit.unref();
    void systemNotificationService.healthDegraded({
        component: 'node_process',
        status: 'unhandled_rejection',
        detail: err.name,
    }).finally(() => {
        clearTimeout(forceExit);
        process.exit(1);
    });
});

bootstrap().catch(error => {
    const name = error instanceof Error ? error.name : 'bootstrap_error';
    console.error(`[Server] Bootstrap failed (${name})`);
    void systemNotificationService.healthDegraded({
        component: 'bootstrap',
        status: 'failed',
        detail: name,
        envOnly: true,
    }).finally(() => process.exit(1));
});
