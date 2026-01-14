import { Request, Response, NextFunction } from "express";
import { jwtService } from "./jwtService";
import { sendUnauthorized, sendForbidden, ErrorCode } from "./errorResponse";

interface TokenPayload {
  userId: string;
  roles: string[];
  permissions: string[];
  exp: number;
  iat: number;
  jti: string;
}

declare global {
  namespace Express {
    interface Request {
      tokenPayload?: TokenPayload;
      authUserId?: string;
      authRoles?: string[];
    }
  }
}

export function validateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.substring(7);
  const payload = jwtService.validateAccessToken(token);
  
  if (payload) {
    req.tokenPayload = payload;
  }
  
  next();
}

export function requireJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return sendUnauthorized(res, "Access token required", ErrorCode.TOKEN_REQUIRED);
  }

  const token = authHeader.substring(7);
  const payload = jwtService.validateAccessToken(token);

  if (!payload) {
    return sendUnauthorized(res, "Invalid or expired access token", ErrorCode.TOKEN_INVALID);
  }

  req.tokenPayload = payload;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const payload = req.tokenPayload;

    if (!payload) {
      return sendUnauthorized(res, "Authentication required", ErrorCode.AUTH_REQUIRED);
    }

    const hasRole = roles.some(role => payload.roles.includes(role));
    if (!hasRole) {
      return sendForbidden(res, "Insufficient permissions", ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    next();
  };
}

export function requirePermission(resource: string, action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const payload = req.tokenPayload;

    if (!payload) {
      return sendUnauthorized(res, "Authentication required", ErrorCode.AUTH_REQUIRED);
    }

    if (!jwtService.hasPermission(payload, resource, action)) {
      return sendForbidden(res, "Insufficient permissions", ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    next();
  };
}

export async function requireAdmin(req: any, res: Response, next: NextFunction) {
  const userId = req.user?.claims?.sub || req.tokenPayload?.userId;

  if (!userId) {
    return sendUnauthorized(res, "Authentication required", ErrorCode.AUTH_REQUIRED);
  }

  const roles = await jwtService.getUserRoles(userId);

  if (!roles.includes("admin")) {
    const adminUserIds = process.env.ADMIN_USER_IDS?.split(",") || [];
    if (!adminUserIds.includes(userId)) {
      return sendForbidden(res, "Admin access required", ErrorCode.ADMIN_REQUIRED);
    }
  }

  next();
}

export function hybridAuth(req: any, res: Response, next: NextFunction) {
  const sessionUserId = req.user?.claims?.sub;
  const jwtUserId = req.tokenPayload?.userId;
  const jwtRoles = req.tokenPayload?.roles;

  if (!sessionUserId && !jwtUserId) {
    return sendUnauthorized(res, "Authentication required", ErrorCode.AUTH_REQUIRED);
  }

  req.authUserId = jwtUserId || sessionUserId;
  req.authRoles = jwtRoles || ['viewer'];

  next();
}

export async function hybridAuthWithRoles(req: any, res: Response, next: NextFunction) {
  const sessionUserId = req.user?.claims?.sub;
  const jwtUserId = req.tokenPayload?.userId;
  const jwtRoles = req.tokenPayload?.roles;

  if (!sessionUserId && !jwtUserId) {
    return sendUnauthorized(res, "Authentication required", ErrorCode.AUTH_REQUIRED);
  }

  req.authUserId = jwtUserId || sessionUserId;

  if (jwtRoles) {
    req.authRoles = jwtRoles;
  } else {
    req.authRoles = await jwtService.getUserRoles(req.authUserId);
  }

  next();
}
