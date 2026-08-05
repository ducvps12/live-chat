import crypto from 'crypto';
import { env } from '../config/env';

const SECRET_PREFIX = 'enc:v1:';

function encryptionKey(): Buffer {
    const source = process.env.SETTINGS_ENCRYPTION_KEY || env.JWT_SECRET;
    if (!source || source.length < 32) {
        throw new Error('SETTINGS_ENCRYPTION_KEY or JWT_SECRET must contain at least 32 characters');
    }
    return crypto.createHash('sha256').update(source, 'utf8').digest();
}

export function isEncryptedSecret(value: string): boolean {
    return value.startsWith(SECRET_PREFIX);
}

export function encryptSecret(value: string): string {
    if (!value || isEncryptedSecret(value)) return value;

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(value, 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
        SECRET_PREFIX.slice(0, -1),
        iv.toString('base64url'),
        authTag.toString('base64url'),
        encrypted.toString('base64url'),
    ].join(':');
}

export function decryptSecret(value: string): string {
    if (!value || !isEncryptedSecret(value)) return value;

    const parts = value.split(':');
    if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
        throw new Error('Encrypted setting has an invalid format');
    }

    const iv = Buffer.from(parts[2], 'base64url');
    const authTag = Buffer.from(parts[3], 'base64url');
    const encrypted = Buffer.from(parts[4], 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
    ]).toString('utf8');
}
