import { EncryptionService } from './src/services/encryption.service';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
    try {
        const enc = new EncryptionService();
        const original = "1234567890123456"; // رقم حساب تجريبي
        const encrypted = enc.encrypt(original);
        const decrypted = enc.decrypt(encrypted);

        console.log("✅ Encryption Test:", original === decrypted ? "PASSED" : "FAILED");
        console.log("Original:", original);
        console.log("Encrypted:", encrypted);
    } catch (e: any) {
        console.error("❌ Encryption Error:", e.message);
        console.error("تأكد من وجود ENCRYPTION_KEY في .env");
    }
}

test();
