import prisma from '../../infra/prisma';
import { aiService } from '../ai/ai.service';
import { systemNotificationService } from './system-notification.service';

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_INITIAL_DELAY_MS = 15_000;

function parseBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value !== 'string' && typeof value !== 'boolean') return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
}

function boundedDelay(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
}

/**
 * Lightweight dependency monitor. It reports state transitions only; the
 * notification layer adds a second dedup/rate-limit barrier.
 */
export function startRuntimeHealthMonitor(): () => void {
    const enabled = parseBoolean(
        process.env.HEALTH_MONITOR_ENABLED,
        process.env.NODE_ENV === 'production',
    );
    if (!enabled) return () => undefined;

    const monitorAi = parseBoolean(process.env.HEALTH_MONITOR_AI_ENABLED, false);
    const intervalMs = boundedDelay(
        process.env.HEALTH_MONITOR_INTERVAL_MS,
        DEFAULT_INTERVAL_MS,
        30_000,
        15 * 60_000,
    );
    const initialDelayMs = boundedDelay(
        process.env.HEALTH_MONITOR_INITIAL_DELAY_MS,
        DEFAULT_INITIAL_DELAY_MS,
        1_000,
        intervalMs,
    );
    const state = new Map<string, boolean>();
    let stopped = false;
    let running = false;
    let timer: NodeJS.Timeout | undefined;

    const record = async (
        component: string,
        healthy: boolean,
        status: string,
        detail?: string,
    ) => {
        const previous = state.get(component);
        state.set(component, healthy);
        if (!healthy && previous !== false) {
            const outcome = await systemNotificationService.healthDegraded({
                component,
                status,
                detail,
                ...(component === 'database' ? { envOnly: true } : {}),
            });
            // A transient Telegram failure is retried on the next monitor pass.
            // Disabled or unconfigured notifications remain quiet by design.
            if (outcome === 'failed') state.delete(component);
        } else if (healthy && previous === false) {
            await systemNotificationService.healthRecovered({ component });
        }
    };

    const run = async () => {
        if (stopped || running) return;
        running = true;
        try {
            try {
                await prisma.$queryRaw`SELECT 1`;
                await record('database', true, 'online');
            } catch (error) {
                await record(
                    'database',
                    false,
                    'offline',
                    error instanceof Error ? error.name : 'database_error',
                );
            }

            if (monitorAi) {
                try {
                    const ai = await aiService.status();
                    await record(
                        'ai_provider',
                        ai.status === 'online',
                        ai.status,
                        `${ai.provider}:${ai.modelAvailable ? 'model_available' : 'model_unavailable'}`,
                    );
                } catch (error) {
                    await record(
                        'ai_provider',
                        false,
                        'offline',
                        error instanceof Error ? error.name : 'ai_provider_error',
                    );
                }
            }
        } finally {
            running = false;
            if (!stopped) {
                timer = setTimeout(run, intervalMs);
                timer.unref();
            }
        }
    };

    timer = setTimeout(run, initialDelayMs);
    timer.unref();

    return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
    };
}
