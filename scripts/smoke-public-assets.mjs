const publicOrigin = process.env.PUBLIC_APP_URL || 'https://nemarkchat.com';
const loginUrl = new URL('/auth/login', publicOrigin);
loginUrl.searchParams.set('asset_smoke', String(Date.now()));

const htmlResponse = await fetch(loginUrl, {
    headers: {
        'cache-control': 'no-cache',
        pragma: 'no-cache',
    },
});

if (!htmlResponse.ok) {
    throw new Error(`Public login page returned ${htmlResponse.status}: ${loginUrl}`);
}

const html = await htmlResponse.text();
const buildId = html.match(/"buildId":"([^"]+)"/)?.[1] || null;
const referencedAssets = Array.from(html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g))
    .map((match) => match[1])
    .filter((url) => url === '/app.css' || url.startsWith('/_next/static/'));

if (!buildId || referencedAssets.length === 0) {
    throw new Error('Public login HTML did not contain a build ID and runtime assets');
}

const results = await Promise.all(referencedAssets.map(async (asset) => {
    const assetUrl = new URL(asset, publicOrigin);
    assetUrl.searchParams.set('asset_smoke', String(Date.now()));

    try {
        const response = await fetch(assetUrl, { headers: { 'cache-control': 'no-cache' } });
        const contentType = response.headers.get('content-type');
        const expectedType = asset.endsWith('.css') ? 'text/css' : 'javascript';
        const body = await response.arrayBuffer();
        return {
            asset,
            ok: response.ok && Boolean(contentType?.includes(expectedType)) && body.byteLength > 0,
            status: response.status,
            contentType,
            bytes: body.byteLength,
        };
    } catch (error) {
        return { asset, ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}));

const failures = results.filter((result) => !result.ok);
if (failures.length > 0) {
    throw new Error(`Public build ${buildId} has unavailable runtime assets: ${JSON.stringify(failures)}`);
}

console.log(JSON.stringify({
    origin: new URL(publicOrigin).origin,
    buildId,
    checked: results.length,
    failures: [],
}, null, 2));
