import express, { type Express } from 'express';
import path from 'path';
import { WIDGET_LOADER_VERSION } from '../config/widgetLoader';

/**
 * Mount assets that must be reachable from both production processes.
 *
 * The public reverse proxy may route file-looking URLs to the API process.
 * Serving Next's immutable runtime files here as well prevents a deployment
 * from returning fresh HTML with 404 JavaScript chunks.
 */
export const mountRuntimeAssets = (app: Express) => {
    const projectRoot = process.cwd();
    const nextStaticDir = path.join(projectRoot, '.next', 'static');
    const publicDir = path.join(projectRoot, 'public');

    app.get('/widget/loader.js', (req, res, next) => {
        const requestedVersion = typeof req.query.v === 'string' ? req.query.v.trim() : '';
        if (requestedVersion === WIDGET_LOADER_VERSION) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
            res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate');
        }
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('X-NemarkChat-Widget-Version', WIDGET_LOADER_VERSION);
        next();
    });

    app.use('/_next/static', express.static(nextStaticDir, {
        fallthrough: true,
        immutable: true,
        index: false,
        maxAge: '1y',
    }));

    app.get('/app.css', (_req, res, next) => {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
        next();
    });

    app.use(express.static(publicDir));
};
