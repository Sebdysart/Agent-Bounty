/**
 * Tests for Upstash Kafka client wrapper
 * Mocks the @upstash/kafka package to avoid real API calls
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  UpstashKafkaClient,
  NullKafkaClient,
  KafkaProducer,
  KAFKA_TOPICS,
  getKafkaClient,
  type KafkaMessage,
  type AgentExecutionMessage,
  type AgentResultMessage,
  type NotificationMessage,
  type DeadLetterMessage,
} from "../upstashKafka";
import { featureFlags } from "../featureFlags";

// Mock the @upstash/kafka module
vi.mock("@upstash/kafka", () => {
  const mockProducer = {
    produce: vi.fn(),
  };

  const mockConsumer = {
    consume: vi.fn(),
  };

  return {
    Kafka: class MockKafka {
      producer() {
        return mockProducer;
      }
      consumer() {
        return mockConsumer;
      }
    },
    Producer: class MockProducer {},
    Consumer: class MockConsumer {},
  };
});

describe("UpstashKafkaClient", () => {
  let client: UpstashKafkaClient;
  let mockProducer: { produce: ReturnType<typeof vi.fn> };
  let mockConsumer: { consume: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create client with mock config
    client = new UpstashKafkaClient({
      url: "https://mock-kafka.upstash.io",
      username: "mock-username",
      password: "mock-password",
    });

    // Get references to mocked producer/consumer
    mockProducer = (client as unknown as { producer: typeof mockProducer }).producer;
    mockConsumer = (client as unknown as { consumer: typeof mockConsumer }).consumer;

    // Access internal producer/consumer
    const internalClient = client as unknown as {
      producer: typeof mockProducer;
      consumer: typeof mockConsumer;
    };
    mockProducer = internalClient.producer;
    mockConsumer = internalClient.consumer;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("isAvailable", () => {
    it("should return true when configured", () => {
      expect(client.isAvailable()).toBe(true);
    });

    it("should return false when not configured", () => {
      const unconfiguredClient = new UpstashKafkaClient({});
      expect(unconfiguredClient.isAvailable()).toBe(false);
    });
  });

  describe("produce", () => {
    it("should produce a message successfully", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const result = await client.produce(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, {
        test: "data",
      });

      expect(result.success).toBe(true);
      expect(result.topic).toBe(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE);
      expect(result.partition).toBe(0);
      expect(result.offset).toBe("123");
      expect(mockProducer.produce).toHaveBeenCalledTimes(1);
    });

    it("should include idempotency key in message", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      await client.produce(
        KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        { test: "data" },
        { idempotencyKey: "unique-key-123" }
      );

      const producedMessage = JSON.parse(mockProducer.produce.mock.calls[0][1]);
      expect(producedMessage.idempotencyKey).toBe("unique-key-123");
    });

    it("should retry on failure with exponential backoff", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockProducer.produce
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ partition: 0, offset: "123" });

      const resultPromise = client.produce(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, {
        test: "data",
      });

      // Fast-forward through retry delays
      await vi.advanceTimersByTimeAsync(1000); // First retry delay
      await vi.advanceTimersByTimeAsync(2000); // Second retry delay

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(mockProducer.produce).toHaveBeenCalledTimes(3);
      consoleSpy.mockRestore();
    });

    it("should return error after max retries exceeded", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockProducer.produce.mockRejectedValue(new Error("Persistent error"));

      const resultPromise = client.produce(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, {
        test: "data",
      });

      // Fast-forward through all retry delays
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(20000);
      }

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe("Persistent error");
      expect(mockProducer.produce).toHaveBeenCalledTimes(5);
      consoleSpy.mockRestore();
    });

    it("should return error when producer not configured", async () => {
      const unconfiguredClient = new UpstashKafkaClient({});

      const result = await unconfiguredClient.produce(
        KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        { test: "data" }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Kafka producer not configured");
    });
  });

  describe("produceBatch", () => {
    it("should produce multiple messages", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const results = await client.produceBatch([
        { topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { job: 1 } },
        { topic: KAFKA_TOPICS.NOTIFICATIONS_QUEUE, data: { notif: 1 } },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe("consume", () => {
    it("should consume messages from a topic", async () => {
      const mockMessages = [
        {
          value: JSON.stringify({
            id: "msg-1",
            topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
            data: { test: "data1" },
            timestamp: Date.now(),
          }),
        },
        {
          value: JSON.stringify({
            id: "msg-2",
            topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
            data: { test: "data2" },
            timestamp: Date.now(),
          }),
        },
      ];
      mockConsumer.consume.mockResolvedValue(mockMessages);

      const result = await client.consume(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].data).toEqual({ test: "data1" });
      expect(result.messages[1].data).toEqual({ test: "data2" });
    });

    it("should respect maxMessages option", async () => {
      const mockMessages = [
        {
          value: JSON.stringify({
            id: "msg-1",
            topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
            data: { test: "data1" },
            timestamp: Date.now(),
          }),
        },
        {
          value: JSON.stringify({
            id: "msg-2",
            topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
            data: { test: "data2" },
            timestamp: Date.now(),
          }),
        },
        {
          value: JSON.stringify({
            id: "msg-3",
            topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
            data: { test: "data3" },
            timestamp: Date.now(),
          }),
        },
      ];
      mockConsumer.consume.mockResolvedValue(mockMessages);

      const result = await client.consume(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, {
        maxMessages: 2,
      });

      expect(result.messages).toHaveLength(2);
    });

    it("should skip invalid JSON messages", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const mockMessages = [
        { value: "invalid-json" },
        {
          value: JSON.stringify({
            id: "msg-1",
            topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
            data: { test: "data" },
            timestamp: Date.now(),
          }),
        },
      ];
      mockConsumer.consume.mockResolvedValue(mockMessages);

      const result = await client.consume(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE);

      expect(result.messages).toHaveLength(1);
      consoleSpy.mockRestore();
    });

    it("should return error when consumer not configured", async () => {
      const unconfiguredClient = new UpstashKafkaClient({});

      const result = await unconfiguredClient.consume(
        KAFKA_TOPICS.AGENT_EXECUTION_QUEUE
      );

      expect(result.messages).toHaveLength(0);
      expect(result.error).toBe("Kafka consumer not configured");
    });

    it("should handle consume errors", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockConsumer.consume.mockRejectedValue(new Error("Connection failed"));

      const result = await client.consume(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE);

      expect(result.messages).toHaveLength(0);
      expect(result.error).toBe("Connection failed");
      consoleSpy.mockRestore();
    });
  });

  describe("processMessages", () => {
    it("should process messages with handler", async () => {
      const mockMessages = [
        {
          value: JSON.stringify({
            id: "msg-1",
            topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
            data: { test: "data1" },
            timestamp: Date.now(),
          }),
        },
      ];
      mockConsumer.consume.mockResolvedValue(mockMessages);

      const handler = vi.fn().mockResolvedValue(undefined);

      const result = await client.processMessages(
        KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        handler
      );

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should send failed messages to DLQ after max retries", async () => {
      const mockMessages = [
        {
          value: JSON.stringify({
            id: "msg-1",
            topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
            data: { test: "data" },
            timestamp: Date.now(),
            retryCount: 4, // Already at max - 1
          }),
        },
      ];
      mockConsumer.consume.mockResolvedValue(mockMessages);
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const handler = vi.fn().mockRejectedValue(new Error("Processing failed"));

      const result = await client.processMessages(
        KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        handler
      );

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);

      // Verify DLQ message was sent
      const dlqCall = mockProducer.produce.mock.calls.find(
        (call: unknown[]) => call[0] === KAFKA_TOPICS.AGENT_EXECUTION_DLQ
      );
      expect(dlqCall).toBeDefined();
    });

    it("should retry failed messages with incremented retry count", async () => {
      const mockMessages = [
        {
          value: JSON.stringify({
            id: "msg-1",
            topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
            data: { test: "data" },
            timestamp: Date.now(),
            retryCount: 1,
          }),
        },
      ];
      mockConsumer.consume.mockResolvedValue(mockMessages);
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const handler = vi.fn().mockRejectedValue(new Error("Processing failed"));

      await client.processMessages(
        KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        handler
      );

      // Verify retry message was sent (not to DLQ)
      const retryCall = mockProducer.produce.mock.calls.find(
        (call: unknown[]) => call[0] === KAFKA_TOPICS.AGENT_EXECUTION_QUEUE
      );
      expect(retryCall).toBeDefined();
      const retryMessage = JSON.parse(retryCall[1]) as KafkaMessage;
      expect(retryMessage.retryCount).toBe(2);
    });
  });

  describe("queueAgentExecution", () => {
    it("should queue an agent execution job", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const result = await client.queueAgentExecution({
        agentId: "agent-123",
        bountyId: "bounty-456",
        code: "console.log('test')",
      });

      expect(result.success).toBe(true);
      expect(result.topic).toBe(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE);

      const producedMessage = JSON.parse(mockProducer.produce.mock.calls[0][1]);
      expect(producedMessage.data.agentId).toBe("agent-123");
      expect(producedMessage.idempotencyKey).toMatch(/^exec-agent-123-bounty-456/);
    });
  });

  describe("queueAgentResult", () => {
    it("should queue an agent execution result", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const result = await client.queueAgentResult({
        executionId: "exec-789",
        agentId: "agent-123",
        bountyId: "bounty-456",
        success: true,
        output: { result: "passed" },
        executionTimeMs: 1500,
      });

      expect(result.success).toBe(true);
      expect(result.topic).toBe(KAFKA_TOPICS.AGENT_RESULTS_QUEUE);

      const producedMessage = JSON.parse(mockProducer.produce.mock.calls[0][1]);
      expect(producedMessage.data.executionId).toBe("exec-789");
      expect(producedMessage.idempotencyKey).toBe("result-exec-789");
    });
  });

  describe("queueNotification", () => {
    it("should queue a notification", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const result = await client.queueNotification({
        type: "email",
        recipient: "user@example.com",
        subject: "Test Subject",
        body: "Test body",
      });

      expect(result.success).toBe(true);
      expect(result.topic).toBe(KAFKA_TOPICS.NOTIFICATIONS_QUEUE);

      const producedMessage = JSON.parse(mockProducer.produce.mock.calls[0][1]);
      expect(producedMessage.data.type).toBe("email");
      expect(producedMessage.data.recipient).toBe("user@example.com");
    });
  });

  describe("healthCheck", () => {
    it("should return healthy status on successful produce", async () => {
      vi.useRealTimers();
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const result = await client.healthCheck();

      expect(result.connected).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it("should return unhealthy status on produce failure", async () => {
      vi.useRealTimers();
      mockProducer.produce.mockRejectedValue(new Error("Connection refused"));

      const result = await client.healthCheck();

      expect(result.connected).toBe(false);
      expect(result.error).toBe("Connection refused");
    });

    it("should return not configured status when client not available", async () => {
      const unconfiguredClient = new UpstashKafkaClient({});

      const result = await unconfiguredClient.healthCheck();

      expect(result.connected).toBe(false);
      expect(result.error).toBe("Kafka client not configured");
    });
  });

  describe("getConsumerLag", () => {
    it("should return null (not implemented)", async () => {
      const result = await client.getConsumerLag(
        KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        "test-group"
      );

      expect(result).toBeNull();
    });
  });

  describe("KAFKA_TOPICS", () => {
    it("should have all required topics defined", () => {
      expect(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE).toBe("agent-execution-queue");
      expect(KAFKA_TOPICS.AGENT_RESULTS_QUEUE).toBe("agent-results-queue");
      expect(KAFKA_TOPICS.NOTIFICATIONS_QUEUE).toBe("notifications-queue");
      expect(KAFKA_TOPICS.AGENT_EXECUTION_DLQ).toBe("agent-execution-dlq");
    });
  });

  describe("Message Types", () => {
    it("should accept valid AgentExecutionMessage", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const executionMsg: AgentExecutionMessage = {
        agentId: "agent-123",
        bountyId: "bounty-456",
        code: "console.log('test')",
        testCases: [{ input: "a", expected: "b" }],
        metadata: { priority: "high" },
      };

      const result = await client.queueAgentExecution(executionMsg);
      expect(result.success).toBe(true);

      const producedMessage = JSON.parse(mockProducer.produce.mock.calls[0][1]);
      expect(producedMessage.data).toEqual(executionMsg);
    });

    it("should accept valid AgentResultMessage", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const resultMsg: AgentResultMessage = {
        executionId: "exec-789",
        agentId: "agent-123",
        bountyId: "bounty-456",
        success: true,
        output: { result: "passed", score: 100 },
        executionTimeMs: 1500,
      };

      const result = await client.queueAgentResult(resultMsg);
      expect(result.success).toBe(true);

      const producedMessage = JSON.parse(mockProducer.produce.mock.calls[0][1]);
      expect(producedMessage.data).toEqual(resultMsg);
    });

    it("should accept valid AgentResultMessage with error", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const resultMsg: AgentResultMessage = {
        executionId: "exec-789",
        agentId: "agent-123",
        bountyId: "bounty-456",
        success: false,
        error: "Timeout exceeded",
        executionTimeMs: 30000,
      };

      const result = await client.queueAgentResult(resultMsg);
      expect(result.success).toBe(true);

      const producedMessage = JSON.parse(mockProducer.produce.mock.calls[0][1]);
      expect(producedMessage.data.error).toBe("Timeout exceeded");
    });

    it("should accept valid NotificationMessage with all notification types", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const emailNotif: NotificationMessage = {
        type: "email",
        recipient: "user@example.com",
        subject: "Test Subject",
        body: "Test body content",
        metadata: { templateId: "welcome-email" },
      };

      await client.queueNotification(emailNotif);
      let producedMessage = JSON.parse(mockProducer.produce.mock.calls[0][1]);
      expect(producedMessage.data.type).toBe("email");

      mockProducer.produce.mockClear();

      const webhookNotif: NotificationMessage = {
        type: "webhook",
        recipient: "https://webhook.example.com/notify",
        body: JSON.stringify({ event: "bounty_completed" }),
      };

      await client.queueNotification(webhookNotif);
      producedMessage = JSON.parse(mockProducer.produce.mock.calls[0][1]);
      expect(producedMessage.data.type).toBe("webhook");

      mockProducer.produce.mockClear();

      const alertNotif: NotificationMessage = {
        type: "alert",
        recipient: "admin-channel",
        body: "Critical: System overload detected",
      };

      await client.queueNotification(alertNotif);
      producedMessage = JSON.parse(mockProducer.produce.mock.calls[0][1]);
      expect(producedMessage.data.type).toBe("alert");
    });

    it("should validate DeadLetterMessage structure in DLQ", async () => {
      const mockMessages = [
        {
          value: JSON.stringify({
            id: "msg-1",
            topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
            data: { agentId: "agent-1", bountyId: "bounty-1", code: "test" },
            timestamp: Date.now(),
            retryCount: 4,
          }),
        },
      ];
      mockConsumer.consume.mockResolvedValue(mockMessages);
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const handler = vi.fn().mockRejectedValue(new Error("Processing failed"));

      await client.processMessages(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, handler);

      const dlqCall = mockProducer.produce.mock.calls.find(
        (call: unknown[]) => call[0] === KAFKA_TOPICS.AGENT_EXECUTION_DLQ
      );
      expect(dlqCall).toBeDefined();

      const dlqMessage = JSON.parse(dlqCall[1]).data as DeadLetterMessage;
      expect(dlqMessage.originalMessage).toBeDefined();
      expect(dlqMessage.errorReason).toBe("Processing failed");
      expect(dlqMessage.originalTopic).toBe(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE);
      expect(typeof dlqMessage.failedAt).toBe("number");
    });
  });
});

describe("NullKafkaClient", () => {
  let nullClient: NullKafkaClient;

  beforeEach(() => {
    nullClient = new NullKafkaClient();
  });

  it("should return false for isAvailable", () => {
    expect(nullClient.isAvailable()).toBe(false);
  });

  it("should return error for produce", async () => {
    const result = await nullClient.produce(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, { test: "data" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not enabled");
  });

  it("should return errors for produceBatch", async () => {
    const results = await nullClient.produceBatch([
      { topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { test: 1 } },
      { topic: KAFKA_TOPICS.NOTIFICATIONS_QUEUE, data: { test: 2 } },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(false);
    expect(results[1].success).toBe(false);
  });

  it("should return empty for consume", async () => {
    const result = await nullClient.consume(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE);
    expect(result.messages).toHaveLength(0);
    expect(result.error).toContain("not enabled");
  });

  it("should return zeros for processMessages", async () => {
    const handler = vi.fn();
    const result = await nullClient.processMessages(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, handler);
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it("should return error for queueAgentExecution", async () => {
    const result = await nullClient.queueAgentExecution({
      agentId: "agent-1",
      bountyId: "bounty-1",
      code: "test",
    });
    expect(result.success).toBe(false);
  });

  it("should return error for queueAgentResult", async () => {
    const result = await nullClient.queueAgentResult({
      executionId: "exec-1",
      agentId: "agent-1",
      bountyId: "bounty-1",
      success: true,
      executionTimeMs: 100,
    });
    expect(result.success).toBe(false);
  });

  it("should return error for queueNotification", async () => {
    const result = await nullClient.queueNotification({
      type: "email",
      recipient: "test@example.com",
      body: "test",
    });
    expect(result.success).toBe(false);
  });

  it("should return disconnected for healthCheck", async () => {
    const result = await nullClient.healthCheck();
    expect(result.connected).toBe(false);
    expect(result.error).toContain("feature flag");
  });

  it("should return null for getConsumerLag", async () => {
    const result = await nullClient.getConsumerLag(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, "group");
    expect(result).toBeNull();
  });
});

describe("getKafkaClient with feature flags", () => {
  beforeEach(() => {
    featureFlags.reset();
  });

  afterEach(() => {
    featureFlags.reset();
  });

  it("should return NullKafkaClient when flag is disabled", () => {
    featureFlags.setEnabled("USE_UPSTASH_KAFKA", false);
    const client = getKafkaClient();
    expect(client.isAvailable()).toBe(false);
  });

  it("should return real client when flag is enabled", () => {
    featureFlags.setEnabled("USE_UPSTASH_KAFKA", true);
    featureFlags.setRolloutPercentage("USE_UPSTASH_KAFKA", 100);
    const client = getKafkaClient();
    // Real client may still return false if not configured, but it's the right type
    expect(client).toBeDefined();
  });

  it("should support user-based flag evaluation", () => {
    featureFlags.setEnabled("USE_UPSTASH_KAFKA", false);
    featureFlags.setUserOverride("USE_UPSTASH_KAFKA", "test-user", true);

    const defaultClient = getKafkaClient();
    const userClient = getKafkaClient("test-user");

    expect(defaultClient.isAvailable()).toBe(false);
    // User override should return the real client (though it may not be configured)
    expect(userClient).toBeDefined();
  });
});

describe("KafkaProducer", () => {
  let producer: KafkaProducer;
  let mockProducer: { produce: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create producer with mock config
    producer = new KafkaProducer({
      url: "https://mock-kafka.upstash.io",
      username: "mock-username",
      password: "mock-password",
    });

    // Access internal producer
    const internalProducer = producer as unknown as {
      producer: typeof mockProducer;
    };
    mockProducer = internalProducer.producer;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("isReady", () => {
    it("should return true when configured", () => {
      expect(producer.isReady()).toBe(true);
    });

    it("should return false when not configured", () => {
      const unconfiguredProducer = new KafkaProducer({});
      expect(unconfiguredProducer.isReady()).toBe(false);
    });
  });

  describe("getRetryConfig", () => {
    it("should return default retry configuration", () => {
      const config = producer.getRetryConfig();
      expect(config.maxRetries).toBe(5);
      expect(config.retryDelays).toEqual([1000, 2000, 4000, 8000, 16000]);
    });

    it("should return custom retry configuration", () => {
      const customProducer = new KafkaProducer({
        url: "https://mock-kafka.upstash.io",
        username: "mock-username",
        password: "mock-password",
        maxRetries: 3,
        retryDelays: [500, 1000, 2000],
      });
      const config = customProducer.getRetryConfig();
      expect(config.maxRetries).toBe(3);
      expect(config.retryDelays).toEqual([500, 1000, 2000]);
    });
  });

  describe("produce", () => {
    it("should produce a message successfully", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const result = await producer.produce(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, {
        test: "data",
      });

      expect(result.success).toBe(true);
      expect(result.topic).toBe(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE);
      expect(result.partition).toBe(0);
      expect(result.offset).toBe("123");
      expect(mockProducer.produce).toHaveBeenCalledTimes(1);
    });

    it("should include idempotency key in message", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      await producer.produce(
        KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        { test: "data" },
        { idempotencyKey: "unique-key-123" }
      );

      const producedMessage = JSON.parse(mockProducer.produce.mock.calls[0][1]);
      expect(producedMessage.idempotencyKey).toBe("unique-key-123");
    });

    it("should pass key and partition options", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 2, offset: "456" });

      await producer.produce(
        KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        { test: "data" },
        { key: "my-key", partition: 2 }
      );

      expect(mockProducer.produce).toHaveBeenCalledWith(
        KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        expect.any(String),
        expect.objectContaining({ key: "my-key", partition: 2 })
      );
    });

    it("should pass headers when provided", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      await producer.produce(
        KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        { test: "data" },
        { headers: { "x-correlation-id": "abc123", "x-source": "test" } }
      );

      expect(mockProducer.produce).toHaveBeenCalledWith(
        KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        expect.any(String),
        expect.objectContaining({
          headers: [
            { key: "x-correlation-id", value: "abc123" },
            { key: "x-source", value: "test" },
          ],
        })
      );
    });

    it("should retry on failure with exponential backoff", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockProducer.produce
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ partition: 0, offset: "123" });

      const resultPromise = producer.produce(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, {
        test: "data",
      });

      // Fast-forward through retry delays
      await vi.advanceTimersByTimeAsync(1000); // First retry delay
      await vi.advanceTimersByTimeAsync(2000); // Second retry delay

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(mockProducer.produce).toHaveBeenCalledTimes(3);
      consoleSpy.mockRestore();
    });

    it("should return error after max retries exceeded", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockProducer.produce.mockRejectedValue(new Error("Persistent error"));

      const resultPromise = producer.produce(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, {
        test: "data",
      });

      // Fast-forward through all retry delays
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(20000);
      }

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe("Persistent error");
      expect(mockProducer.produce).toHaveBeenCalledTimes(5);
      consoleSpy.mockRestore();
    });

    it("should respect custom maxRetries", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const customProducer = new KafkaProducer({
        url: "https://mock-kafka.upstash.io",
        username: "mock-username",
        password: "mock-password",
        maxRetries: 2,
        retryDelays: [100, 200],
      });
      const internalProducer = customProducer as unknown as {
        producer: typeof mockProducer;
      };
      mockProducer = internalProducer.producer;
      mockProducer.produce.mockRejectedValue(new Error("Persistent error"));

      const resultPromise = customProducer.produce(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, {
        test: "data",
      });

      await vi.advanceTimersByTimeAsync(500);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(mockProducer.produce).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });

    it("should return error when producer not configured", async () => {
      const unconfiguredProducer = new KafkaProducer({});

      const result = await unconfiguredProducer.produce(
        KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        { test: "data" }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Kafka producer not configured");
    });
  });

  describe("produceBatch", () => {
    it("should produce multiple messages", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const results = await producer.produceBatch([
        { topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { job: 1 } },
        { topic: KAFKA_TOPICS.NOTIFICATIONS_QUEUE, data: { notif: 1 } },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it("should pass options to each message", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      await producer.produceBatch([
        {
          topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
          data: { job: 1 },
          options: { idempotencyKey: "key-1" },
        },
        {
          topic: KAFKA_TOPICS.NOTIFICATIONS_QUEUE,
          data: { notif: 1 },
          options: { idempotencyKey: "key-2" },
        },
      ]);

      const msg1 = JSON.parse(mockProducer.produce.mock.calls[0][1]);
      const msg2 = JSON.parse(mockProducer.produce.mock.calls[1][1]);
      expect(msg1.idempotencyKey).toBe("key-1");
      expect(msg2.idempotencyKey).toBe("key-2");
    });
  });

  describe("produceOnce", () => {
    it("should produce a message without retries", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const result = await producer.produceOnce(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, {
        test: "data",
      });

      expect(result.success).toBe(true);
      expect(mockProducer.produce).toHaveBeenCalledTimes(1);
    });

    it("should return error immediately on failure without retries", async () => {
      mockProducer.produce.mockRejectedValue(new Error("Network error"));

      const result = await producer.produceOnce(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, {
        test: "data",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
      expect(mockProducer.produce).toHaveBeenCalledTimes(1);
    });

    it("should return error when producer not configured", async () => {
      const unconfiguredProducer = new KafkaProducer({});

      const result = await unconfiguredProducer.produceOnce(
        KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        { test: "data" }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Kafka producer not configured");
    });

    it("should include idempotency key and headers", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      await producer.produceOnce(
        KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        { test: "data" },
        { idempotencyKey: "once-key", headers: { "x-test": "value" } }
      );

      const producedMessage = JSON.parse(mockProducer.produce.mock.calls[0][1]);
      expect(producedMessage.idempotencyKey).toBe("once-key");
      expect(mockProducer.produce).toHaveBeenCalledWith(
        KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        expect.any(String),
        expect.objectContaining({
          headers: [{ key: "x-test", value: "value" }],
        })
      );
    });
  });
});
