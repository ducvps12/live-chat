import express from 'express';
import http from 'http';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { corsOrigin, env } from '../config/env';
import { connectDB } from '../infra/db';
import { initSocketGateway } from '../infra/socket';
import rootRouter from '../routes';
import { errorHandler, AppError } from '../middlewares/errorHandler';
import { requestIdMiddleware } from '../middlewares/requestId';
import { zaloService } from '../modules/zalo/zalo.service';
import { facebookService } from '../modules/facebook/facebook.service';
import aiGatewayRoutes from '../modules/ai/ai.routes';
import { publicAIRoutes } from '../modules/ai/public-api.routes';
import { mountRuntimeAssets } from './staticAssets';
import { systemNotificationService } from '../modules/notification/system-notification.service';
import { startRuntimeHealthMonitor } from '../modules/notification/runtime-health-monitor';
import { campaignService, startCampaignScheduler } from '../modules/campaign/campaign.service';
import { startSignalRadarScheduler } from '../modules/radar/radar.service';

const bootstrap = async () => {
    // 1. Connect to Database
    await connectDB();
    const recoveredCampaigns = await campaignService.recoverInterruptedCampaigns();
    if (recoveredCampaigns > 0) {
        console.warn(`[Server] Recovered ${recoveredCampaigns} interrupted campaign(s) to paused state`);
    }

    // 2. Initialize Express application
    const app = express();

    // 3. Create HTTP server (needed for Socket.IO)
    const server = http.createServer(app);

    // 4. Initialize Socket.IO gateway
    initSocketGateway(server);

    // 5. Global Middlewares
    app.use(requestIdMiddleware); // must be first — every request gets an ID

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

    app.use(express.json({ limit: '20mb' }));
    app.use(express.urlencoded({ extended: true, limit: '20mb' }));
    app.use(cookieParser());

    // The public proxy can send file-looking requests to this API process.
    mountRuntimeAssets(app);
    
    // Custom morgan token: requestId
    morgan.token('reqId', (req) => (req as typeof req & { requestId?: string }).requestId || '-');
    app.use(morgan(':method :url :status :response-time ms - reqId=:reqId'));

    // 6. Mount Routes
    app.use('/v1', aiGatewayRoutes);
    app.use('/v1/public', publicAIRoutes);
    app.use('/api', rootRouter);

    // 7. 404 Handler
    app.use((req, res, next) => {
        next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404, 'NOT_FOUND'));
    });

    // 8. Global Error Handler
    app.use(errorHandler);

    // 9. Start Server
    const port = env.PORT || 4000;
    let stopHealthMonitor: () => void = () => undefined;
    let stopSignalRadar: () => void = () => undefined;
    let stopCampaignScheduler: () => void = () => undefined;
    server.listen(port, () => {
        console.log(`[Server] Backend process running on http://localhost:${port}`);

        stopHealthMonitor = startRuntimeHealthMonitor();
        stopSignalRadar = startSignalRadarScheduler();
        stopCampaignScheduler = startCampaignScheduler();
        void systemNotificationService.appStartup({
            port,
            mode: process.env.NODE_ENV || 'development',
        });
        
        // Boot up active Zalo sessions
        zaloService.bootActiveAccounts().catch(err => {
            console.error(`[Server] Failed to boot Zalo accounts (${err instanceof Error ? err.name : 'unknown'})`);
            void systemNotificationService.healthDegraded({
                component: 'zalo_bootstrap',
                status: 'failed',
                detail: err instanceof Error ? err.name : 'zalo_boot_error',
            });
        });

        // Auto-sync Facebook conversations (5s delay to let DB settle)
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

    // Graceful shutdown — close server before exit to release port
    let shuttingDown = false;
    const shutdown = async (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        stopHealthMonitor();
        stopSignalRadar();
        stopCampaignScheduler();
        const forceExit = setTimeout(() => process.exit(1), 10_000);
        forceExit.unref();
        const serverClosed = new Promise<void>(resolve => server.close(() => resolve()));
        await Promise.all([
            serverClosed,
            systemNotificationService.appShutdown({ signal }),
        ]);
        console.log('[Server] Server closed gracefully');
        clearTimeout(forceExit);
        process.exit(0);
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
};

// Handle unhandled rejections
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

// Run bootstrap
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
