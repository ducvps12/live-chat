import { decryptSecret, encryptSecret } from '../../infra/secretVault';

export const MASKED_EMAIL_SECRET = '***';

type TransportConfig = Record<string, unknown>;

const asConfig = (value: unknown): TransportConfig => (
    value && typeof value === 'object' && !Array.isArray(value)
        ? { ...(value as TransportConfig) }
        : {}
);

const secretValue = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

/** Encrypt a newly supplied SMTP/IMAP password before it reaches Prisma. */
export function protectEmailTransportConfig(value: unknown): TransportConfig {
    const config = asConfig(value);
    const password = secretValue(config.password);
    if (password && password !== MASKED_EMAIL_SECRET) {
        config.password = encryptSecret(password);
    } else {
        delete config.password;
    }
    return config;
}
/**
 * Merge a partial account update without ever replacing the stored secret with
 * the UI mask. Preserved legacy plaintext is opportunistically encrypted.
 */
export function mergeProtectedEmailTransportConfig(
    storedValue: unknown,
    incomingValue: unknown,
): TransportConfig {
    const stored = asConfig(storedValue);
    const incoming = asConfig(incomingValue);
    const incomingPassword = secretValue(incoming.password);
    const storedPassword = secretValue(stored.password);
    const merged = { ...stored, ...incoming };

    if (!incomingPassword || incomingPassword === MASKED_EMAIL_SECRET) {
        if (storedPassword) merged.password = encryptSecret(storedPassword);
        else delete merged.password;
    } else {
        merged.password = encryptSecret(incomingPassword);
    }
    return merged;
}

/** Decrypt only inside server-side delivery/connection code; legacy plaintext remains readable. */
export function revealEmailTransportConfig(value: unknown): TransportConfig {
    const config = asConfig(value);
    const password = secretValue(config.password);
    if (password) config.password = decryptSecret(password);
    return config;
}

/** Return a response-safe copy. */
export function maskEmailTransportConfig(value: unknown): TransportConfig {
    const config = asConfig(value);
    if (secretValue(config.password)) config.password = MASKED_EMAIL_SECRET;
    return config;
}
