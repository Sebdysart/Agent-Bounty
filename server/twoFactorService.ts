import crypto from "crypto";
import { storage } from "./storage";
import type { SecuritySettings } from "@shared/schema";

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function toBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return output;
}

function fromBase32(str: string): Buffer {
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  const normalized = str.toUpperCase().replace(/=+$/, "");

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

class TwoFactorService {
  private generateSecret(): string {
    return toBase32(crypto.randomBytes(20));
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      codes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
    }
    return codes;
  }

  generateTOTP(secret: string, timeStep: number = 30): string {
    const time = Math.floor(Date.now() / 1000 / timeStep);
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigInt64BE(BigInt(time));

    const keyBuffer = fromBase32(secret);
    const hmac = crypto.createHmac("sha1", keyBuffer);
    hmac.update(timeBuffer);
    const hash = hmac.digest();

    const offset = hash[hash.length - 1] & 0x0f;
    const code = ((hash[offset] & 0x7f) << 24 |
                  (hash[offset + 1] & 0xff) << 16 |
                  (hash[offset + 2] & 0xff) << 8 |
                  (hash[offset + 3] & 0xff)) % 1000000;

    return code.toString().padStart(6, "0");
  }

  verifyTOTP(secret: string, token: string, window: number = 1): boolean {
    for (let i = -window; i <= window; i++) {
      const time = Math.floor(Date.now() / 1000 / 30) + i;
      const timeBuffer = Buffer.alloc(8);
      timeBuffer.writeBigInt64BE(BigInt(time));

      const keyBuffer = fromBase32(secret);
      const hmac = crypto.createHmac("sha1", keyBuffer);
      hmac.update(timeBuffer);
      const hash = hmac.digest();

      const offset = hash[hash.length - 1] & 0x0f;
      const code = ((hash[offset] & 0x7f) << 24 |
                    (hash[offset + 1] & 0xff) << 16 |
                    (hash[offset + 2] & 0xff) << 8 |
                    (hash[offset + 3] & 0xff)) % 1000000;

      if (token === code.toString().padStart(6, "0")) {
        return true;
      }
    }
    return false;
  }

  async setup(userId: string): Promise<{ secret: string; backupCodes: string[]; qrCodeUrl: string }> {
    const secret = this.generateSecret();
    const backupCodes = this.generateBackupCodes();
    
    await storage.updateSecuritySettings(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: secret,
      backupCodes,
    });

    const issuer = "BountyAI";
    const qrCodeUrl = `otpauth://totp/${issuer}:${userId}?secret=${secret}&issuer=${issuer}`;

    return { secret, backupCodes, qrCodeUrl };
  }

  async enable(userId: string, token: string): Promise<{ success: boolean; error?: string }> {
    const settings = await storage.getSecuritySettings(userId);
    if (!settings?.twoFactorSecret) {
      return { success: false, error: "2FA not set up. Please run setup first." };
    }

    if (!this.verifyTOTP(settings.twoFactorSecret, token)) {
      return { success: false, error: "Invalid verification code" };
    }

    await storage.updateSecuritySettings(userId, { twoFactorEnabled: true });
    await storage.logSecurityEvent({
      userId,
      eventType: "2fa_enabled",
      success: true,
    });

    return { success: true };
  }

  async disable(userId: string, token: string): Promise<{ success: boolean; error?: string }> {
    const settings = await storage.getSecuritySettings(userId);
    if (!settings?.twoFactorEnabled || !settings.twoFactorSecret) {
      return { success: false, error: "2FA is not enabled" };
    }

    if (!this.verifyTOTP(settings.twoFactorSecret, token)) {
      const backupCodes = settings.backupCodes || [];
      const backupValid = backupCodes.includes(token.toUpperCase());
      if (!backupValid) {
        return { success: false, error: "Invalid verification code or backup code" };
      }
      const newBackupCodes = backupCodes.filter(c => c !== token.toUpperCase());
      await storage.updateSecuritySettings(userId, { backupCodes: newBackupCodes });
    }

    await storage.updateSecuritySettings(userId, { 
      twoFactorEnabled: false, 
      twoFactorSecret: null,
      backupCodes: [],
    });
    await storage.logSecurityEvent({
      userId,
      eventType: "2fa_disabled",
      success: true,
    });

    return { success: true };
  }

  async verify(userId: string, token: string): Promise<{ success: boolean; error?: string }> {
    const settings = await storage.getSecuritySettings(userId);
    if (!settings?.twoFactorEnabled || !settings.twoFactorSecret) {
      return { success: true };
    }

    if (this.verifyTOTP(settings.twoFactorSecret, token)) {
      return { success: true };
    }

    const backupCodes = settings.backupCodes || [];
    const backupValid = backupCodes.includes(token.toUpperCase());
    if (backupValid) {
      const newBackupCodes = backupCodes.filter(c => c !== token.toUpperCase());
      await storage.updateSecuritySettings(userId, { backupCodes: newBackupCodes });
      return { success: true };
    }

    return { success: false, error: "Invalid verification code" };
  }

  async requires2FA(userId: string, action: "upload" | "publish" | "payment"): Promise<boolean> {
    const settings = await storage.getSecuritySettings(userId);
    if (!settings?.twoFactorEnabled) return false;

    if (action === "upload") return settings.uploadRequires2fa || false;
    if (action === "publish") return settings.publishRequires2fa || false;
    if (action === "payment") return true;

    return false;
  }
}

export const twoFactorService = new TwoFactorService();
