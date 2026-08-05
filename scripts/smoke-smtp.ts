import assert from 'node:assert/strict';
import net from 'node:net';
import {
    normalizeSmtpConfig,
    sendSmtpMail,
    testSmtpConnection,
    toSafeSmtpError,
} from '../src/modules/email/smtp.service';
import {
    MASKED_EMAIL_SECRET,
    maskEmailTransportConfig,
    mergeProtectedEmailTransportConfig,
    protectEmailTransportConfig,
    revealEmailTransportConfig,
} from '../src/modules/email/email-account-secrets';

interface FakeSmtpServer {
    port: number;
    messages: string[];
    close: () => Promise<void>;
}

async function startFakeSmtpServer(): Promise<FakeSmtpServer> {
    const messages: string[] = [];
    const sockets = new Set<net.Socket>();
    const server = net.createServer(socket => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
        socket.write('220 fake-smtp.local ESMTP ready\r\n');

        let buffer = '';
        let readingMessage = false;

        socket.on('data', chunk => {
            buffer += chunk.toString('utf8');

            while (buffer) {
                if (readingMessage) {
                    const terminator = buffer.indexOf('\r\n.\r\n');
                    if (terminator < 0) return;
                    messages.push(buffer.slice(0, terminator));
                    buffer = buffer.slice(terminator + 5);
                    readingMessage = false;
                    socket.write('250 2.0.0 queued fake-message-id\r\n');
                    continue;
                }

                const newline = buffer.indexOf('\r\n');
                if (newline < 0) return;
                const line = buffer.slice(0, newline);
                buffer = buffer.slice(newline + 2);
                const command = line.toUpperCase();

                if (command.startsWith('EHLO ')) {
                    socket.write('250-fake-smtp.local\r\n250 SIZE 1000000\r\n');
                } else if (command.startsWith('MAIL FROM:')) {
                    socket.write('250 2.1.0 sender accepted\r\n');
                } else if (command.startsWith('RCPT TO:')) {
                    socket.write('250 2.1.5 recipient accepted\r\n');
                } else if (command === 'DATA') {
                    readingMessage = true;
                    socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
                } else if (command === 'QUIT') {
                    socket.end('221 2.0.0 bye\r\n');
                } else {
                    socket.write('500 5.5.1 command not recognized\r\n');
                }
            }
        });
    });

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            server.off('error', reject);
            resolve();
        });
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Fake SMTP server did not expose a TCP port');
    }

    return {
        port: address.port,
        messages,
        close: () => new Promise<void>((resolve, reject) => {
            for (const socket of sockets) socket.destroy();
            server.close(error => error ? reject(error) : resolve());
        }),
    };
}

async function run(): Promise<void> {
    process.env.SETTINGS_ENCRYPTION_KEY ||= 'smoke-test-email-secret-key-32-bytes-minimum';
    const protectedConfig = protectEmailTransportConfig({
        host: 'smtp.example.test',
        password: 'workspace-secret',
    });
    assert.match(String(protectedConfig.password), /^enc:v1:/);
    assert.equal(maskEmailTransportConfig(protectedConfig).password, MASKED_EMAIL_SECRET);
    const mergedConfig = mergeProtectedEmailTransportConfig(protectedConfig, {
        port: 587,
        password: MASKED_EMAIL_SECRET,
    });
    assert.equal(revealEmailTransportConfig(mergedConfig).password, 'workspace-secret');
    assert.equal(revealEmailTransportConfig({ password: 'legacy-plaintext' }).password, 'legacy-plaintext');

    const fake = await startFakeSmtpServer();
    try {
        const config = normalizeSmtpConfig({
            enabled: true,
            host: '127.0.0.1',
            port: fake.port,
            secure: false,
            requireTls: false,
            fromEmail: 'sender@example.com',
            fromName: 'NemarkChat Test',
            connectionTimeoutMs: 1_500,
            commandTimeoutMs: 1_500,
            tlsRejectUnauthorized: false,
        });

        const connection = await testSmtpConnection(config);
        assert.equal(connection.ok, true);
        assert.equal(connection.secure, false);
        assert.equal(connection.authenticated, false);
        assert(connection.capabilities.includes('SIZE'));

        const delivery = await sendSmtpMail(config, {
            to: 'receiver@example.com',
            subject: 'Kiểm tra SMTP',
            text: 'Xin chào từ NemarkChat.',
            html: '<p>Xin chào từ <strong>NemarkChat</strong>.</p>',
        });
        assert.deepEqual(delivery.accepted, ['receiver@example.com']);
        assert.match(delivery.messageId, /^<.+@example\.com>$/);
        assert.equal(fake.messages.length, 1);
        assert.match(fake.messages[0], /Content-Type: multipart\/alternative/);
        assert.match(fake.messages[0], /To: receiver@example\.com/);
        assert(!fake.messages[0].includes('\nBcc:'));

        const tlsFailure = await testSmtpConnection({
            ...config,
            requireTls: true,
        }).then(
            () => null,
            error => toSafeSmtpError(error),
        );
        assert(tlsFailure);
        assert.equal(tlsFailure.code, 'SMTP_TLS_REQUIRED');
        assert.deepEqual(Object.keys(tlsFailure).sort(), ['code', 'message', 'phase', 'retryable']);

        assert.throws(
            () => normalizeSmtpConfig({
                enabled: true,
                host: 'smtp.example.com',
                fromEmail: 'sender@example.com',
                user: 'smtp-user',
            }),
            error => toSafeSmtpError(error).code === 'SMTP_INVALID_CONFIG',
        );

        const uiAliasConfig = normalizeSmtpConfig({
            enabled: true,
            host: 'smtp.example.com',
            fromEmail: 'sender@example.com',
            username: 'smtp-user',
            password: 'smoke-password',
        });
        assert.equal(uiAliasConfig.user, 'smtp-user');
        assert.equal(uiAliasConfig.password, 'smoke-password');

        const secret = 'smtp-password-must-not-leak';
        const safeUnknownError = toSafeSmtpError(new Error(`Server exposed ${secret}`));
        assert(!JSON.stringify(safeUnknownError).includes(secret));

        console.log('smtp smoke checks passed');
    } finally {
        await fake.close();
    }
}

void run();
