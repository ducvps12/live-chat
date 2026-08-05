import http from 'node:http';

const listenHost = process.env.OLLAMA_PROXY_HOST || '127.0.0.1';
const listenPort = Number(process.env.OLLAMA_PROXY_PORT || 11434);
const upstreamHost = process.env.OLLAMA_UPSTREAM_HOST || '127.0.0.1';
const upstreamPort = Number(process.env.OLLAMA_UPSTREAM_PORT || 11435);
const token = String(process.env.OLLAMA_TUNNEL_TOKEN || '').trim();

if (!token) {
    throw new Error('OLLAMA_TUNNEL_TOKEN is required');
}

const server = http.createServer((request, response) => {
    const authorization = String(request.headers.authorization || '');
    if (authorization !== `Bearer ${token}`) {
        response.writeHead(401, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        response.end(JSON.stringify({ error: 'unauthorized' }));
        return;
    }

    const headers = { ...request.headers, host: `${upstreamHost}:${upstreamPort}` };
    delete headers['cf-connecting-ip'];
    delete headers['cf-ray'];

    const upstream = http.request({
        hostname: upstreamHost,
        port: upstreamPort,
        method: request.method,
        path: request.url,
        headers,
    }, (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
        upstreamResponse.pipe(response);
    });

    upstream.setTimeout(120_000, () => upstream.destroy(new Error('upstream timeout')));
    upstream.on('error', (error) => {
        if (!response.headersSent) response.writeHead(502, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: 'ollama_unavailable', message: error.message }));
    });
    request.pipe(upstream);
});

server.listen(listenPort, listenHost, () => {
    console.log(`[AI Proxy] Listening on http://${listenHost}:${listenPort} -> http://${upstreamHost}:${upstreamPort}`);
});
