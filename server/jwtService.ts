import { db } from './db';
import { refreshTokens, userRoleAssignments, rolePermissions } from '@shared/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';
import crypto from 'crypto';

const ACCESS_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface TokenPayload {
  userId: string;
  roles: string[];
  permissions: string[];
  exp: number;
  iat: number;
  jti: string;
}

class JWTService {
  private secret: string;

  constructor() {
    this.secret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
  }

  private base64UrlEncode(data: string): string {
    return Buffer.from(data).toString('base64url');
  }

  private base64UrlDecode(data: string): string {
    return Buffer.from(data, 'base64url').toString('utf8');
  }

  private sign(payload: object): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private verify(token: string): TokenPayload | null {
    try {
      const [encodedHeader, encodedPayload, signature] = token.split('.');
      const expectedSignature = crypto
        .createHmac('sha256', this.secret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64url');

      if (signature !== expectedSignature) {
        return null;
      }

      const payload = JSON.parse(this.base64UrlDecode(encodedPayload)) as TokenPayload;
      
      if (payload.exp < Date.now()) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  async generateTokenPair(userId: string, deviceInfo?: string, ipAddress?: string) {
    const roles = await this.getUserRoles(userId);
    const permissions = await this.getRolePermissions(roles);

    const now = Date.now();
    const jti = crypto.randomUUID();

    const accessToken = this.sign({
      userId,
      roles,
      permissions,
      exp: now + ACCESS_TOKEN_EXPIRY_MS,
      iat: now,
      jti,
    });

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshExpiry = new Date(now + REFRESH_TOKEN_EXPIRY_MS);

    await db.insert(refreshTokens).values({
      userId,
      token: refreshToken,
      deviceInfo,
      ipAddress,
      expiresAt: refreshExpiry,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_MS / 1000,
      tokenType: 'Bearer',
    };
  }

  async refreshAccessToken(refreshToken: string, ipAddress?: string) {
    const [tokenRecord] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.token, refreshToken),
          gt(refreshTokens.expiresAt, new Date()),
          isNull(refreshTokens.revokedAt)
        )
      );

    if (!tokenRecord) {
      return null;
    }

    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, tokenRecord.id));

    return this.generateTokenPair(tokenRecord.userId, tokenRecord.deviceInfo || undefined, ipAddress);
  }

  async revokeRefreshToken(token: string) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.token, token));
  }

  async revokeAllUserTokens(userId: string) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }

  validateAccessToken(token: string): TokenPayload | null {
    return this.verify(token);
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const assignments = await db
      .select()
      .from(userRoleAssignments)
      .where(eq(userRoleAssignments.userId, userId));

    const activeRoles = assignments
      .filter(a => !a.expiresAt || a.expiresAt > new Date())
      .map(a => a.role);

    return activeRoles.length > 0 ? activeRoles : ['viewer'];
  }

  async getRolePermissions(roles: string[]): Promise<string[]> {
    if (roles.length === 0) return [];

    const allPermissions = await db.select().from(rolePermissions);
    
    const userPermissions = allPermissions
      .filter(p => roles.includes(p.role))
      .map(p => `${p.resource}:${p.action}`);

    return [...new Set(userPermissions)];
  }

  async assignRole(userId: string, role: string, grantedBy?: string, expiresAt?: Date) {
    return db.insert(userRoleAssignments).values({
      userId,
      role: role as any,
      grantedBy,
      expiresAt,
    }).returning();
  }

  async removeRole(userId: string, role: string) {
    await db
      .delete(userRoleAssignments)
      .where(and(eq(userRoleAssignments.userId, userId), eq(userRoleAssignments.role, role as any)));
  }

  hasPermission(payload: TokenPayload, resource: string, action: string): boolean {
    const requiredPermission = `${resource}:${action}`;
    return payload.permissions.includes(requiredPermission) || 
           payload.permissions.includes(`${resource}:manage`) ||
           payload.roles.includes('admin');
  }
}

export const jwtService = new JWTService();
