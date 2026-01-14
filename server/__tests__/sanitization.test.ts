import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import {
  sanitizeHtml,
  stripHtml,
  sanitizeForDb,
  sanitizeUserText,
  sanitizeObject,
} from "../validationSchemas";
import {
  sanitizeRequestBody,
  sanitizeQueryParams,
  sanitizeRouteParams,
  sanitizeAllInput,
  sanitizeFields,
} from "../sanitizationMiddleware";

describe("Sanitization Utilities", () => {
  describe("sanitizeHtml", () => {
    it("escapes HTML tags", () => {
      expect(sanitizeHtml("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;"
      );
    });

    it("escapes double quotes", () => {
      expect(sanitizeHtml('"><img src=x onerror=alert(1)>')).toBe(
        "&quot;&gt;&lt;img src&#x3D;x onerror&#x3D;alert(1)&gt;"
      );
    });

    it("escapes ampersands", () => {
      expect(sanitizeHtml("&amp;&lt;")).toBe("&amp;amp;&amp;lt;");
    });

    it("escapes backticks", () => {
      expect(sanitizeHtml("`${alert(1)}`")).toBe("&#x60;${alert(1)}&#x60;");
    });

    it("handles non-string input gracefully", () => {
      expect(sanitizeHtml(null as any)).toBe("");
      expect(sanitizeHtml(undefined as any)).toBe("");
      expect(sanitizeHtml(123 as any)).toBe("");
    });

    it("preserves safe text", () => {
      expect(sanitizeHtml("Hello World")).toBe("Hello World");
    });
  });

  describe("stripHtml", () => {
    it("removes all HTML tags", () => {
      expect(stripHtml("<p>Hello <strong>World</strong></p>")).toBe(
        "Hello World"
      );
    });

    it("removes script tags and content marker", () => {
      expect(stripHtml("<script>alert(1)</script>")).toBe("alert(1)");
    });

    it("handles self-closing tags", () => {
      expect(stripHtml("<br/><hr/>text")).toBe("text");
    });

    it("handles non-string input gracefully", () => {
      expect(stripHtml(null as any)).toBe("");
      expect(stripHtml(undefined as any)).toBe("");
    });
  });

  describe("sanitizeForDb", () => {
    it("removes null bytes from strings", () => {
      const input = { name: "test\x00value" };
      expect(sanitizeForDb(input)).toEqual({ name: "testvalue" });
    });

    it("removes control characters", () => {
      const input = { name: "test\x01\x02\x03value" };
      expect(sanitizeForDb(input)).toEqual({ name: "testvalue" });
    });

    it("preserves newlines and tabs", () => {
      const input = { name: "test\n\tvalue" };
      expect(sanitizeForDb(input)).toEqual({ name: "test\n\tvalue" });
    });

    it("handles nested objects", () => {
      const input = { outer: { inner: "test\x00value" } };
      expect(sanitizeForDb(input)).toEqual({ outer: { inner: "testvalue" } });
    });

    it("handles arrays of strings", () => {
      const input = { items: ["test\x00one", "test\x00two"] };
      expect(sanitizeForDb(input)).toEqual({
        items: ["testone", "testtwo"],
      });
    });

    it("handles arrays of objects", () => {
      const input = { items: [{ name: "test\x00value" }] };
      expect(sanitizeForDb(input)).toEqual({
        items: [{ name: "testvalue" }],
      });
    });

    it("preserves non-string values", () => {
      const input = { count: 42, active: true, data: null };
      expect(sanitizeForDb(input)).toEqual({
        count: 42,
        active: true,
        data: null,
      });
    });
  });

  describe("sanitizeUserText", () => {
    it("removes javascript: protocol", () => {
      expect(sanitizeUserText("javascript:alert(1)")).toBe("alert(1)");
    });

    it("removes vbscript: protocol", () => {
      expect(sanitizeUserText("vbscript:msgbox(1)")).toBe("msgbox(1)");
    });

    it("neutralizes data: protocol", () => {
      expect(sanitizeUserText("data:text/html,<script>")).toBe(
        "data\u200B:text/html,<script>"
      );
    });

    it("removes event handlers", () => {
      expect(sanitizeUserText("onclick=alert(1)")).toBe("alert(1)");
      expect(sanitizeUserText("onerror=alert(1)")).toBe("alert(1)");
      expect(sanitizeUserText("ONMOUSEOVER=alert(1)")).toBe("alert(1)");
    });

    it("removes control characters", () => {
      expect(sanitizeUserText("test\x00\x01\x02value")).toBe("testvalue");
    });

    it("trims whitespace", () => {
      expect(sanitizeUserText("  hello world  ")).toBe("hello world");
    });

    it("handles non-string input gracefully", () => {
      expect(sanitizeUserText(null as any)).toBe("");
      expect(sanitizeUserText(undefined as any)).toBe("");
    });

    it("preserves safe text", () => {
      expect(sanitizeUserText("Hello World! How are you?")).toBe(
        "Hello World! How are you?"
      );
    });
  });

  describe("sanitizeObject", () => {
    it("sanitizes all string fields", () => {
      const input = {
        title: "  test\x00title  ",
        description: "javascript:alert(1)",
      };
      expect(sanitizeObject(input)).toEqual({
        title: "testtitle",
        description: "alert(1)",
      });
    });

    it("sanitizes nested objects", () => {
      const input = {
        outer: { inner: "  test\x00value  " },
      };
      expect(sanitizeObject(input)).toEqual({
        outer: { inner: "testvalue" },
      });
    });

    it("sanitizes arrays of strings", () => {
      const input = { tags: ["  tag1\x00  ", "javascript:tag2"] };
      expect(sanitizeObject(input)).toEqual({
        tags: ["tag1", "tag2"],
      });
    });

    it("applies HTML escaping when requested", () => {
      const input = { content: "<script>alert(1)</script>" };
      expect(sanitizeObject(input, true)).toEqual({
        content: "&lt;script&gt;alert(1)&lt;&#x2F;script&gt;",
      });
    });

    it("preserves non-string values", () => {
      const input = { count: 42, active: true };
      expect(sanitizeObject(input)).toEqual({ count: 42, active: true });
    });
  });
});

describe("Sanitization Middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  describe("sanitizeRequestBody", () => {
    it("sanitizes body string fields", () => {
      mockReq.body = { title: "<script>alert(1)</script>" };
      sanitizeRequestBody(mockReq as Request, mockRes as Response, mockNext);
      expect(mockReq.body.title).toBe("<script>alert(1)</script>");
      expect(mockNext).toHaveBeenCalled();
    });

    it("handles missing body gracefully", () => {
      mockReq.body = undefined;
      sanitizeRequestBody(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("sanitizeQueryParams", () => {
    it("sanitizes query string values", () => {
      mockReq.query = { search: "javascript:alert(1)" };
      sanitizeQueryParams(mockReq as Request, mockRes as Response, mockNext);
      expect(mockReq.query.search).toBe("alert(1)");
      expect(mockNext).toHaveBeenCalled();
    });

    it("handles missing query gracefully", () => {
      mockReq.query = undefined as any;
      sanitizeQueryParams(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("sanitizeRouteParams", () => {
    it("sanitizes route params", () => {
      mockReq.params = { id: "123\x00" };
      sanitizeRouteParams(mockReq as Request, mockRes as Response, mockNext);
      expect(mockReq.params.id).toBe("123");
      expect(mockNext).toHaveBeenCalled();
    });

    it("handles missing params gracefully", () => {
      mockReq.params = undefined as any;
      sanitizeRouteParams(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("sanitizeAllInput", () => {
    it("sanitizes body, query, and params", () => {
      mockReq.body = { title: "javascript:test" };
      mockReq.query = { q: "vbscript:test" };
      mockReq.params = { id: "123\x00" };

      sanitizeAllInput(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.title).toBe("test");
      expect(mockReq.query.q).toBe("test");
      expect(mockReq.params.id).toBe("123");
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("sanitizeFields", () => {
    it("sanitizes specific fields only", () => {
      const middleware = sanitizeFields(["title", "content"]);
      mockReq.body = {
        title: "<script>",
        content: "javascript:test",
        other: "<script>",
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.title).toBe("<script>");
      expect(mockReq.body.content).toBe("test");
      expect(mockReq.body.other).toBe("<script>");
      expect(mockNext).toHaveBeenCalled();
    });

    it("sanitizes nested fields with dot notation", () => {
      const middleware = sanitizeFields(["user.name"]);
      mockReq.body = {
        user: { name: "javascript:test" },
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.user.name).toBe("test");
      expect(mockNext).toHaveBeenCalled();
    });

    it("applies HTML escaping when requested", () => {
      const middleware = sanitizeFields(["title"], true);
      mockReq.body = { title: "<script>alert(1)</script>" };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.title).toBe(
        "&lt;script&gt;alert(1)&lt;&#x2F;script&gt;"
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it("handles missing body gracefully", () => {
      const middleware = sanitizeFields(["title"]);
      mockReq.body = undefined;

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});

describe("XSS Prevention Scenarios", () => {
  describe("Common XSS Vectors", () => {
    it("prevents IMG onerror injection", () => {
      const input = '<img src=x onerror="alert(1)">';
      expect(sanitizeHtml(input)).not.toContain("<img");
      expect(sanitizeHtml(input)).not.toContain("onerror");
    });

    it("prevents SVG onload injection", () => {
      const input = '<svg onload="alert(1)">';
      expect(sanitizeHtml(input)).not.toContain("<svg");
      expect(sanitizeHtml(input)).not.toContain("onload");
    });

    it("prevents BODY onload injection", () => {
      const input = '<body onload="alert(1)">';
      expect(sanitizeHtml(input)).not.toContain("<body");
    });

    it("prevents IFRAME srcdoc injection", () => {
      const input = '<iframe srcdoc="<script>alert(1)</script>">';
      expect(sanitizeHtml(input)).not.toContain("<iframe");
      expect(sanitizeHtml(input)).not.toContain("<script");
    });

    it("prevents JavaScript in href", () => {
      const input = '<a href="javascript:alert(1)">click</a>';
      expect(sanitizeUserText(input)).not.toContain("javascript:");
    });

    it("prevents CSS expression injection", () => {
      const input = '<div style="background:url(javascript:alert(1))">';
      expect(sanitizeUserText(input)).not.toContain("javascript:");
    });

    it("prevents Unicode obfuscation", () => {
      const input = "java\u0000script:alert(1)";
      expect(sanitizeUserText(input)).not.toContain("javascript:");
    });
  });

  describe("Event Handler Stripping", () => {
    const eventHandlers = [
      "onclick",
      "onmouseover",
      "onmouseout",
      "onload",
      "onerror",
      "onfocus",
      "onblur",
      "onsubmit",
      "onreset",
      "onchange",
      "onkeydown",
      "onkeyup",
    ];

    eventHandlers.forEach((handler) => {
      it(`removes ${handler} event handler`, () => {
        const input = `${handler}=alert(1)`;
        expect(sanitizeUserText(input)).not.toContain(handler);
      });
    });
  });
});
