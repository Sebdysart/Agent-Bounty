import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { db } from "./db";
import { sql } from "drizzle-orm";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// Get or generate encryption key from environment
function getEncryptionKey(): Buffer {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.SESSION_SECRET || "default-dev-key-change-in-production";
  const salt = process.env.CREDENTIAL_ENCRYPTION_SALT || "bountyai-vault-salt";
  return scryptSync(secret, salt, KEY_LENGTH);
}

interface EncryptedData {
  iv: string;
  authTag: string;
  data: string;
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  
  const authTag = cipher.getAuthTag();
  
  const result: EncryptedData = {
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    data: encrypted
  };
  
  return Buffer.from(JSON.stringify(result)).toString("base64");
}

export function decrypt(encryptedString: string): string {
  const key = getEncryptionKey();
  const parsed: EncryptedData = JSON.parse(Buffer.from(encryptedString, "base64").toString("utf8"));
  
  const iv = Buffer.from(parsed.iv, "base64");
  const authTag = Buffer.from(parsed.authTag, "base64");
  const encryptedData = parsed.data;
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

// Encrypted credential vault with database persistence
export interface StoredCredentials {
  credentials: Record<string, string>;
  expiresAt: Date;
  userId: string;
  agentId: number;
  requirementId: number;
  encryptedAt: Date;
}

interface VaultEntry {
  encryptedCredentials: string;
  metadata: Omit<StoredCredentials, "credentials">;
}

// In-memory cache for fast access
const memoryCache = new Map<number, VaultEntry>();

class EncryptedVault {
  private initialized = false;
  
  constructor() {
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }
  
  private async ensureTable(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Create table if not exists for persistent credential storage
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS encrypted_credentials (
          id SERIAL PRIMARY KEY,
          consent_id INTEGER UNIQUE NOT NULL,
          encrypted_data TEXT NOT NULL,
          user_id VARCHAR NOT NULL,
          agent_id INTEGER NOT NULL,
          requirement_id INTEGER NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          encrypted_at TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Create index for faster lookups
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_encrypted_credentials_consent_id 
        ON encrypted_credentials(consent_id)
      `);
      
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_encrypted_credentials_expires_at 
        ON encrypted_credentials(expires_at)
      `);
      
      this.initialized = true;
      console.log("Encrypted credentials table initialized");
    } catch (error) {
      console.error("Failed to initialize encrypted credentials table:", error);
      // Fall back to memory-only mode
      this.initialized = true;
    }
  }
  
  async set(consentId: number, data: StoredCredentials): Promise<void> {
    await this.ensureTable();
    
    const { credentials, ...metadata } = data;
    const encryptedCredentials = encrypt(JSON.stringify(credentials));
    
    const entry: VaultEntry = {
      encryptedCredentials,
      metadata: {
        ...metadata,
        encryptedAt: new Date()
      }
    };
    
    // Store in memory cache
    memoryCache.set(consentId, entry);
    
    // Persist to database
    try {
      await db.execute(sql`
        INSERT INTO encrypted_credentials (consent_id, encrypted_data, user_id, agent_id, requirement_id, expires_at, encrypted_at)
        VALUES (
          ${consentId}, 
          ${encryptedCredentials}, 
          ${data.userId}, 
          ${data.agentId}, 
          ${data.requirementId}, 
          ${data.expiresAt}, 
          NOW()
        )
        ON CONFLICT (consent_id) DO UPDATE SET
          encrypted_data = ${encryptedCredentials},
          expires_at = ${data.expiresAt},
          encrypted_at = NOW()
      `);
    } catch (error) {
      console.error("Failed to persist credentials to database:", error);
      // Continue with memory-only storage
    }
  }
  
  async get(consentId: number): Promise<StoredCredentials | null> {
    await this.ensureTable();
    
    // Check memory cache first
    let entry = memoryCache.get(consentId);
    
    // If not in cache, try database
    if (!entry) {
      try {
        const result = await db.execute(sql`
          SELECT encrypted_data, user_id, agent_id, requirement_id, expires_at, encrypted_at
          FROM encrypted_credentials
          WHERE consent_id = ${consentId}
        `);
        
        if (result.rows.length > 0) {
          const row = result.rows[0] as any;
          entry = {
            encryptedCredentials: row.encrypted_data,
            metadata: {
              userId: row.user_id,
              agentId: row.agent_id,
              requirementId: row.requirement_id,
              expiresAt: new Date(row.expires_at),
              encryptedAt: new Date(row.encrypted_at)
            }
          };
          // Populate cache
          memoryCache.set(consentId, entry);
        }
      } catch (error) {
        console.error("Failed to retrieve credentials from database:", error);
      }
    }
    
    if (!entry) return null;
    
    // Check expiration
    if (new Date(entry.metadata.expiresAt) < new Date()) {
      await this.delete(consentId);
      return null;
    }
    
    try {
      const credentials = JSON.parse(decrypt(entry.encryptedCredentials));
      return {
        credentials,
        ...entry.metadata
      };
    } catch (error) {
      console.error("Failed to decrypt credentials:", error);
      return null;
    }
  }
  
  async delete(consentId: number): Promise<boolean> {
    await this.ensureTable();
    
    memoryCache.delete(consentId);
    
    try {
      await db.execute(sql`
        DELETE FROM encrypted_credentials WHERE consent_id = ${consentId}
      `);
      return true;
    } catch (error) {
      console.error("Failed to delete credentials from database:", error);
      return false;
    }
  }
  
  async has(consentId: number): Promise<boolean> {
    const entry = await this.get(consentId);
    return entry !== null;
  }
  
  async getMetadata(consentId: number): Promise<Omit<StoredCredentials, "credentials"> | null> {
    await this.ensureTable();
    
    const entry = memoryCache.get(consentId);
    
    if (entry) {
      if (new Date(entry.metadata.expiresAt) < new Date()) {
        await this.delete(consentId);
        return null;
      }
      return entry.metadata;
    }
    
    // Try database
    try {
      const result = await db.execute(sql`
        SELECT user_id, agent_id, requirement_id, expires_at, encrypted_at
        FROM encrypted_credentials
        WHERE consent_id = ${consentId} AND expires_at > NOW()
      `);
      
      if (result.rows.length > 0) {
        const row = result.rows[0] as any;
        return {
          userId: row.user_id,
          agentId: row.agent_id,
          requirementId: row.requirement_id,
          expiresAt: new Date(row.expires_at),
          encryptedAt: new Date(row.encrypted_at)
        };
      }
    } catch (error) {
      console.error("Failed to get metadata from database:", error);
    }
    
    return null;
  }
  
  private async cleanup(): Promise<void> {
    const now = new Date();
    
    // Clean memory cache
    memoryCache.forEach((entry, consentId) => {
      if (new Date(entry.metadata.expiresAt) < now) {
        memoryCache.delete(consentId);
      }
    });
    
    // Clean database
    try {
      await db.execute(sql`
        DELETE FROM encrypted_credentials WHERE expires_at < NOW()
      `);
    } catch (error) {
      console.error("Failed to cleanup expired credentials:", error);
    }
  }
  
  // Get count of stored credentials (for monitoring)
  async size(): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as count FROM encrypted_credentials WHERE expires_at > NOW()
      `);
      return parseInt((result.rows[0] as any)?.count || "0");
    } catch {
      return memoryCache.size;
    }
  }
  
  // Clear all (for emergency/testing)
  async clear(): Promise<void> {
    memoryCache.clear();
    try {
      await db.execute(sql`DELETE FROM encrypted_credentials`);
    } catch (error) {
      console.error("Failed to clear credentials table:", error);
    }
  }
  
  // Load all active credentials into memory cache on startup
  async warmCache(): Promise<void> {
    await this.ensureTable();
    
    try {
      const result = await db.execute(sql`
        SELECT consent_id, encrypted_data, user_id, agent_id, requirement_id, expires_at, encrypted_at
        FROM encrypted_credentials
        WHERE expires_at > NOW()
      `);
      
      for (const row of result.rows as any[]) {
        memoryCache.set(row.consent_id, {
          encryptedCredentials: row.encrypted_data,
          metadata: {
            userId: row.user_id,
            agentId: row.agent_id,
            requirementId: row.requirement_id,
            expiresAt: new Date(row.expires_at),
            encryptedAt: new Date(row.encrypted_at)
          }
        });
      }
      
      console.log(`Warmed credential cache with ${memoryCache.size} entries`);
    } catch (error) {
      console.error("Failed to warm cache:", error);
    }
  }
}

export const encryptedVault = new EncryptedVault();
