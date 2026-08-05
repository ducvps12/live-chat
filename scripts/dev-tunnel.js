const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const cloudflaredPath = path.join(__dirname, '../cloudflared.exe');
const envPath = path.join(__dirname, '../.env');

let backendUrl = '';
let frontendUrl = '';

const children = [];

function cleanup() {
    console.log('\nStopping all services and tunnels...');
    for (const child of children) {
        if (!child.killed) {
            child.kill('SIGINT');
        }
    }
    process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

function startTunnel(port, label, onUrlFound) {
    const args = ['tunnel', '--url', `http://localhost:${port}`];
    const proc = spawn(cloudflaredPath, args);
    children.push(proc);

    let urlFound = false;

    proc.stderr.on('data', (data) => {
        const output = data.toString();
        // Check for trycloudflare.com url
        const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match && !urlFound) {
            urlFound = true;
            onUrlFound(match[0]);
        }
    });

    proc.on('close', (code) => {
        if (code !== 0 && !proc.killed) {
            console.error(`[${label} Tunnel] Process exited with code ${code}`);
        }
    });
}

console.log('Starting Cloudflare Tunnels...');

// 1. Start Backend Tunnel (Port 4010)
startTunnel(4010, 'Backend', (url) => {
    backendUrl = url;
    console.log(`\x1b[32m[Backend Tunnel] Created successfully: ${backendUrl}\x1b[0m`);

    // 2. Write environment variables to .env (preserving existing values)
    let envContent = '';
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }
    const lines = envContent.split('\n');
    let hasUrl = false;
    let hasPort = false;
    const newLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('NEXT_PUBLIC_API_URL=')) {
            hasUrl = true;
            return `NEXT_PUBLIC_API_URL=${backendUrl}/api`;
        }
        if (trimmed.startsWith('PORT=')) {
            hasPort = true;
            return `PORT=4010`;
        }
        return line;
    });
    if (!hasUrl) {
        newLines.push(`NEXT_PUBLIC_API_URL=${backendUrl}/api`);
    }
    if (!hasPort) {
        newLines.push(`PORT=4010`);
    }
    fs.writeFileSync(envPath, newLines.join('\n'));
    console.log('[System] Updated .env file with new public backend URL.');

    // 3. Start Frontend Tunnel (Port 3010)
    startTunnel(3010, 'Frontend', (fUrl) => {
        frontendUrl = fUrl;
        console.log(`\x1b[35m[Frontend Tunnel] Created successfully: ${frontendUrl}\x1b[0m`);

        console.log('\n=============================================================');
        console.log('\x1b[1m\x1b[36mCLOUDFLARE TUNNEL IS FULLY CONFIGURED & READY!\x1b[0m');
        console.log(`Frontend URL: \x1b[4m\x1b[36m${frontendUrl}\x1b[0m`);
        console.log(`Backend API:  \x1b[4m\x1b[36m${backendUrl}\x1b[0m`);
        console.log('=============================================================\n');

        // 4. Start Next.js & Express servers
        console.log('Starting application servers...');
        const devServer = spawn('npm', ['run', 'dev'], {
            shell: true,
            stdio: 'inherit',
            env: { ...process.env }
        });
        children.push(devServer);
    });
});
