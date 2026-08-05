import express, { type Express } from 'express';
import { access, readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { mountRuntimeAssets } from '../src/bootstrap/staticAssets';

const main = async () => {
    const loginHtmlPath = path.join(process.cwd(), '.next', 'server', 'pages', 'auth', 'login.html');
    const loginHtml = await readFile(loginHtmlPath, 'utf8');

    const referencedAssets = Array.from(loginHtml.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g))
        .map((match) => match[1])
        .filter((url) => url === '/app.css' || url.startsWith('/_next/static/'));

    if (referencedAssets.length === 0) {
        throw new Error('No runtime assets found in the built login page');
    }

    const checkServer = async (label: string, configure: (app: Express) => void) => {
        const app = express();
        configure(app);
        const server = http.createServer(app);

        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('Could not start asset smoke server');
        const origin = `http://127.0.0.1:${address.port}`;
        const failures: Array<{ url: string; status: number; contentType: string | null }> = [];

        try {
            for (const url of referencedAssets) {
                const response = await fetch(`${origin}${url}`);
                const contentType = response.headers.get('content-type');
                const expectedType = url.endsWith('.css') ? 'text/css' : 'javascript';
                if (!response.ok || !contentType?.includes(expectedType)) {
                    failures.push({ url, status: response.status, contentType });
                }
                await response.arrayBuffer();
            }

            if (failures.length > 0) {
                throw new Error(`${label} runtime assets failed: ${JSON.stringify(failures)}`);
            }
        } finally {
            await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        }
    };

    for (const url of referencedAssets.filter((asset) => asset.startsWith('/_next/static/'))) {
        await access(path.join(process.cwd(), 'public', url.slice(1)));
    }

    await checkServer('shared helper', mountRuntimeAssets);
    await checkServer('plain public directory', (app) => {
        app.use(express.static(path.join(process.cwd(), 'public')));
    });

    console.log(JSON.stringify({ checked: referencedAssets.length, modes: 2, failures: [] }, null, 2));
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
