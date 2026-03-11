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

// ────────── Zalo Scraping (Structural Analysis) ──────────

export interface ScrapedConversation {
    id: string;
    contactName: string;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
    avatarUrl?: string;
}

export interface ScrapedMessage {
    id: string;
    content: string;
    senderType: 'me' | 'other';
    senderName: string;
    createdAt: string;
    type: 'text' | 'image' | 'file' | 'sticker';
}

/**
 * Scrape conversation list from Zalo Web using structural analysis.
 * Instead of matching specific class names, we look for:
 * 1. A scrollable container in the left portion of the viewport
 * 2. Repeated child elements that have similar structure (avatar + text)
 * 3. Extract text content from each item
 */
export async function scrapeZaloConversations(page: Page): Promise<ScrapedConversation[]> {
    try {
        const result = await page.evaluate(() => {
            const vpWidth = window.innerWidth;
            const debug: string[] = [];

            // Strategy: find all elements that look like conversation list items
            // A conversation item typically: is in the left 40% of screen, has an img (avatar),
            // has at least 2 text nodes (name + last message), and is repeated
            const allElements = document.querySelectorAll('*');
            const candidates: Map<Element, Element[]> = new Map();

            // Step 1: Find containers that have multiple similar children 
            // (conversation lists are repeated structures)
            for (const el of allElements) {
                const rect = el.getBoundingClientRect();
                // Must be in left portion of viewport and visible
                if (rect.left > vpWidth * 0.45 || rect.width < 100 || rect.height < 200) continue;
                if (rect.top < 0 || rect.bottom > window.innerHeight + 100) continue;

                const children = Array.from(el.children);
                if (children.length < 2) continue;

                // Check if children have similar structure (same tag, similar height)
                const firstTag = children[0].tagName;
                const similarChildren = children.filter(c => {
                    const cr = c.getBoundingClientRect();
                    return c.tagName === firstTag && cr.height > 30 && cr.height < 150 && cr.width > 100;
                });

                if (similarChildren.length >= 2) {
                    // Check if children contain text
                    const withText = similarChildren.filter(c => (c.textContent?.trim().length || 0) > 2);
                    if (withText.length >= 2) {
                        candidates.set(el, withText);
                    }
                }
            }

            debug.push(`Found ${candidates.size} candidate containers`);

            // Step 2: Pick the best container (most children, in left area)
            let bestContainer: Element | null = null;
            let bestItems: Element[] = [];
            let bestScore = 0;

            for (const [container, items] of candidates) {
                const rect = container.getBoundingClientRect();
                // Prefer containers with more items and in left area
                const score = items.length * 10 + (rect.left < vpWidth * 0.3 ? 50 : 0);
                if (score > bestScore) {
                    bestScore = score;
                    bestContainer = container;
                    bestItems = items;
                }
            }

            if (!bestContainer || bestItems.length === 0) {
                debug.push('No conversation container found');
                return { conversations: [], debug };
            }

            debug.push(`Best container has ${bestItems.length} items, tag: ${bestContainer.tagName}, class: ${bestContainer.className?.toString().substring(0, 80)}`);

            // Step 3: Extract data from each item
            const conversations: any[] = [];
            bestItems.forEach((item, idx) => {
                const texts: string[] = [];
                // Walk through text nodes, collecting distinct text chunks
                const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT, null);
                let node;
                while (node = walker.nextNode()) {
                    const t = node.textContent?.trim();
                    if (t && t.length > 0 && t.length < 200) {
                        texts.push(t);
                    }
                }

                // Find avatar image
                const img = item.querySelector('img') as HTMLImageElement;
                const avatarUrl = img?.src || undefined;

                // Parse texts: typically [name, lastMessage, time, ...]
                const name = texts[0] || `Hội thoại ${idx + 1}`;
                const lastMessage = texts.length > 1 ? texts.slice(1, -1).join(' ') : '';
                const timeText = texts.length > 1 ? texts[texts.length - 1] : '';

                // Check for unread badge (number-only text in a small element)
                let unreadCount = 0;
                const smallEls = item.querySelectorAll('*');
                for (const se of smallEls) {
                    const sr = se.getBoundingClientRect();
                    if (sr.width < 30 && sr.height < 30 && sr.width > 10) {
                        const num = parseInt(se.textContent?.trim() || '', 10);
                        if (num > 0 && num < 1000) { unreadCount = num; break; }
                    }
                }

                conversations.push({
                    id: `zalo_conv_${idx}`,
                    contactName: name,
                    lastMessage,
                    lastMessageAt: timeText || new Date().toISOString(),
                    unreadCount,
                    avatarUrl,
                });
            });

            return { conversations, debug };
        });

        console.log('[ZaloScrape] Debug:', result.debug.join(' | '));
        return result.conversations;
    } catch (err) {
        console.error('[ZaloScrape] Failed to scrape conversations:', err);
        return [];
    }
}

/**
 * Click on a conversation item by index, then scrape messages from the right panel.
 */
export async function scrapeZaloMessages(page: Page, convIndex: number): Promise<ScrapedMessage[]> {
    try {
        // Step 1: Find and click the conversation item
        const clicked = await page.evaluate((idx) => {
            const vpWidth = window.innerWidth;
            const allElements = document.querySelectorAll('*');
            let bestContainer: Element | null = null;
            let bestItems: Element[] = [];
            let bestScore = 0;

            for (const el of allElements) {
                const rect = el.getBoundingClientRect();
                if (rect.left > vpWidth * 0.45 || rect.width < 100 || rect.height < 200) continue;
                if (rect.top < 0 || rect.bottom > window.innerHeight + 100) continue;
                const children = Array.from(el.children);
                if (children.length < 2) continue;
                const firstTag = children[0].tagName;
                const similar = children.filter(c => {
                    const cr = c.getBoundingClientRect();
                    return c.tagName === firstTag && cr.height > 30 && cr.height < 150 && cr.width > 100;
                });
                const withText = similar.filter(c => (c.textContent?.trim().length || 0) > 2);
                if (withText.length >= 2) {
                    const score = withText.length * 10 + (rect.left < vpWidth * 0.3 ? 50 : 0);
                    if (score > bestScore) {
                        bestScore = score;
                        bestContainer = el;
                        bestItems = withText;
                    }
                }
            }

            if (!bestItems[idx]) return false;
            (bestItems[idx] as HTMLElement).click();
            return true;
        }, convIndex);

        if (!clicked) return [];

        // Wait for messages to render
        await new Promise(r => setTimeout(r, 1500));

        // Step 2: Scrape messages from the right panel (right 50-60% of viewport)
        return await page.evaluate(() => {
            const vpWidth = window.innerWidth;
            const results: any[] = [];

            // Find the message area: right portion of viewport, tall container
            const allElements = document.querySelectorAll('*');
            let msgContainer: Element | null = null;
            let msgContainerScore = 0;

            for (const el of allElements) {
                const rect = el.getBoundingClientRect();
                // Must be in right portion
                if (rect.left < vpWidth * 0.25) continue;
                if (rect.height < 200 || rect.width < vpWidth * 0.3) continue;

                // Check scrollable
                const style = getComputedStyle(el);
                const isScrollable = style.overflowY === 'auto' || style.overflowY === 'scroll'
                    || el.scrollHeight > el.clientHeight + 50;

                if (!isScrollable) continue;

                // Count child elements (message bubbles)
                const childCount = el.children.length;
                if (childCount < 1) continue;

                const score = childCount + (rect.width > vpWidth * 0.4 ? 20 : 0);
                if (score > msgContainerScore) {
                    msgContainerScore = score;
                    msgContainer = el;
                }
            }

            if (!msgContainer) return results;

            // Extract messages from the container
            // Messages are typically grouped into bubbles - elements with text
            const msgItems = Array.from(msgContainer.querySelectorAll('*')).filter(el => {
                const rect = el.getBoundingClientRect();
                // Message bubbles: reasonable size, visible
                if (rect.height < 15 || rect.height > 300 || rect.width < 50) return false;
                if (rect.top < 0 || rect.bottom > window.innerHeight) return false;
                // Must have direct text content
                const text = el.textContent?.trim() || '';
                if (text.length < 1 || text.length > 2000) return false;
                // Must be a leaf-ish element (not contain too many child elements)
                if (el.children.length > 5) return false;
                return true;
            });

            // Group by vertical position (messages flow top to bottom)
            const seen = new Set<string>();
            msgItems.forEach((el, idx) => {
                const text = el.textContent?.trim() || '';
                if (!text || seen.has(text)) return;

                const rect = el.getBoundingClientRect();
                // Check if this is on the right side (sent by me) or left (received)
                const centerX = rect.left + rect.width / 2;
                const containerRect = msgContainer!.getBoundingClientRect();
                const relativeX = (centerX - containerRect.left) / containerRect.width;
                const isMine = relativeX > 0.6;

                seen.add(text);
                results.push({
                    id: `zalo_msg_${idx}`,
                    content: text,
                    senderType: isMine ? 'me' : 'other',
                    senderName: isMine ? 'Bạn' : 'Khách',
                    createdAt: new Date().toISOString(),
                    type: 'text',
                });
            });

            return results;
        });
    } catch (err) {
        console.error('[ZaloScrape] Failed to scrape messages:', err);
        return [];
    }
}
