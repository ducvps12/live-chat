// PM2 startup script for Next.js frontend
process.chdir(__dirname);
process.argv = ['node', 'next', 'start', '-p', '3001'];

// Start Next.js directly
require('./node_modules/next/dist/bin/next');
