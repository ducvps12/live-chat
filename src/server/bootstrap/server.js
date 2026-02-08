const { connectMySQL } = require('../infra/mysql/mysql');
const { runAutoSeed } = require('../infra/mysql/autoSeed');
const createApp = require('./express');
const { initSocket } = require('./socket');
const env = require('../config/env');
const http = require('http');
const net = require('net');

function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        tester.close(() => resolve(false));
      })
      .listen(port);
  });
}

async function start() {
  try {
    // 0. Check if port is available
    const portInUse = await isPortInUse(env.app.port);
    if (portInUse) {
      console.error(`\n❌ ERROR: Port ${env.app.port} is already in use!`);
      console.error(`   Another process is occupying this port.`);
      console.error(`   Please stop the other process or use a different port.\n`);
      console.error(`   To find the process: netstat -ano | findstr :${env.app.port}`);
      console.error(`   To kill by PID: taskkill /PID <PID> /F\n`);
      process.exit(1);
    }

    // 1. Connect to MySQL
    await connectMySQL();

    // 1.5. Auto-seed permissions and schema updates
    await runAutoSeed();

    // 2. Initialize App
    const app = createApp();
    const server = http.createServer(app);

    // 3. Initialize Socket.IO
    initSocket(server);

    // 3.5. Restore Zalo Personal sessions from saved credentials
    try {
      const { restoreAllSessions } = require('../services/ZaloBrowser');
      const { getIO } = require('./socket');
      const io = getIO();
      const result = await restoreAllSessions(io);
      console.log(`[Startup] Zalo sessions restored: ${result.restored}, failed: ${result.failed}`);
    } catch (e) {
      console.warn('[Startup] Could not restore Zalo sessions:', e.message);
    }

    // 4. Start Server
    server.listen(env.app.port, () => {
      console.log(`Server started on port ${env.app.port} (${env.app.env})`);
      console.log(`API available at http://localhost:${env.app.port}/api`);
      console.log(`Socket.IO available at http://localhost:${env.app.port}`);
    });

    // Graceful Shutdown
    const shutdown = () => {
      console.log('Shutting down...');
      server.close(() => {
        console.log('HTTP Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
