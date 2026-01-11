import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode, useMemo } from "react";

interface WebSocketMessage {
  type: string;
  channel?: string;
  [key: string]: any;
}

interface WebSocketContextValue {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  subscribe: (channel: string, handlerId: string) => void;
  unsubscribe: (channel: string, handlerId: string) => void;
  send: (data: object) => void;
  addMessageHandler: (id: string, handler: (data: WebSocketMessage) => void) => void;
  removeMessageHandler: (id: string) => void;
}

const noop = () => {};

const defaultContextValue: WebSocketContextValue = {
  isConnected: false,
  lastMessage: null,
  subscribe: noop,
  unsubscribe: noop,
  send: noop,
  addMessageHandler: noop,
  removeMessageHandler: noop,
};

const WebSocketContext = createContext<WebSocketContextValue>(defaultContextValue);

const isBrowser = typeof window !== "undefined";

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const channelRefCounts = useRef<Map<string, Set<string>>>(new Map());
  const messageHandlers = useRef<Map<string, (data: WebSocketMessage) => void>>(new Map());
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendToSocket = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const connect = useCallback(() => {
    if (!isBrowser) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      setIsConnected(true);
      channelRefCounts.current.forEach((handlers, channel) => {
        if (handlers.size > 0) {
          ws.send(JSON.stringify({ type: "subscribe", channel }));
        }
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WebSocketMessage;
        setLastMessage(data);
        messageHandlers.current.forEach((handler) => handler(data));
      } catch {}
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {};

    wsRef.current = ws;
  }, []);

  const subscribe = useCallback((channel: string, handlerId: string) => {
    let handlers = channelRefCounts.current.get(channel);
    const isNewChannel = !handlers || handlers.size === 0;
    
    if (!handlers) {
      handlers = new Set();
      channelRefCounts.current.set(channel, handlers);
    }
    
    if (handlers.has(handlerId)) return;
    
    handlers.add(handlerId);
    
    if (isNewChannel) {
      sendToSocket({ type: "subscribe", channel });
    }
  }, [sendToSocket]);

  const unsubscribe = useCallback((channel: string, handlerId: string) => {
    const handlers = channelRefCounts.current.get(channel);
    if (!handlers) return;
    
    handlers.delete(handlerId);
    
    if (handlers.size === 0) {
      channelRefCounts.current.delete(channel);
      sendToSocket({ type: "unsubscribe", channel });
    }
  }, [sendToSocket]);

  const addMessageHandler = useCallback((id: string, handler: (data: WebSocketMessage) => void) => {
    messageHandlers.current.set(id, handler);
  }, []);

  const removeMessageHandler = useCallback((id: string) => {
    messageHandlers.current.delete(id);
  }, []);

  const send = useCallback((data: object) => {
    sendToSocket(data);
  }, [sendToSocket]);

  useEffect(() => {
    if (!isBrowser) return;
    connect();
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const value = useMemo(() => ({
    isConnected,
    lastMessage,
    subscribe,
    unsubscribe,
    send,
    addMessageHandler,
    removeMessageHandler,
  }), [isConnected, lastMessage, subscribe, unsubscribe, send, addMessageHandler, removeMessageHandler]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  return useContext(WebSocketContext);
}

export function useBountyUpdates(bountyId: number, onUpdate: (data: WebSocketMessage) => void) {
  const { subscribe, unsubscribe, isConnected, addMessageHandler, removeMessageHandler } = useWebSocket();
  const handlerRef = useRef(onUpdate);
  const instanceId = useRef(`bounty-${bountyId}-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    handlerRef.current = onUpdate;
  });

  useEffect(() => {
    if (!bountyId) return;

    const channel = `bounty:${bountyId}`;
    const handlerId = instanceId.current;

    subscribe(channel, handlerId);
    addMessageHandler(handlerId, (data) => {
      if (data.channel === channel || data.bountyId === bountyId) {
        handlerRef.current(data);
      }
    });

    return () => {
      unsubscribe(channel, handlerId);
      removeMessageHandler(handlerId);
    };
  }, [bountyId, subscribe, unsubscribe, addMessageHandler, removeMessageHandler]);

  return { isConnected };
}
