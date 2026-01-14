/**
 * Error Sanitization Module
 *
 * Ensures no sensitive data leaks through error messages to clients.
 * Sanitizes error messages before they are sent in HTTP responses.
 */

// Patterns that might indicate sensitive data in error messages
const SENSITIVE_PATTERNS: RegExp[] = [
  // API keys and tokens
  /\b(sk_live_[a-zA-Z0-9]{24,})\b/gi,
  /\b(sk_test_[a-zA-Z0-9]{24,})\b/gi,
  /\b(pk_live_[a-zA-Z0-9]{24,})\b/gi,
  /\b(pk_test_[a-zA-Z0-9]{24,})\b/gi,
  /\b(api[_-]?key[=:]\s*['"]?)[a-zA-Z0-9_-]{20,}(['"]?)/gi,
  /\b(bearer\s+)[a-zA-Z0-9._-]{20,}/gi,

  // Database connection strings
  /postgres(ql)?:\/\/[^\s]+/gi,
  /mysql:\/\/[^\s]+/gi,
  /mongodb(\+srv)?:\/\/[^\s]+/gi,
  /redis:\/\/[^\s]+/gi,

  // Email addresses (might be sensitive in error context)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // IP addresses (internal)
  /\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g,
  /\b(172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})\b/g,
  /\b(192\.168\.\d{1,3}\.\d{1,3})\b/g,

  // File paths that might reveal system structure
  /\/home\/[^\s\/]+/gi,
  /\/Users\/[^\s\/]+/gi,
  /C:\\Users\\[^\s\\]+/gi,

  // JWT tokens
  /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,

  // Password-related content
  /password[=:]\s*['"]?[^\s'"]+['"]?/gi,
  /pwd[=:]\s*['"]?[^\s'"]+['"]?/gi,
  /secret[=:]\s*['"]?[^\s'"]+['"]?/gi,

  // Credit card numbers (basic pattern)
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,

  // SSN pattern
  /\b\d{3}-\d{2}-\d{4}\b/g,

  // AWS keys
  /\b(AKIA[0-9A-Z]{16})\b/g,
  /\b(aws[_-]?secret[_-]?access[_-]?key[=:]\s*)[a-zA-Z0-9/+=]{40}/gi,
];

// Keywords that indicate the error message contains sensitive context
const SENSITIVE_KEYWORDS = [
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'api-key',
  'authorization',
  'auth_token',
  'access_token',
  'refresh_token',
  'private_key',
  'privatekey',
  'private-key',
  'credit_card',
  'creditcard',
  'credit-card',
  'ssn',
  'social_security',
  'stripe_key',
  'stripekey',
  'stripe-key',
  'database_url',
  'db_password',
  'connection_string',
];

/**
 * Sanitize a single error message
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') {
    return 'An error occurred';
  }

  let sanitized = message;

  // Replace known sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  return sanitized;
}

/**
 * Check if an error message contains sensitive keywords
 */
export function containsSensitiveData(message: string): boolean {
  if (!message || typeof message !== 'string') {
    return false;
  }

  const lowerMessage = message.toLowerCase();

  // Check for sensitive keywords
  for (const keyword of SENSITIVE_KEYWORDS) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      return true;
    }
  }

  // Check for sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0; // Reset regex state
    if (pattern.test(message)) {
      return true;
    }
  }

  return false;
}

/**
 * Get a safe error message for client response
 * If the message contains sensitive data, return a generic message
 */
export function getSafeErrorMessage(
  message: string,
  fallbackMessage = 'An error occurred'
): string {
  if (!message || typeof message !== 'string') {
    return fallbackMessage;
  }

  if (containsSensitiveData(message)) {
    return fallbackMessage;
  }

  return sanitizeErrorMessage(message);
}

/**
 * Sanitize error details/objects that might contain sensitive data
 */
export function sanitizeErrorDetails(details: unknown): unknown {
  if (details === null || details === undefined) {
    return details;
  }

  if (typeof details === 'string') {
    return sanitizeErrorMessage(details);
  }

  if (Array.isArray(details)) {
    return details.map(item => sanitizeErrorDetails(item));
  }

  if (typeof details === 'object') {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();

      // Check if the key itself indicates sensitive data
      const isSensitiveKey = SENSITIVE_KEYWORDS.some(
        keyword => lowerKey.includes(keyword.toLowerCase())
      );

      if (isSensitiveKey) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        sanitized[key] = sanitizeErrorMessage(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeErrorDetails(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  return details;
}

/**
 * Create a production-safe error from any error
 */
export function createSafeError(
  error: unknown,
  isProduction: boolean = process.env.NODE_ENV === 'production'
): { message: string; details?: unknown } {
  const defaultMessage = 'An unexpected error occurred';

  if (error instanceof Error) {
    const message = isProduction
      ? getSafeErrorMessage(error.message, defaultMessage)
      : sanitizeErrorMessage(error.message);

    return { message };
  }

  if (typeof error === 'string') {
    const message = isProduction
      ? getSafeErrorMessage(error, defaultMessage)
      : sanitizeErrorMessage(error);

    return { message };
  }

  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    const message = typeof errObj.message === 'string'
      ? (isProduction
          ? getSafeErrorMessage(errObj.message, defaultMessage)
          : sanitizeErrorMessage(errObj.message))
      : defaultMessage;

    const details = errObj.details
      ? sanitizeErrorDetails(errObj.details)
      : undefined;

    return { message, details };
  }

  return { message: defaultMessage };
}
