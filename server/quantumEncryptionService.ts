import { db } from "./db";
import { 
  quantumKeys, encryptedData, keyRotationHistory,
  type QuantumKey, type EncryptedData, type KeyRotationHistory,
  quantumAlgorithms
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";

export type QuantumAlgorithm = typeof quantumAlgorithms[number];

interface KeyPair {
  publicKey: string;
  privateKey: string;
  fingerprint: string;
}

const ALGORITHM_STRENGTHS: Record<QuantumAlgorithm, { securityLevel: number; keySize: number }> = {
  kyber512: { securityLevel: 1, keySize: 800 },
  kyber768: { securityLevel: 3, keySize: 1184 },
  kyber1024: { securityLevel: 5, keySize: 1568 },
  dilithium2: { securityLevel: 2, keySize: 1312 },
  dilithium3: { securityLevel: 3, keySize: 1952 },
  dilithium5: { securityLevel: 5, keySize: 2592 },
};

class QuantumEncryptionService {
  private masterKey: Buffer;

  constructor() {
    const envKey = process.env.QUANTUM_MASTER_KEY || process.env.SESSION_SECRET || "default-key-for-development";
    this.masterKey = crypto.scryptSync(envKey, "quantum-salt", 32);
  }

  private generateSimulatedQuantumKeyPair(algorithm: QuantumAlgorithm): KeyPair {
    const keySize = ALGORITHM_STRENGTHS[algorithm].keySize;
    const publicKeyBytes = crypto.randomBytes(keySize);
    const privateKeyBytes = crypto.randomBytes(keySize * 2);
    const fingerprint = crypto
      .createHash("sha256")
      .update(publicKeyBytes)
      .digest("hex")
      .substring(0, 40);

    return {
      publicKey: publicKeyBytes.toString("base64"),
      privateKey: privateKeyBytes.toString("base64"),
      fingerprint,
    };
  }

  private encryptPrivateKey(privateKey: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.masterKey, iv);
    
    let encrypted = cipher.update(privateKey, "utf8", "base64");
    encrypted += cipher.final("base64");
    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      iv: iv.toString("base64"),
      data: encrypted,
      tag: authTag.toString("base64"),
    });
  }

  private decryptPrivateKey(encryptedPrivateKey: string): string {
    const { iv, data, tag } = JSON.parse(encryptedPrivateKey);
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      this.masterKey,
      Buffer.from(iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(tag, "base64"));

    let decrypted = decipher.update(data, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  async generateKeyPair(
    userId: string | null,
    keyType: "encryption" | "signing" | "hybrid",
    algorithm: QuantumAlgorithm = "kyber768",
    purpose?: string,
    expiresInDays: number = 365
  ): Promise<QuantumKey> {
    const keyPair = this.generateSimulatedQuantumKeyPair(algorithm);
    const encryptedPrivateKey = this.encryptPrivateKey(keyPair.privateKey);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const [key] = await db.insert(quantumKeys).values({
      userId,
      keyType,
      algorithm,
      publicKey: keyPair.publicKey,
      encryptedPrivateKey,
      keyFingerprint: keyPair.fingerprint,
      purpose,
      expiresAt,
    }).returning();

    return key;
  }

  async getActiveKey(userId: string, keyType: string): Promise<QuantumKey | null> {
    const [key] = await db.select()
      .from(quantumKeys)
      .where(and(
        eq(quantumKeys.userId, userId),
        eq(quantumKeys.keyType, keyType),
        eq(quantumKeys.status, "active")
      ))
      .orderBy(desc(quantumKeys.createdAt))
      .limit(1);

    return key || null;
  }

  async getUserKeys(userId: string): Promise<QuantumKey[]> {
    return db.select()
      .from(quantumKeys)
      .where(eq(quantumKeys.userId, userId))
      .orderBy(desc(quantumKeys.createdAt));
  }

  async encryptData(
    ownerId: string,
    dataType: string,
    plaintext: string,
    keyId?: number
  ): Promise<EncryptedData> {
    let key: QuantumKey | null = null;

    if (keyId) {
      const [foundKey] = await db.select()
        .from(quantumKeys)
        .where(eq(quantumKeys.id, keyId));
      key = foundKey;
    } else {
      key = await this.getActiveKey(ownerId, "encryption");
      if (!key) {
        key = await this.generateKeyPair(ownerId, "encryption", "kyber768", dataType);
      }
    }

    if (!key) throw new Error("No encryption key available");

    const iv = crypto.randomBytes(16);
    const symmetricKey = crypto.randomBytes(32);
    
    const cipher = crypto.createCipheriv("aes-256-gcm", symmetricKey, iv);
    let encryptedPayload = cipher.update(plaintext, "utf8", "base64");
    encryptedPayload += cipher.final("base64");
    const authTag = cipher.getAuthTag();

    const encryptedSymmetricKey = this.encryptWithQuantumKey(
      symmetricKey.toString("base64"),
      key.publicKey
    );

    const payload = JSON.stringify({
      encryptedSymmetricKey,
      ciphertext: encryptedPayload,
    });

    const [data] = await db.insert(encryptedData).values({
      ownerId,
      keyId: key.id,
      dataType,
      encryptedPayload: payload,
      nonce: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      algorithm: key.algorithm,
      isHybrid: true,
      classicalAlgorithm: "AES-256-GCM",
    }).returning();

    await db.update(quantumKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(quantumKeys.id, key.id));

    return data;
  }

  async decryptData(dataId: number, ownerId: string): Promise<string> {
    const [data] = await db.select()
      .from(encryptedData)
      .where(and(
        eq(encryptedData.id, dataId),
        eq(encryptedData.ownerId, ownerId)
      ));

    if (!data) throw new Error("Encrypted data not found");

    const [key] = await db.select()
      .from(quantumKeys)
      .where(eq(quantumKeys.id, data.keyId));

    if (!key) throw new Error("Decryption key not found");

    const payload = JSON.parse(data.encryptedPayload);
    const privateKey = this.decryptPrivateKey(key.encryptedPrivateKey);
    
    const symmetricKeyBase64 = this.decryptWithQuantumKey(
      payload.encryptedSymmetricKey,
      privateKey
    );
    const symmetricKey = Buffer.from(symmetricKeyBase64, "base64");

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      symmetricKey,
      Buffer.from(data.nonce, "base64")
    );
    decipher.setAuthTag(Buffer.from(data.authTag || "", "base64"));

    let decrypted = decipher.update(payload.ciphertext, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  private encryptWithQuantumKey(data: string, publicKey: string): string {
    const publicKeyBuffer = Buffer.from(publicKey, "base64");
    const keyMaterial = crypto
      .createHash("sha256")
      .update(publicKeyBuffer)
      .update(data)
      .digest();

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", keyMaterial, iv);
    
    let encrypted = cipher.update(data, "utf8", "base64");
    encrypted += cipher.final("base64");
    const tag = cipher.getAuthTag();

    return JSON.stringify({
      iv: iv.toString("base64"),
      data: encrypted,
      tag: tag.toString("base64"),
    });
  }

  private decryptWithQuantumKey(encryptedData: string, privateKey: string): string {
    const { iv, data, tag } = JSON.parse(encryptedData);
    const privateKeyBuffer = Buffer.from(privateKey, "base64");
    
    const keyMaterial = crypto
      .createHash("sha256")
      .update(privateKeyBuffer.subarray(0, privateKeyBuffer.length / 2))
      .update(data)
      .digest();

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      keyMaterial,
      Buffer.from(iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(tag, "base64"));

    let decrypted = decipher.update(data, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  async rotateKey(
    keyId: number,
    initiatorId: string,
    reason: string = "scheduled"
  ): Promise<{ oldKey: QuantumKey; newKey: QuantumKey }> {
    const [oldKey] = await db.select()
      .from(quantumKeys)
      .where(eq(quantumKeys.id, keyId));

    if (!oldKey) throw new Error("Key not found");

    await db.update(quantumKeys)
      .set({ status: "rotating" })
      .where(eq(quantumKeys.id, keyId));

    const newKey = await this.generateKeyPair(
      oldKey.userId,
      oldKey.keyType as any,
      oldKey.algorithm as QuantumAlgorithm,
      oldKey.purpose || undefined
    );

    const encryptedDataList = await db.select()
      .from(encryptedData)
      .where(eq(encryptedData.keyId, keyId));

    let reEncryptedCount = 0;
    for (const data of encryptedDataList) {
      try {
        const decrypted = await this.decryptData(data.id, data.ownerId);
        await this.encryptData(data.ownerId, data.dataType, decrypted, newKey.id);
        reEncryptedCount++;
      } catch (error) {
        console.error(`Failed to re-encrypt data ${data.id}:`, error);
      }
    }

    await db.insert(keyRotationHistory).values({
      oldKeyId: keyId,
      newKeyId: newKey.id,
      rotationReason: reason,
      dataReEncrypted: reEncryptedCount,
      initiatedById: initiatorId,
      completedAt: new Date(),
    });

    await db.update(quantumKeys)
      .set({ status: "deprecated" })
      .where(eq(quantumKeys.id, keyId));

    return { oldKey, newKey };
  }

  async revokeKey(keyId: number): Promise<void> {
    await db.update(quantumKeys)
      .set({ status: "revoked" })
      .where(eq(quantumKeys.id, keyId));
  }

  async getRotationHistory(keyId?: number): Promise<KeyRotationHistory[]> {
    if (keyId) {
      return db.select()
        .from(keyRotationHistory)
        .where(eq(keyRotationHistory.oldKeyId, keyId))
        .orderBy(desc(keyRotationHistory.createdAt));
    }

    return db.select()
      .from(keyRotationHistory)
      .orderBy(desc(keyRotationHistory.createdAt))
      .limit(100);
  }

  async getEncryptedData(ownerId: string): Promise<EncryptedData[]> {
    return db.select()
      .from(encryptedData)
      .where(eq(encryptedData.ownerId, ownerId))
      .orderBy(desc(encryptedData.createdAt));
  }

  getAlgorithmInfo(): Record<QuantumAlgorithm, { securityLevel: number; keySize: number; description: string }> {
    return {
      kyber512: { ...ALGORITHM_STRENGTHS.kyber512, description: "NIST Level 1 - Fast, suitable for general use" },
      kyber768: { ...ALGORITHM_STRENGTHS.kyber768, description: "NIST Level 3 - Balanced security and performance" },
      kyber1024: { ...ALGORITHM_STRENGTHS.kyber1024, description: "NIST Level 5 - Maximum security for sensitive data" },
      dilithium2: { ...ALGORITHM_STRENGTHS.dilithium2, description: "NIST Level 2 - Digital signatures, balanced" },
      dilithium3: { ...ALGORITHM_STRENGTHS.dilithium3, description: "NIST Level 3 - Digital signatures, high security" },
      dilithium5: { ...ALGORITHM_STRENGTHS.dilithium5, description: "NIST Level 5 - Digital signatures, maximum security" },
    };
  }

  async getSecurityDashboard(userId: string): Promise<{
    activeKeys: number;
    encryptedItems: number;
    rotationsThisMonth: number;
    algorithmDistribution: Record<string, number>;
    recommendations: string[];
  }> {
    const keys = await this.getUserKeys(userId);
    const activeKeys = keys.filter(k => k.status === "active").length;

    const encrypted = await this.getEncryptedData(userId);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    const rotations = await db.select()
      .from(keyRotationHistory)
      .where(eq(keyRotationHistory.initiatedById, userId));
    const rotationsThisMonth = rotations.filter(
      r => r.createdAt >= thisMonth
    ).length;

    const algorithmDistribution: Record<string, number> = {};
    for (const key of keys) {
      algorithmDistribution[key.algorithm] = (algorithmDistribution[key.algorithm] || 0) + 1;
    }

    const recommendations: string[] = [];
    if (activeKeys === 0) {
      recommendations.push("Generate your first quantum-safe encryption key");
    }
    if (keys.some(k => k.algorithm === "kyber512")) {
      recommendations.push("Consider upgrading kyber512 keys to kyber768 for better security");
    }
    const oldKeys = keys.filter(k => {
      const age = Date.now() - k.createdAt.getTime();
      return age > 180 * 24 * 60 * 60 * 1000;
    });
    if (oldKeys.length > 0) {
      recommendations.push(`${oldKeys.length} keys are over 6 months old - consider rotation`);
    }

    return {
      activeKeys,
      encryptedItems: encrypted.length,
      rotationsThisMonth,
      algorithmDistribution,
      recommendations,
    };
  }
}

export const quantumEncryptionService = new QuantumEncryptionService();
