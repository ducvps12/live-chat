import { CDPSession, Page } from 'puppeteer';
import { env } from '../config/env';

/**
 * Start CDP screencast for a session.
 * Streams JPEG frames via callback.
 */
export function startScreencast(
    cdpSession: CDPSession,
    onFrame: (data: Buffer, metadata: { sessionId: number; timestamp: number }) => void
): void {
    cdpSession.on('Page.screencastFrame', async (event: any) => {
        try {
            const frameBuffer = Buffer.from(event.data, 'base64');
            onFrame(frameBuffer, {
                sessionId: event.sessionId,
                timestamp: event.metadata?.timestamp || Date.now(),
            });
            // ACK the frame so CDP sends next one
            await cdpSession.send('Page.screencastFrameAck', {
                sessionId: event.sessionId,
            });
        } catch (err) {
            // Silent — frame dropped
        }
    });

    cdpSession.send('Page.startScreencast', {
        format: 'jpeg',
        quality: env.SCREENCAST_QUALITY,
        maxWidth: 1280,
        maxHeight: 800,
        everyNthFrame: Math.max(1, Math.round(60 / env.SCREENCAST_FPS)),
    }).catch((err: any) => {
        console.error('[SessionStream] Failed to start screencast:', err.message);
    });
}

/**
 * Stop screencast for a session.
 */
export async function stopScreencast(cdpSession: CDPSession): Promise<void> {
    try {
        await cdpSession.send('Page.stopScreencast');
    } catch { /* already stopped */ }
}

// ────────── Input Dispatch ──────────

/**
 * Dispatch mouse event to browser via CDP.
 */
export async function dispatchMouse(
    cdpSession: CDPSession,
    type: 'mousePressed' | 'mouseReleased' | 'mouseMoved',
    x: number,
    y: number,
    button: 'left' | 'right' | 'middle' = 'left',
    clickCount: number = 1
): Promise<void> {
    await cdpSession.send('Input.dispatchMouseEvent', {
        type,
        x: Math.round(x),
        y: Math.round(y),
        button,
        clickCount,
    });
}

/**
 * Dispatch keyboard event to browser via CDP.
 */
export async function dispatchKeyboard(
    cdpSession: CDPSession,
    type: 'keyDown' | 'keyUp' | 'char',
    key: string,
    code: string = '',
    text: string = ''
): Promise<void> {
    const params: any = { type };

    if (type === 'char') {
        params.text = text || key;
    } else {
        params.key = key;
        if (code) params.code = code;
        if (text) params.text = text;
        // Handle modifiers
        if (key === 'Shift') params.modifiers = 8;
        if (key === 'Control') params.modifiers = 2;
        if (key === 'Alt') params.modifiers = 1;
        if (key === 'Meta') params.modifiers = 4;
    }

    await cdpSession.send('Input.dispatchKeyEvent', params);
}

/**
 * Dispatch scroll event via CDP.
 */
export async function dispatchScroll(
    cdpSession: CDPSession,
    x: number,
    y: number,
    deltaX: number,
    deltaY: number
): Promise<void> {
    await cdpSession.send('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: Math.round(x),
        y: Math.round(y),
        deltaX,
        deltaY,
    });
}

// ────────── Login State Detection ──────────

export type LoginState = 'qr_visible' | 'logged_in' | 'loading' | 'error' | 'unknown';

/**
 * Detect current login state of Zalo Web page.
 * Checks DOM for QR code vs chat list vs error states.
 */
export async function detectLoginState(page: Page): Promise<LoginState> {
    try {
        return await page.evaluate(() => {
            // Zalo Web QR login screen indicators
            const qrCanvas = document.querySelector('canvas');
            const qrImg = document.querySelector('img[src*="qr"]') || document.querySelector('[class*="qr"]');
            const loginContainer = document.querySelector('[class*="login"]') || document.querySelector('[class*="Login"]');

            // Chat list indicators (means logged in)
            const chatList = document.querySelector('[class*="conv-list"]') ||
                document.querySelector('[class*="conversation"]') ||
                document.querySelector('[class*="chat-list"]') ||
                document.querySelector('[id*="chatList"]');
            const chatInput = document.querySelector('[class*="chat-input"]') ||
                document.querySelector('[contenteditable="true"]');

            // Error indicators
            const errorEl = document.querySelector('[class*="error"]') ||
                document.querySelector('[class*="Error"]');

            if (chatList || chatInput) return 'logged_in';
            if (qrCanvas || qrImg || loginContainer) return 'qr_visible';
            if (errorEl) return 'error';

            // Check if still loading
            if (document.readyState !== 'complete') return 'loading';

            return 'unknown';
        }) as LoginState;
    } catch {
        return 'unknown';
    }
}

/**
 * Take a one-time screenshot (for debugging/thumbnail).
 */
export async function takeScreenshot(page: Page): Promise<Buffer> {
    return (await page.screenshot({ type: 'jpeg', quality: 70 })) as Buffer;
}
