/**
 * Tests for Upstash Kafka client wrapper
 * Mocks the @upstash/kafka package to avoid real API calls
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  UpstashKafkaClient,
  KAFKA_TOPICS,
  type KafkaMessage,
} from "../upstashKafka";

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
});
