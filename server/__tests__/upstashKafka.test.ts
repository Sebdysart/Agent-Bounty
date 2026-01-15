/**
 * Tests for Upstash Kafka client wrapper
 * Mocks the @upstash/kafka package to avoid real API calls
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  UpstashKafkaClient,
  NullKafkaClient,
  KafkaProducer,
  KafkaConsumer,
  DeadLetterQueueHandler,
  KAFKA_TOPICS,
  getKafkaClient,
  type KafkaMessage,
  type AgentExecutionMessage,
  type AgentResultMessage,
  type NotificationMessage,
  type DeadLetterMessage,
  type BatchProcessResult,
  type DLQMessage,
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

describe("KafkaConsumer", () => {
  let consumer: KafkaConsumer;
  let mockConsumer: { consume: ReturnType<typeof vi.fn> };
  let mockProducer: { produce: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create consumer with mock config
    consumer = new KafkaConsumer({
      url: "https://mock-kafka.upstash.io",
      username: "mock-username",
      password: "mock-password",
      groupId: "test-group",
      instanceId: "test-instance",
      batchSize: 5,
    });

    // Access internal consumer and producer
    const internalConsumer = consumer as unknown as {
      consumer: typeof mockConsumer;
      producer: typeof mockProducer;
    };
    mockConsumer = internalConsumer.consumer;
    mockProducer = internalConsumer.producer;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("isReady", () => {
    it("should return true when configured", () => {
      expect(consumer.isReady()).toBe(true);
    });

    it("should return false when not configured", () => {
      const unconfiguredConsumer = new KafkaConsumer({});
      expect(unconfiguredConsumer.isReady()).toBe(false);
    });
  });

  describe("getConfig", () => {
    it("should return consumer configuration", () => {
      const config = consumer.getConfig();
      expect(config.groupId).toBe("test-group");
      expect(config.instanceId).toBe("test-instance");
      expect(config.batchSize).toBe(5);
      expect(config.maxRetries).toBe(5);
      expect(config.retryDelays).toEqual([1000, 2000, 4000, 8000]);
    });

    it("should return custom retry configuration", () => {
      const customConsumer = new KafkaConsumer({
        url: "https://mock-kafka.upstash.io",
        username: "mock-username",
        password: "mock-password",
        maxRetries: 3,
        retryDelays: [500, 1000, 2000],
      });
      const config = customConsumer.getConfig();
      expect(config.maxRetries).toBe(3);
      expect(config.retryDelays).toEqual([500, 1000, 2000]);
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

      const result = await consumer.consume(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].data).toEqual({ test: "data1" });
      expect(result.messages[1].data).toEqual({ test: "data2" });
    });

    it("should respect maxMessages option", async () => {
      const mockMessages = [
        { value: JSON.stringify({ id: "msg-1", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: 1 }, timestamp: Date.now() }) },
        { value: JSON.stringify({ id: "msg-2", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: 2 }, timestamp: Date.now() }) },
        { value: JSON.stringify({ id: "msg-3", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: 3 }, timestamp: Date.now() }) },
      ];
      mockConsumer.consume.mockResolvedValue(mockMessages);

      const result = await consumer.consume(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, { maxMessages: 2 });

      expect(result.messages).toHaveLength(2);
    });

    it("should return error when consumer not configured", async () => {
      const unconfiguredConsumer = new KafkaConsumer({});

      const result = await unconfiguredConsumer.consume(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE);

      expect(result.messages).toHaveLength(0);
      expect(result.error).toBe("Kafka consumer not configured");
    });

    it("should handle consume errors", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockConsumer.consume.mockRejectedValue(new Error("Connection failed"));

      const result = await consumer.consume(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE);

      expect(result.messages).toHaveLength(0);
      expect(result.error).toBe("Connection failed");
      consoleSpy.mockRestore();
    });

    it("should skip invalid JSON messages", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const mockMessages = [
        { value: "invalid-json" },
        { value: JSON.stringify({ id: "msg-1", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { test: "data" }, timestamp: Date.now() }) },
      ];
      mockConsumer.consume.mockResolvedValue(mockMessages);

      const result = await consumer.consume(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE);

      expect(result.messages).toHaveLength(1);
      consoleSpy.mockRestore();
    });
  });

  describe("consumeBatch", () => {
    it("should consume batch with default batch size", async () => {
      const mockMessages = Array.from({ length: 10 }, (_, i) => ({
        value: JSON.stringify({ id: `msg-${i}`, topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: i }, timestamp: Date.now() }),
      }));
      mockConsumer.consume.mockResolvedValue(mockMessages);

      const result = await consumer.consumeBatch(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE);

      // Consumer was configured with batchSize: 5
      expect(result.messages).toHaveLength(5);
    });

    it("should consume batch with custom batch size", async () => {
      const mockMessages = Array.from({ length: 10 }, (_, i) => ({
        value: JSON.stringify({ id: `msg-${i}`, topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: i }, timestamp: Date.now() }),
      }));
      mockConsumer.consume.mockResolvedValue(mockMessages);

      const result = await consumer.consumeBatch(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, 3);

      expect(result.messages).toHaveLength(3);
    });
  });

  describe("processBatch", () => {
    it("should process messages successfully", async () => {
      const mockMessages = [
        { value: JSON.stringify({ id: "msg-1", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: 1 }, timestamp: Date.now() }) },
        { value: JSON.stringify({ id: "msg-2", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: 2 }, timestamp: Date.now() }) },
      ];
      mockConsumer.consume.mockResolvedValue(mockMessages);

      const handler = vi.fn().mockResolvedValue(undefined);

      const result = await consumer.processBatch(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, handler);

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.dlqSent).toBe(0);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("should retry failed messages with incremented retry count", async () => {
      const mockMessages = [
        { value: JSON.stringify({ id: "msg-1", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: 1 }, timestamp: Date.now(), retryCount: 1 }) },
      ];
      mockConsumer.consume.mockResolvedValue(mockMessages);
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const handler = vi.fn().mockRejectedValue(new Error("Processing failed"));

      const result = await consumer.processBatch(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, handler);

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.dlqSent).toBe(0);

      // Check that retry was sent to original topic
      const retryCall = mockProducer.produce.mock.calls.find(
        (call: unknown[]) => call[0] === KAFKA_TOPICS.AGENT_EXECUTION_QUEUE
      );
      expect(retryCall).toBeDefined();
      const retryMessage = JSON.parse(retryCall[1]) as KafkaMessage;
      expect(retryMessage.retryCount).toBe(2);
    });

    it("should send to DLQ after max retries exceeded", async () => {
      const mockMessages = [
        { value: JSON.stringify({ id: "msg-1", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: 1 }, timestamp: Date.now(), retryCount: 4 }) },
      ];
      mockConsumer.consume.mockResolvedValue(mockMessages);
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const handler = vi.fn().mockRejectedValue(new Error("Processing failed"));

      const result = await consumer.processBatch(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, handler);

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.dlqSent).toBe(1);

      // Check that DLQ message was sent
      const dlqCall = mockProducer.produce.mock.calls.find(
        (call: unknown[]) => call[0] === KAFKA_TOPICS.AGENT_EXECUTION_DLQ
      );
      expect(dlqCall).toBeDefined();
    });

    it("should track errors with message IDs", async () => {
      const mockMessages = [
        { value: JSON.stringify({ id: "msg-1", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: 1 }, timestamp: Date.now() }) },
        { value: JSON.stringify({ id: "msg-2", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: 2 }, timestamp: Date.now() }) },
      ];
      mockConsumer.consume.mockResolvedValue(mockMessages);
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const handler = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Failed on msg-2"));

      const result = await consumer.processBatch(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, handler);

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].messageId).toBe("msg-2");
      expect(result.errors[0].error).toBe("Failed on msg-2");
    });
  });

  describe("processParallelBatch", () => {
    it("should process messages in parallel", async () => {
      const mockMessages = Array.from({ length: 5 }, (_, i) => ({
        value: JSON.stringify({ id: `msg-${i}`, topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: i }, timestamp: Date.now() }),
      }));
      mockConsumer.consume.mockResolvedValue(mockMessages);

      const handler = vi.fn().mockResolvedValue(undefined);

      const result = await consumer.processParallelBatch(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, handler, { concurrency: 3 });

      expect(result.processed).toBe(5);
      expect(result.failed).toBe(0);
      expect(handler).toHaveBeenCalledTimes(5);
    });

    it("should handle partial failures in parallel processing", async () => {
      const mockMessages = [
        { value: JSON.stringify({ id: "msg-1", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: 1 }, timestamp: Date.now() }) },
        { value: JSON.stringify({ id: "msg-2", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: 2 }, timestamp: Date.now() }) },
        { value: JSON.stringify({ id: "msg-3", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: 3 }, timestamp: Date.now() }) },
      ];
      mockConsumer.consume.mockResolvedValue(mockMessages);
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const handler = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Failed"))
        .mockResolvedValueOnce(undefined);

      const result = await consumer.processParallelBatch(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, handler, { concurrency: 3 });

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(1);
    });
  });

  describe("startPolling", () => {
    it("should start polling and call handler", async () => {
      vi.useRealTimers();
      const mockMessages = [
        { value: JSON.stringify({ id: "msg-1", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: 1 }, timestamp: Date.now() }) },
      ];
      mockConsumer.consume.mockResolvedValue(mockMessages);

      const handler = vi.fn().mockResolvedValue(undefined);
      const onBatchComplete = vi.fn();

      const poller = await consumer.startPolling(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, handler, {
        pollIntervalMs: 10,
        onBatchComplete,
      });

      // Wait a bit for polling to occur
      await new Promise((resolve) => setTimeout(resolve, 50));

      poller.stop();

      expect(handler).toHaveBeenCalled();
      expect(onBatchComplete).toHaveBeenCalled();
    });

    it("should stop polling when stop is called", async () => {
      vi.useRealTimers();
      mockConsumer.consume.mockResolvedValue([]);

      const handler = vi.fn().mockResolvedValue(undefined);

      const poller = await consumer.startPolling(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, handler, {
        pollIntervalMs: 10,
      });

      poller.stop();

      const callCountBeforeStop = mockConsumer.consume.mock.calls.length;
      await new Promise((resolve) => setTimeout(resolve, 50));
      const callCountAfterWait = mockConsumer.consume.mock.calls.length;

      // After stopping, consume should not be called many more times
      expect(callCountAfterWait - callCountBeforeStop).toBeLessThanOrEqual(1);
    });
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
      expect(config.retryDelays).toEqual([1000, 2000, 4000, 8000]);
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

describe("DeadLetterQueueHandler", () => {
  let handler: DeadLetterQueueHandler;
  let mockConsumer: { consume: ReturnType<typeof vi.fn> };
  let mockProducer: { produce: ReturnType<typeof vi.fn> };

  const createDLQMessage = (id: string, originalTopic: string, failedAt: number, errorReason: string) => {
    const dlqData: DeadLetterMessage = {
      originalMessage: {
        id: `orig-${id}`,
        topic: originalTopic as typeof KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        data: { test: "data", id },
        timestamp: failedAt - 1000,
        retryCount: 5,
      },
      errorReason,
      failedAt,
      originalTopic: originalTopic as typeof KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
    };

    return {
      value: JSON.stringify({
        id: `dlq-${id}`,
        topic: KAFKA_TOPICS.AGENT_EXECUTION_DLQ,
        data: dlqData,
        timestamp: failedAt,
      }),
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-14T12:00:00Z"));

    handler = new DeadLetterQueueHandler({
      url: "https://mock-kafka.upstash.io",
      username: "mock-username",
      password: "mock-password",
      groupId: "test-dlq-group",
      instanceId: "test-dlq-instance",
    });

    const internalHandler = handler as unknown as {
      consumer: typeof mockConsumer;
      producer: typeof mockProducer;
    };
    mockConsumer = internalHandler.consumer;
    mockProducer = internalHandler.producer;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("isReady", () => {
    it("should return true when configured", () => {
      expect(handler.isReady()).toBe(true);
    });

    it("should return false when not configured", () => {
      const unconfiguredHandler = new DeadLetterQueueHandler({});
      expect(unconfiguredHandler.isReady()).toBe(false);
    });
  });

  describe("fetchMessages", () => {
    it("should fetch messages from DLQ", async () => {
      const now = Date.now();
      mockConsumer.consume.mockResolvedValue([
        createDLQMessage("1", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now - 5000, "Error 1"),
        createDLQMessage("2", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now - 3000, "Error 2"),
      ]);

      const result = await handler.fetchMessages();

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].id).toBe("dlq-1");
      expect(result.messages[0].errorReason).toBe("Error 1");
      expect(result.messages[1].id).toBe("dlq-2");
    });

    it("should respect maxMessages option", async () => {
      const now = Date.now();
      mockConsumer.consume.mockResolvedValue([
        createDLQMessage("1", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now, "Error 1"),
        createDLQMessage("2", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now, "Error 2"),
        createDLQMessage("3", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now, "Error 3"),
      ]);

      const result = await handler.fetchMessages({ maxMessages: 2 });

      expect(result.messages).toHaveLength(2);
    });

    it("should return error when not configured", async () => {
      const unconfiguredHandler = new DeadLetterQueueHandler({});

      const result = await unconfiguredHandler.fetchMessages();

      expect(result.messages).toHaveLength(0);
      expect(result.error).toBe("DLQ handler not configured");
    });

    it("should handle consume errors", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockConsumer.consume.mockRejectedValue(new Error("Connection failed"));

      const result = await handler.fetchMessages();

      expect(result.messages).toHaveLength(0);
      expect(result.error).toBe("Connection failed");
      consoleSpy.mockRestore();
    });

    it("should skip invalid JSON messages", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const now = Date.now();
      mockConsumer.consume.mockResolvedValue([
        { value: "invalid-json" },
        createDLQMessage("1", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now, "Error 1"),
      ]);

      const result = await handler.fetchMessages();

      expect(result.messages).toHaveLength(1);
      consoleSpy.mockRestore();
    });
  });

  describe("replayMessage", () => {
    it("should replay a message to its original topic", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const dlqMessage: DLQMessage = {
        id: "dlq-1",
        originalMessage: {
          id: "orig-1",
          topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
          data: { test: "data" },
          timestamp: Date.now() - 5000,
          retryCount: 5,
        },
        errorReason: "Processing failed",
        failedAt: Date.now() - 3000,
        originalTopic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
      };

      const result = await handler.replayMessage(dlqMessage);

      expect(result.success).toBe(true);
      expect(mockProducer.produce).toHaveBeenCalledWith(
        KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        expect.any(String)
      );

      // Verify retry count is reset
      const replayedMessage = JSON.parse(mockProducer.produce.mock.calls[0][1]);
      expect(replayedMessage.retryCount).toBe(0);
    });

    it("should return error when not configured", async () => {
      const unconfiguredHandler = new DeadLetterQueueHandler({});

      const dlqMessage: DLQMessage = {
        id: "dlq-1",
        originalMessage: {
          id: "orig-1",
          topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
          data: { test: "data" },
          timestamp: Date.now(),
        },
        errorReason: "Error",
        failedAt: Date.now(),
        originalTopic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
      };

      const result = await unconfiguredHandler.replayMessage(dlqMessage);

      expect(result.success).toBe(false);
      expect(result.error).toBe("DLQ handler not configured");
    });

    it("should handle replay errors", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockProducer.produce.mockRejectedValue(new Error("Produce failed"));

      const dlqMessage: DLQMessage = {
        id: "dlq-1",
        originalMessage: {
          id: "orig-1",
          topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
          data: { test: "data" },
          timestamp: Date.now(),
        },
        errorReason: "Error",
        failedAt: Date.now(),
        originalTopic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
      };

      const result = await handler.replayMessage(dlqMessage);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Produce failed");
      consoleSpy.mockRestore();
    });
  });

  describe("replayMessages", () => {
    it("should replay multiple messages", async () => {
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const messages: DLQMessage[] = [
        {
          id: "dlq-1",
          originalMessage: { id: "orig-1", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: 1 }, timestamp: Date.now() },
          errorReason: "Error 1",
          failedAt: Date.now(),
          originalTopic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        },
        {
          id: "dlq-2",
          originalMessage: { id: "orig-2", topic: KAFKA_TOPICS.NOTIFICATIONS_QUEUE, data: { n: 2 }, timestamp: Date.now() },
          errorReason: "Error 2",
          failedAt: Date.now(),
          originalTopic: KAFKA_TOPICS.NOTIFICATIONS_QUEUE,
        },
      ];

      const result = await handler.replayMessages(messages);

      expect(result.replayed).toBe(2);
      expect(result.deleted).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should track errors for failed replays", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockProducer.produce
        .mockResolvedValueOnce({ partition: 0, offset: "123" })
        .mockRejectedValueOnce(new Error("Failed"));

      const messages: DLQMessage[] = [
        {
          id: "dlq-1",
          originalMessage: { id: "orig-1", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: 1 }, timestamp: Date.now() },
          errorReason: "Error 1",
          failedAt: Date.now(),
          originalTopic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        },
        {
          id: "dlq-2",
          originalMessage: { id: "orig-2", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: { n: 2 }, timestamp: Date.now() },
          errorReason: "Error 2",
          failedAt: Date.now(),
          originalTopic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
        },
      ];

      const result = await handler.replayMessages(messages);

      expect(result.replayed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].messageId).toBe("dlq-2");
      consoleSpy.mockRestore();
    });
  });

  describe("replayByTopic", () => {
    it("should replay messages filtered by topic", async () => {
      const now = Date.now();
      mockConsumer.consume.mockResolvedValue([
        createDLQMessage("1", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now, "Error 1"),
        createDLQMessage("2", KAFKA_TOPICS.NOTIFICATIONS_QUEUE, now, "Error 2"),
        createDLQMessage("3", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now, "Error 3"),
      ]);
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const result = await handler.replayByTopic(KAFKA_TOPICS.AGENT_EXECUTION_QUEUE);

      expect(result.replayed).toBe(2);
    });
  });

  describe("replayByTimeWindow", () => {
    it("should replay messages within time window", async () => {
      const now = Date.now();
      mockConsumer.consume.mockResolvedValue([
        createDLQMessage("1", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now - 10000, "Error 1"),
        createDLQMessage("2", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now - 5000, "Error 2"),
        createDLQMessage("3", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now - 1000, "Error 3"),
      ]);
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const result = await handler.replayByTimeWindow(now - 8000, now - 2000);

      expect(result.replayed).toBe(1); // Only message 2 falls in window
    });
  });

  describe("getStats", () => {
    it("should return DLQ statistics", async () => {
      const now = Date.now();
      mockConsumer.consume.mockResolvedValue([
        createDLQMessage("1", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now - 10000, "Timeout"),
        createDLQMessage("2", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now - 5000, "Network error"),
        createDLQMessage("3", KAFKA_TOPICS.NOTIFICATIONS_QUEUE, now - 2000, "Timeout"),
      ]);

      const stats = await handler.getStats();

      expect(stats.totalMessages).toBe(3);
      expect(stats.byTopic[KAFKA_TOPICS.AGENT_EXECUTION_QUEUE]).toBe(2);
      expect(stats.byTopic[KAFKA_TOPICS.NOTIFICATIONS_QUEUE]).toBe(1);
      expect(stats.byErrorReason["Timeout"]).toBe(2);
      expect(stats.byErrorReason["Network error"]).toBe(1);
      expect(stats.oldestMessageAge).toBeGreaterThan(stats.newestMessageAge!);
    });

    it("should handle empty DLQ", async () => {
      mockConsumer.consume.mockResolvedValue([]);

      const stats = await handler.getStats();

      expect(stats.totalMessages).toBe(0);
      expect(stats.oldestMessageAge).toBeUndefined();
      expect(stats.newestMessageAge).toBeUndefined();
      expect(stats.byTopic).toEqual({});
      expect(stats.byErrorReason).toEqual({});
    });
  });

  describe("processMessages", () => {
    it("should process messages with custom handler", async () => {
      const now = Date.now();
      mockConsumer.consume.mockResolvedValue([
        createDLQMessage("1", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now, "Timeout"),
        createDLQMessage("2", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now, "Network error"),
        createDLQMessage("3", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now, "Invalid data"),
      ]);
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const customHandler = vi.fn()
        .mockResolvedValueOnce("replay")
        .mockResolvedValueOnce("skip")
        .mockResolvedValueOnce("delete");

      const result = await handler.processMessages(customHandler);

      expect(result.replayed).toBe(1);
      expect(result.deleted).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(customHandler).toHaveBeenCalledTimes(3);
    });

    it("should handle errors in custom handler", async () => {
      const now = Date.now();
      mockConsumer.consume.mockResolvedValue([
        createDLQMessage("1", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now, "Error"),
      ]);

      const customHandler = vi.fn().mockRejectedValue(new Error("Handler failed"));

      const result = await handler.processMessages(customHandler);

      expect(result.replayed).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe("Handler failed");
    });
  });

  describe("checkAlertThresholds", () => {
    it("should alert when message count exceeds threshold", async () => {
      const now = Date.now();
      mockConsumer.consume.mockResolvedValue([
        createDLQMessage("1", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now, "Error"),
        createDLQMessage("2", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now, "Error"),
        createDLQMessage("3", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now, "Error"),
      ]);

      const result = await handler.checkAlertThresholds({ maxMessages: 2 });

      expect(result.alert).toBe(true);
      expect(result.reasons).toHaveLength(1);
      expect(result.reasons[0]).toContain("3 messages");
    });

    it("should alert when oldest message exceeds age threshold", async () => {
      const now = Date.now();
      const oldTime = now - 2 * 60 * 60 * 1000; // 2 hours ago
      mockConsumer.consume.mockResolvedValue([
        createDLQMessage("1", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, oldTime, "Error"),
      ]);

      const result = await handler.checkAlertThresholds({ maxAgeMs: 1 * 60 * 60 * 1000 }); // 1 hour threshold

      expect(result.alert).toBe(true);
      expect(result.reasons).toHaveLength(1);
      expect(result.reasons[0]).toContain("old");
    });

    it("should not alert when thresholds not exceeded", async () => {
      const now = Date.now();
      mockConsumer.consume.mockResolvedValue([
        createDLQMessage("1", KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, now - 1000, "Error"),
      ]);

      const result = await handler.checkAlertThresholds({ maxMessages: 10, maxAgeMs: 60 * 60 * 1000 });

      expect(result.alert).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });
  });
});

// ============================================================================
// KafkaJobQueue Tests (pg-boss compatible adapter)
// ============================================================================

import {
  KafkaJobQueue,
  NullJobQueue,
  getJobQueue,
  type Job,
  type JobWithMetadata,
} from "../upstashKafka";

describe("KafkaJobQueue", () => {
  let queue: KafkaJobQueue;
  let mockProducer: { produce: ReturnType<typeof vi.fn> };
  let mockConsumer: { consume: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    queue = new KafkaJobQueue({
      url: "https://mock-kafka.upstash.io",
      username: "mock-username",
      password: "mock-password",
    });

    // Access internal producer/consumer
    const internalQueue = queue as unknown as {
      producer: typeof mockProducer;
      consumer: typeof mockConsumer;
    };
    mockProducer = internalQueue.producer;
    mockConsumer = internalQueue.consumer;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("start and stop", () => {
    it("should start the queue", async () => {
      const result = await queue.start();
      expect(result).toBe(queue);
      expect(queue.isAvailable()).toBe(true);
    });

    it("should throw error when starting unconfigured queue", async () => {
      const unconfiguredQueue = new KafkaJobQueue({});
      await expect(unconfiguredQueue.start()).rejects.toThrow("Not configured");
    });

    it("should stop the queue", async () => {
      await queue.start();
      await queue.stop();
      expect(queue.isAvailable()).toBe(false);
    });

    it("should stop gracefully with timeout", async () => {
      await queue.start();
      await queue.stop({ graceful: true, timeout: 1000 });
      expect(queue.isAvailable()).toBe(false);
    });
  });

  describe("send", () => {
    it("should send a job successfully", async () => {
      await queue.start();
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const jobId = await queue.send("agent-execution", { task: "test" });

      expect(jobId).toBeTruthy();
      expect(mockProducer.produce).toHaveBeenCalledTimes(1);
    });

    it("should return null when not started", async () => {
      const jobId = await queue.send("agent-execution", { task: "test" });
      expect(jobId).toBeNull();
    });

    it("should use custom job ID when provided", async () => {
      await queue.start();
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const jobId = await queue.send("agent-execution", { task: "test" }, { id: "custom-id-123" });

      expect(jobId).toBe("custom-id-123");
    });

    it("should calculate expiration from different options", async () => {
      await queue.start();
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      // Test expireInSeconds
      await queue.send("agent-execution", {}, { expireInSeconds: 120 });
      let producedMessage = JSON.parse(mockProducer.produce.mock.calls[0][1]);
      expect(producedMessage.data.expireInSeconds).toBe(120);

      mockProducer.produce.mockClear();

      // Test expireInMinutes
      await queue.send("agent-execution", {}, { expireInMinutes: 5 });
      producedMessage = JSON.parse(mockProducer.produce.mock.calls[0][1]);
      expect(producedMessage.data.expireInSeconds).toBe(300);

      mockProducer.produce.mockClear();

      // Test expireInHours
      await queue.send("agent-execution", {}, { expireInHours: 2 });
      producedMessage = JSON.parse(mockProducer.produce.mock.calls[0][1]);
      expect(producedMessage.data.expireInSeconds).toBe(7200);
    });

    it("should enforce singleton constraint", async () => {
      await queue.start();
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      // First job should succeed
      const jobId1 = await queue.send("agent-execution", { task: 1 }, { singletonKey: "unique-task" });
      expect(jobId1).toBeTruthy();

      // Second job with same singleton key should fail
      const jobId2 = await queue.send("agent-execution", { task: 2 }, { singletonKey: "unique-task" });
      expect(jobId2).toBeNull();
    });

    it("should allow singleton job after first completes", async () => {
      await queue.start();
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const jobId1 = await queue.send("agent-execution", { task: 1 }, { singletonKey: "unique-task" });
      expect(jobId1).toBeTruthy();

      // Complete the first job
      await queue.complete("agent-execution", jobId1!);

      // Now second job should succeed
      const jobId2 = await queue.send("agent-execution", { task: 2 }, { singletonKey: "unique-task" });
      expect(jobId2).toBeTruthy();
    });

    it("should handle send errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      await queue.start();
      mockProducer.produce.mockRejectedValue(new Error("Network error"));

      const jobId = await queue.send("agent-execution", { task: "test" });

      expect(jobId).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe("fetch", () => {
    it("should fetch jobs from a queue", async () => {
      await queue.start();

      const mockJob = {
        id: "job-123",
        name: "agent-execution",
        data: { task: "test" },
        state: "created",
        priority: 0,
        retryLimit: 5,
        retryCount: 0,
        retryDelay: 1000,
        retryBackoff: true,
        expireInSeconds: 3600,
        startAfter: new Date().toISOString(),
        startedOn: null,
        createdOn: new Date().toISOString(),
        completedOn: null,
        singletonKey: null,
        keepUntil: new Date(Date.now() + 3600000).toISOString(),
      };

      mockConsumer.consume.mockResolvedValue([
        {
          value: JSON.stringify({
            id: "job-123",
            topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
            data: mockJob,
            timestamp: Date.now(),
          }),
        },
      ]);

      const jobs = await queue.fetch("agent-execution");

      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe("job-123");
      expect(jobs[0].data).toEqual({ task: "test" });
    });

    it("should return empty array when not started", async () => {
      const jobs = await queue.fetch("agent-execution");
      expect(jobs).toHaveLength(0);
    });

    it("should include metadata when requested", async () => {
      await queue.start();

      const mockJob = {
        id: "job-123",
        name: "agent-execution",
        data: { task: "test" },
        state: "created",
        priority: 5,
        retryLimit: 3,
        retryCount: 0,
        retryDelay: 2000,
        retryBackoff: false,
        expireInSeconds: 7200,
        startAfter: new Date().toISOString(),
        startedOn: null,
        createdOn: new Date().toISOString(),
        completedOn: null,
        singletonKey: "unique",
        keepUntil: new Date(Date.now() + 7200000).toISOString(),
      };

      mockConsumer.consume.mockResolvedValue([
        {
          value: JSON.stringify({
            id: "job-123",
            topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
            data: mockJob,
            timestamp: Date.now(),
          }),
        },
      ]);

      const jobs = await queue.fetch("agent-execution", { includeMetadata: true });

      expect(jobs).toHaveLength(1);
      const job = jobs[0] as JobWithMetadata;
      expect(job.priority).toBe(5);
      expect(job.retryLimit).toBe(3);
      expect(job.singletonKey).toBe("unique");
    });

    it("should skip jobs that are not ready yet", async () => {
      await queue.start();

      const futureDate = new Date(Date.now() + 60000); // 1 minute in future
      const mockJob = {
        id: "job-123",
        name: "agent-execution",
        data: { task: "test" },
        state: "created",
        priority: 0,
        retryLimit: 5,
        retryCount: 0,
        retryDelay: 1000,
        retryBackoff: true,
        expireInSeconds: 3600,
        startAfter: futureDate.toISOString(),
        startedOn: null,
        createdOn: new Date().toISOString(),
        completedOn: null,
        singletonKey: null,
        keepUntil: new Date(Date.now() + 3600000).toISOString(),
      };

      mockConsumer.consume.mockResolvedValue([
        {
          value: JSON.stringify({
            id: "job-123",
            topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE,
            data: mockJob,
            timestamp: Date.now(),
          }),
        },
      ]);

      const jobs = await queue.fetch("agent-execution");

      expect(jobs).toHaveLength(0);
    });

    it("should sort by priority when requested", async () => {
      await queue.start();

      const createMockJob = (id: string, priority: number) => ({
        id,
        name: "agent-execution",
        data: { task: id },
        state: "created",
        priority,
        retryLimit: 5,
        retryCount: 0,
        retryDelay: 1000,
        retryBackoff: true,
        expireInSeconds: 3600,
        startAfter: new Date().toISOString(),
        startedOn: null,
        createdOn: new Date().toISOString(),
        completedOn: null,
        singletonKey: null,
        keepUntil: new Date(Date.now() + 3600000).toISOString(),
      });

      mockConsumer.consume.mockResolvedValue([
        { value: JSON.stringify({ id: "job-1", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: createMockJob("job-1", 1), timestamp: Date.now() }) },
        { value: JSON.stringify({ id: "job-2", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: createMockJob("job-2", 5), timestamp: Date.now() }) },
        { value: JSON.stringify({ id: "job-3", topic: KAFKA_TOPICS.AGENT_EXECUTION_QUEUE, data: createMockJob("job-3", 3), timestamp: Date.now() }) },
      ]);

      const jobs = await queue.fetch("agent-execution", { includeMetadata: true, priority: true, batchSize: 10 });

      expect(jobs).toHaveLength(3);
      expect((jobs[0] as JobWithMetadata).priority).toBe(5);
      expect((jobs[1] as JobWithMetadata).priority).toBe(3);
      expect((jobs[2] as JobWithMetadata).priority).toBe(1);
    });
  });

  describe("complete", () => {
    it("should mark a job as completed", async () => {
      await queue.start();
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const jobId = await queue.send("agent-execution", { task: "test" });
      await queue.complete("agent-execution", jobId!);

      const job = await queue.getJobById("agent-execution", jobId!);
      expect(job?.state).toBe("completed");
      expect(job?.completedOn).toBeTruthy();
    });
  });

  describe("fail", () => {
    it("should mark a job for retry when retries remain", async () => {
      await queue.start();
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const jobId = await queue.send("agent-execution", { task: "test" }, { retryLimit: 3 });
      await queue.fail("agent-execution", jobId!, { error: "Processing failed" });

      const job = await queue.getJobById("agent-execution", jobId!);
      expect(job?.state).toBe("retry");
      expect(job?.retryCount).toBe(1);
    });

    it("should mark a job as failed when retries exhausted", async () => {
      await queue.start();
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const jobId = await queue.send("agent-execution", { task: "test" }, { retryLimit: 1 });
      await queue.fail("agent-execution", jobId!, { error: "Processing failed" });

      const job = await queue.getJobById("agent-execution", jobId!);
      expect(job?.state).toBe("failed");
    });

    it("should send to DLQ when retries exhausted", async () => {
      await queue.start();
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const jobId = await queue.send("agent-execution", { task: "test" }, { retryLimit: 1 });

      mockProducer.produce.mockClear();
      await queue.fail("agent-execution", jobId!, { error: "Final failure" });

      // Should have called produce for DLQ
      expect(mockProducer.produce).toHaveBeenCalledWith(
        KAFKA_TOPICS.AGENT_EXECUTION_DLQ,
        expect.any(String)
      );
    });
  });

  describe("cancel", () => {
    it("should cancel a single job", async () => {
      await queue.start();
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const jobId = await queue.send("agent-execution", { task: "test" });
      await queue.cancel("agent-execution", jobId!);

      const job = await queue.getJobById("agent-execution", jobId!);
      expect(job?.state).toBe("cancelled");
    });

    it("should cancel multiple jobs", async () => {
      await queue.start();
      mockProducer.produce.mockResolvedValue({ partition: 0, offset: "123" });

      const jobId1 = await queue.send("agent-execution", { task: "test1" });
      const jobId2 = await queue.send("agent-execution", { task: "test2" });

      await queue.cancel("agent-execution", [jobId1!, jobId2!]);

      const job1 = await queue.getJobById("agent-execution", jobId1!);
      const job2 = await queue.getJobById("agent-execution", jobId2!);
      expect(job1?.state).toBe("cancelled");
      expect(job2?.state).toBe("cancelled");
    });
  });

  describe("getJobById", () => {
    it("should return null for non-existent job", async () => {
      await queue.start();
      const job = await queue.getJobById("agent-execution", "non-existent");
      expect(job).toBeNull();
    });
  });

  describe("work and offWork", () => {
    it("should return worker ID when starting work", async () => {
      await queue.start();
      mockConsumer.consume.mockResolvedValue([]);

      const workerId = await queue.work("agent-execution", async (jobs) => {
        // Handler
      });

      expect(workerId).toMatch(/^worker-agent-execution-/);

      // Clean up
      await queue.offWork({ id: workerId });
    });

    it("should stop worker by name", async () => {
      await queue.start();
      mockConsumer.consume.mockResolvedValue([]);

      await queue.work("agent-execution", async () => {});
      await queue.offWork("agent-execution");

      // No error means success
    });
  });
});

describe("NullJobQueue", () => {
  let nullQueue: NullJobQueue;

  beforeEach(() => {
    nullQueue = new NullJobQueue();
  });

  it("should return this on start", async () => {
    const result = await nullQueue.start();
    expect(result).toBe(nullQueue);
  });

  it("should return null on send", async () => {
    const jobId = await nullQueue.send("test", {});
    expect(jobId).toBeNull();
  });

  it("should return empty array on fetch", async () => {
    const jobs = await nullQueue.fetch("test");
    expect(jobs).toHaveLength(0);
  });

  it("should return null-worker on work", async () => {
    const workerId = await nullQueue.work("test", async () => {});
    expect(workerId).toBe("null-worker");
  });

  it("should return null on getJobById", async () => {
    const job = await nullQueue.getJobById("test", "id");
    expect(job).toBeNull();
  });

  it("should return false on isAvailable", () => {
    expect(nullQueue.isAvailable()).toBe(false);
  });
});

describe("getJobQueue", () => {
  it("should return NullJobQueue when feature flag is disabled", () => {
    vi.spyOn(featureFlags, "isEnabled").mockReturnValue(false);

    const queue = getJobQueue();

    expect(queue).toBeInstanceOf(NullJobQueue);
    expect(queue.isAvailable()).toBe(false);
  });

  it("should return KafkaJobQueue when feature flag is enabled", () => {
    vi.spyOn(featureFlags, "isEnabled").mockReturnValue(true);

    const queue = getJobQueue();

    // KafkaJobQueue without credentials will not be configured
    expect(queue).toBeInstanceOf(KafkaJobQueue);
  });
});
