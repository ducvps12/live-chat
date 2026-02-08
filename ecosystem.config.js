module.exports = {
    apps: [
        {
            name: 'frontend-live-chat',
            script: 'node_modules/next/dist/bin/next',
            args: 'start -p 3001',
            cwd: '/www/wwwroot/chat.mtdvps.com/frontend-live-chat',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production',
                PORT: 3001,
                BACKEND_URL: 'http://localhost:4000',
                NEXT_PUBLIC_API_URL: 'https://chat.mtdvps.com/api',
                NEXT_PUBLIC_API_URL_BASE: 'https://chat.mtdvps.com'
            },
            error_file: '/www/wwwroot/chat.mtdvps.com/logs/frontend-error.log',
            out_file: '/www/wwwroot/chat.mtdvps.com/logs/frontend-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
        }
    ]
};
