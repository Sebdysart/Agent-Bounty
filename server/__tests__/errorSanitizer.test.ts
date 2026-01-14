import { describe, it, expect } from "vitest";
import {
  sanitizeErrorMessage,
  containsSensitiveData,
  getSafeErrorMessage,
  sanitizeErrorDetails,
  createSafeError,
} from "../errorSanitizer";

describe("errorSanitizer", () => {
  describe("sanitizeErrorMessage", () => {
    it("returns default message for null/undefined input", () => {
      expect(sanitizeErrorMessage(null as any)).toBe("An error occurred");
      expect(sanitizeErrorMessage(undefined as any)).toBe("An error occurred");
    });

    it("returns default message for non-string input", () => {
      expect(sanitizeErrorMessage(123 as any)).toBe("An error occurred");
      expect(sanitizeErrorMessage({} as any)).toBe("An error occurred");
    });

    it("redacts Stripe live API keys", () => {
      const message = "Error with key sk_live_FAKEFAKEFAKEFAKE";
      expect(sanitizeErrorMessage(message)).toBe("Error with key [REDACTED]");
    });

    it("redacts Stripe test API keys", () => {
      const message = "Invalid key: sk_test_FAKEFAKEFAKEFAKE";
      expect(sanitizeErrorMessage(message)).toBe("Invalid key: [REDACTED]");
    });

    it("redacts Stripe publishable keys", () => {
      const message = "Key pk_live_FAKEFAKEFAKEFAKE is invalid";
      expect(sanitizeErrorMessage(message)).toBe("Key [REDACTED] is invalid");
    });

    it("redacts database connection strings", () => {
      const pgMessage = "Failed to connect to postgres://user:pass@localhost:5432/db";
      expect(sanitizeErrorMessage(pgMessage)).toContain("[REDACTED]");

      const mongoMessage = "MongoDB error: mongodb+srv://user:pass@cluster.mongodb.net";
      expect(sanitizeErrorMessage(mongoMessage)).toContain("[REDACTED]");
    });

    it("redacts JWT tokens", () => {
      const message = "Token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U is expired";
      expect(sanitizeErrorMessage(message)).toBe("Token [REDACTED] is expired");
    });

    it("redacts email addresses", () => {
      const message = "User john.doe@example.com not found";
      expect(sanitizeErrorMessage(message)).toBe("User [REDACTED] not found");
    });

    it("redacts internal IP addresses", () => {
      const message = "Cannot connect to 192.168.1.100";
      expect(sanitizeErrorMessage(message)).toBe("Cannot connect to [REDACTED]");

      const message2 = "Server at 10.0.0.1 is down";
      expect(sanitizeErrorMessage(message2)).toBe("Server at [REDACTED] is down");
    });

    it("redacts file paths with usernames", () => {
      const message = "File not found: /Users/johndoe/secrets.txt";
      expect(sanitizeErrorMessage(message)).toContain("[REDACTED]");

      const message2 = "Cannot read /home/admin/config.json";
      expect(sanitizeErrorMessage(message2)).toContain("[REDACTED]");
    });

    it("redacts password-like content", () => {
      const message = "Authentication failed: password=secretpass123";
      expect(sanitizeErrorMessage(message)).toContain("[REDACTED]");
    });

    it("redacts AWS access key IDs", () => {
      const message = "AWS error with key AKIAIOSFODNN7EXAMPLE";
      expect(sanitizeErrorMessage(message)).toBe("AWS error with key [REDACTED]");
    });

    it("redacts credit card patterns", () => {
      const message = "Payment failed for card 4242-4242-4242-4242";
      expect(sanitizeErrorMessage(message)).toBe("Payment failed for card [REDACTED]");
    });

    it("redacts SSN patterns", () => {
      const message = "Invalid SSN: 123-45-6789";
      expect(sanitizeErrorMessage(message)).toBe("Invalid SSN: [REDACTED]");
    });

    it("preserves non-sensitive error messages", () => {
      const message = "Bounty not found with id 123";
      expect(sanitizeErrorMessage(message)).toBe("Bounty not found with id 123");
    });

    it("handles multiple sensitive patterns in one message", () => {
      const message = "User john@test.com with key sk_test_FAKEFAKEFAKEFAKE failed";
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).not.toContain("john@test.com");
      expect(sanitized).not.toContain("sk_test");
      expect(sanitized.match(/\[REDACTED\]/g)?.length).toBe(2);
    });
  });

  describe("containsSensitiveData", () => {
    it("returns false for null/undefined", () => {
      expect(containsSensitiveData(null as any)).toBe(false);
      expect(containsSensitiveData(undefined as any)).toBe(false);
    });

    it("detects password keyword", () => {
      expect(containsSensitiveData("Invalid password provided")).toBe(true);
      expect(containsSensitiveData("PASSWORD_HASH is null")).toBe(true);
    });

    it("detects secret keyword", () => {
      expect(containsSensitiveData("Missing client_secret")).toBe(true);
    });

    it("detects token keyword", () => {
      expect(containsSensitiveData("Access token expired")).toBe(true);
      expect(containsSensitiveData("Invalid refresh_token")).toBe(true);
    });

    it("detects api_key variations", () => {
      expect(containsSensitiveData("api_key is missing")).toBe(true);
      expect(containsSensitiveData("Invalid apiKey")).toBe(true);
      expect(containsSensitiveData("api-key required")).toBe(true);
    });

    it("detects Stripe key patterns", () => {
      expect(containsSensitiveData("sk_live_FAKEFAKEFAKEFAKE error")).toBe(true);
    });

    it("detects database URL keyword", () => {
      expect(containsSensitiveData("DATABASE_URL not configured")).toBe(true);
    });

    it("detects JWT token pattern", () => {
      const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
      expect(containsSensitiveData(`Token ${jwt} expired`)).toBe(true);
    });

    it("returns false for safe messages", () => {
      expect(containsSensitiveData("Bounty not found")).toBe(false);
      expect(containsSensitiveData("User does not have permission")).toBe(false);
      expect(containsSensitiveData("Invalid status transition")).toBe(false);
    });
  });

  describe("getSafeErrorMessage", () => {
    it("returns fallback for sensitive messages", () => {
      expect(getSafeErrorMessage("Password: abc123")).toBe("An error occurred");
      expect(getSafeErrorMessage("api_key missing", "Custom fallback")).toBe("Custom fallback");
    });

    it("sanitizes and returns non-keyword sensitive data", () => {
      // Contains pattern but no keyword
      const message = "Error at 192.168.1.1";
      const result = getSafeErrorMessage(message);
      expect(result).toBe("Error at [REDACTED]");
    });

    it("returns original message if no sensitive data", () => {
      expect(getSafeErrorMessage("User not found")).toBe("User not found");
    });

    it("returns fallback for null/undefined", () => {
      expect(getSafeErrorMessage(null as any)).toBe("An error occurred");
      expect(getSafeErrorMessage(undefined as any, "Custom")).toBe("Custom");
    });
  });

  describe("sanitizeErrorDetails", () => {
    it("handles null/undefined", () => {
      expect(sanitizeErrorDetails(null)).toBe(null);
      expect(sanitizeErrorDetails(undefined)).toBe(undefined);
    });

    it("sanitizes string values", () => {
      expect(sanitizeErrorDetails("Error at 10.0.0.1")).toBe("Error at [REDACTED]");
    });

    it("sanitizes arrays", () => {
      const input = ["Error at 10.0.0.1", "Normal message"];
      const result = sanitizeErrorDetails(input) as string[];
      expect(result[0]).toBe("Error at [REDACTED]");
      expect(result[1]).toBe("Normal message");
    });

    it("redacts sensitive keys in objects", () => {
      const input = {
        password: "secret123",
        apiKey: "sk_test_FAKEFAKEFAKEFAKE",
        message: "Normal error",
      };
      const result = sanitizeErrorDetails(input) as Record<string, unknown>;
      expect(result.password).toBe("[REDACTED]");
      expect(result.apiKey).toBe("[REDACTED]");
      expect(result.message).toBe("Normal error");
    });

    it("sanitizes nested objects", () => {
      const input = {
        error: {
          database_url: "postgres://user:pass@localhost",
          code: 500,
        },
        context: {
          user: "john@test.com",
        },
      };
      const result = sanitizeErrorDetails(input) as any;
      expect(result.error.database_url).toBe("[REDACTED]");
      expect(result.error.code).toBe(500);
      expect(result.context.user).toBe("[REDACTED]");
    });

    it("preserves non-sensitive data", () => {
      const input = {
        statusCode: 404,
        path: "/api/bounties/123",
        method: "GET",
      };
      const result = sanitizeErrorDetails(input) as any;
      expect(result.statusCode).toBe(404);
      expect(result.path).toBe("/api/bounties/123");
      expect(result.method).toBe("GET");
    });
  });

  describe("createSafeError", () => {
    it("handles Error instances", () => {
      const error = new Error("Database connection failed at postgres://user:pass@localhost");
      const result = createSafeError(error, false);
      expect(result.message).toContain("[REDACTED]");
    });

    it("uses generic message in production for sensitive errors", () => {
      const error = new Error("Invalid api_key provided");
      const result = createSafeError(error, true);
      expect(result.message).toBe("An unexpected error occurred");
    });

    it("handles string errors", () => {
      const result = createSafeError("Error at 192.168.1.1", false);
      expect(result.message).toBe("Error at [REDACTED]");
    });

    it("handles object errors with message property", () => {
      const error = {
        message: "Failed with token abc123",
        details: { code: 500 },
      };
      const result = createSafeError(error, false);
      expect(result.message).toBe("Failed with token abc123");
      expect(result.details).toEqual({ code: 500 });
    });

    it("handles object errors with sensitive details", () => {
      const error = {
        message: "Operation failed",
        details: {
          password: "secret",
          info: "at 10.0.0.1",
        },
      };
      const result = createSafeError(error, false);
      expect((result.details as any).password).toBe("[REDACTED]");
      expect((result.details as any).info).toBe("at [REDACTED]");
    });

    it("returns default message for unknown error types", () => {
      expect(createSafeError(null, true).message).toBe("An unexpected error occurred");
      expect(createSafeError(undefined, true).message).toBe("An unexpected error occurred");
      expect(createSafeError(123, true).message).toBe("An unexpected error occurred");
    });
  });
});
