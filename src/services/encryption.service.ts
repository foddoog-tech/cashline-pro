import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export class EncryptionService {
    private key: Buffer;

    constructor() {
        const keyString = process.env.ENCRYPTION_KEY;
        if (!keyString || keyString.length < 32) {
            throw new Error('ENCRYPTION_KEY must be at least 32 characters');
        }
        this.key = scryptSync(keyString, 'salt', 32);
    }

    encrypt(text: string): string {
        const iv = randomBytes(16);
        const cipher = createCipheriv(ALGORITHM, this.key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    }

    decrypt(encryptedData: string): string {
        const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
        const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}
