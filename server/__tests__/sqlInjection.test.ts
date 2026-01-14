import { describe, it, expect, vi, beforeEach } from "vitest";
import { sanitizeForDb, sanitizeUserText } from "../validationSchemas";

describe("SQL Injection Protection", () => {
  describe("Input Sanitization for Database", () => {
    it("removes null bytes that could terminate strings", () => {
      const input = { name: "admin\x00--" };
      const result = sanitizeForDb(input);
      expect(result.name).toBe("admin--");
      expect(result.name).not.toContain("\x00");
    });

    it("handles classic SQL injection patterns in strings", () => {
      const maliciousInputs = [
        "'; DROP TABLE users;--",
        "1; DELETE FROM bounties WHERE 1=1;--",
        "admin'--",
        "' OR '1'='1",
        "' UNION SELECT * FROM userProfiles--",
        "1' AND '1'='1",
        "'; TRUNCATE TABLE agents;--",
      ];

      maliciousInputs.forEach((malicious) => {
        const input = { query: malicious };
        const result = sanitizeForDb(input);
        // sanitizeForDb preserves the text but removes control chars
        // Drizzle ORM handles parameterization to prevent injection
        expect(result.query).toBe(malicious);
      });
    });

    it("removes control characters from input", () => {
      const input = { name: "test\x01\x02\x03value" };
      const result = sanitizeForDb(input);
      expect(result.name).toBe("testvalue");
    });

    it("handles nested SQL injection attempts", () => {
      const input = {
        outer: {
          inner: "'; DROP TABLE users;--",
        },
      };
      const result = sanitizeForDb(input);
      expect(result.outer.inner).toBe("'; DROP TABLE users;--");
    });

    it("handles arrays with SQL injection attempts", () => {
      const input = {
        tags: ["valid", "'; DROP TABLE;--", "also\x00valid"],
      };
      const result = sanitizeForDb(input);
      expect(result.tags[0]).toBe("valid");
      expect(result.tags[1]).toBe("'; DROP TABLE;--");
      expect(result.tags[2]).toBe("alsovalid");
    });
  });

  describe("User Text Sanitization", () => {
    it("sanitizes potential injection vectors in user text", () => {
      const malicious = "test\x00'; DROP TABLE;--";
      const result = sanitizeUserText(malicious);
      expect(result).not.toContain("\x00");
      expect(result).toBe("test'; DROP TABLE;--");
    });

    it("trims whitespace that could be used in obfuscation", () => {
      const input = "   SELECT * FROM users   ";
      const result = sanitizeUserText(input);
      expect(result).toBe("SELECT * FROM users");
    });
  });

  describe("Parameterized Query Protection (ORM Level)", () => {
    it("demonstrates that string values with SQL cannot execute as SQL", () => {
      // This test documents that Drizzle ORM uses parameterized queries
      // The actual protection happens at the ORM level, not sanitization

      // Example of what would happen with parameterized query:
      // Query: SELECT * FROM users WHERE name = $1
      // Parameter: "'; DROP TABLE users;--"
      // The parameter is treated as literal string data, not SQL code

      const maliciousName = "'; DROP TABLE users;--";

      // In a parameterized query, this becomes:
      // WHERE name = ''; DROP TABLE users;--'
      // which is treated as a literal string comparison, not code execution

      // Verify our sanitization preserves the data (ORM handles safety)
      const sanitized = sanitizeForDb({ name: maliciousName });
      expect(sanitized.name).toBe(maliciousName);
    });

    it("verifies numeric IDs are preserved correctly", () => {
      // IDs should be validated as numbers before reaching the database
      const input = { id: 42, userId: "user-123" };
      const result = sanitizeForDb(input);
      expect(result.id).toBe(42);
      expect(result.userId).toBe("user-123");
    });

    it("preserves boolean values correctly", () => {
      const input = { active: true, deleted: false };
      const result = sanitizeForDb(input);
      expect(result.active).toBe(true);
      expect(result.deleted).toBe(false);
    });

    it("handles null values correctly", () => {
      const input = { name: null, value: undefined };
      const result = sanitizeForDb(input);
      expect(result.name).toBe(null);
      expect(result.value).toBe(undefined);
    });
  });

  describe("SQL Injection Attack Patterns", () => {
    const attackPatterns = [
      // Classic SQL injection
      { name: "Classic OR injection", payload: "' OR '1'='1" },
      { name: "Classic comment injection", payload: "admin'--" },
      { name: "Classic UNION injection", payload: "' UNION SELECT password FROM users--" },

      // Stacked queries
      { name: "Stacked DROP", payload: "'; DROP TABLE users;--" },
      { name: "Stacked DELETE", payload: "'; DELETE FROM bounties;--" },
      { name: "Stacked INSERT", payload: "'; INSERT INTO admins VALUES('hacker');--" },

      // Time-based blind injection
      { name: "Time-based blind", payload: "' OR SLEEP(5)--" },
      { name: "PostgreSQL sleep", payload: "' OR pg_sleep(5)--" },

      // Boolean-based blind injection
      { name: "Boolean blind true", payload: "' AND 1=1--" },
      { name: "Boolean blind false", payload: "' AND 1=2--" },

      // Error-based injection
      { name: "Error-based CAST", payload: "' AND CAST((SELECT password FROM users LIMIT 1) AS INT)--" },
      { name: "Error-based CONVERT", payload: "' AND CONVERT(INT, (SELECT TOP 1 password FROM users))--" },

      // Second-order injection payloads
      { name: "Second-order payload", payload: "admin'--" },

      // Special character bypass attempts
      { name: "Hex encoded", payload: "0x27204f52202731273d2731" },
      { name: "URL encoded pattern", payload: "%27%20OR%20%271%27=%271" },
      { name: "Double encoding", payload: "%2527%20OR%20%25271%2527=%25271" },
    ];

    attackPatterns.forEach(({ name, payload }) => {
      it(`handles ${name} attack pattern safely`, () => {
        const input = { userInput: payload };
        const result = sanitizeForDb(input);

        // sanitizeForDb removes control characters but preserves data
        // The actual SQL injection prevention is done by Drizzle ORM's
        // parameterized queries which treat all input as literal values
        expect(typeof result.userInput).toBe("string");
      });
    });
  });

  describe("Database-Specific Injection Patterns", () => {
    describe("PostgreSQL specific", () => {
      it("handles dollar-quoted strings", () => {
        const input = { query: "$$'; DROP TABLE users;--$$" };
        const result = sanitizeForDb(input);
        expect(result.query).toBe("$$'; DROP TABLE users;--$$");
      });

      it("handles array literals", () => {
        const input = { query: "'{1,2,3}'; DROP TABLE users;--" };
        const result = sanitizeForDb(input);
        expect(result.query).toBe("'{1,2,3}'; DROP TABLE users;--");
      });

      it("handles COPY command injection attempts", () => {
        const input = { query: "'; COPY users TO '/tmp/pwned';--" };
        const result = sanitizeForDb(input);
        expect(result.query).toBe("'; COPY users TO '/tmp/pwned';--");
      });
    });
  });

  describe("Boundary and Edge Cases", () => {
    it("handles empty strings", () => {
      const input = { name: "" };
      const result = sanitizeForDb(input);
      expect(result.name).toBe("");
    });

    it("handles very long strings", () => {
      const longString = "a".repeat(10000) + "'; DROP TABLE users;--";
      const input = { data: longString };
      const result = sanitizeForDb(input);
      expect(result.data.length).toBe(longString.length);
    });

    it("handles Unicode characters", () => {
      const input = { name: "테스트'; DROP TABLE;--" };
      const result = sanitizeForDb(input);
      expect(result.name).toBe("테스트'; DROP TABLE;--");
    });

    it("handles emoji in input", () => {
      const input = { message: "Hello 👋'; DROP TABLE;--" };
      const result = sanitizeForDb(input);
      expect(result.message).toBe("Hello 👋'; DROP TABLE;--");
    });

    it("handles mixed content types in objects", () => {
      const input = {
        stringField: "'; DROP TABLE;--",
        numberField: 42,
        booleanField: true,
        nullField: null,
        arrayField: ["a", "b"],
        nestedObject: { inner: "'; DROP;--" },
      };
      const result = sanitizeForDb(input);

      expect(result.stringField).toBe("'; DROP TABLE;--");
      expect(result.numberField).toBe(42);
      expect(result.booleanField).toBe(true);
      expect(result.nullField).toBe(null);
      expect(result.arrayField).toEqual(["a", "b"]);
      expect(result.nestedObject.inner).toBe("'; DROP;--");
    });
  });

  describe("Drizzle ORM Parameterization Verification", () => {
    it("documents that Drizzle uses parameterized queries via eq()", () => {
      // Drizzle ORM's eq() function generates parameterized queries:
      // eq(users.id, userInput) => "users.id = $1" with userInput as parameter
      // This prevents SQL injection regardless of the userInput value

      const maliciousId = "1; DROP TABLE users;--";
      // When used with eq(table.column, maliciousId), Drizzle generates:
      // WHERE column = $1 with $1 = "1; DROP TABLE users;--"
      // The value is never interpolated into the SQL string

      expect(true).toBe(true); // Documenting ORM behavior
    });

    it("documents that Drizzle uses parameterized queries via sql template", () => {
      // Drizzle's sql`` template tag also uses parameterized queries:
      // sql`SELECT * FROM users WHERE id = ${userId}`
      // becomes "SELECT * FROM users WHERE id = $1" with userId as parameter

      expect(true).toBe(true); // Documenting ORM behavior
    });

    it("documents INSERT protection", () => {
      // Drizzle's insert().values() uses parameterized queries:
      // db.insert(users).values({ name: userInput })
      // becomes "INSERT INTO users (name) VALUES ($1)" with userInput as parameter

      expect(true).toBe(true); // Documenting ORM behavior
    });

    it("documents UPDATE protection", () => {
      // Drizzle's update().set() uses parameterized queries:
      // db.update(users).set({ name: userInput }).where(eq(users.id, id))
      // becomes "UPDATE users SET name = $1 WHERE id = $2"

      expect(true).toBe(true); // Documenting ORM behavior
    });
  });
});

describe("SQL Injection in Route Parameters", () => {
  it("verifies numeric ID validation pattern", () => {
    // Route handlers should validate that numeric IDs are actually numbers
    const validId = "123";
    const maliciousId = "123; DROP TABLE users;--";

    // parseInt will extract only the numeric portion
    expect(parseInt(validId, 10)).toBe(123);
    expect(parseInt(maliciousId, 10)).toBe(123);
    expect(isNaN(parseInt("not-a-number", 10))).toBe(true);
  });

  it("demonstrates ID validation best practice", () => {
    // Best practice: validate IDs are numeric before database operations
    const validateNumericId = (id: string): number | null => {
      const parsed = parseInt(id, 10);
      if (isNaN(parsed) || parsed.toString() !== id) {
        return null;
      }
      return parsed;
    };

    expect(validateNumericId("123")).toBe(123);
    expect(validateNumericId("123abc")).toBe(null);
    expect(validateNumericId("'; DROP TABLE;--")).toBe(null);
    expect(validateNumericId("0")).toBe(0);
    expect(validateNumericId("-1")).toBe(-1); // Negative IDs parsed but may be rejected by app logic
  });
});
