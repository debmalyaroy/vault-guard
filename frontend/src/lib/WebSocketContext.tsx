import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

type WebSocketContextType = {
  socket: WebSocket | null;
  isConnected: boolean;
  send: (type: string, payload: any) => void;
  lastMessage: any | null;
};

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  send: () => {},
  lastMessage: null,
});

export const WebSocketProvider: React.FC<{ url: string; children: React.ReactNode }> = ({ url, children }) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let ws: WebSocket;

    const connect = () => {
      ws = new WebSocket(url);

      ws.onopen = () => {
        setIsConnected(true);
        setSocket(ws);
        console.log('WS Connected');
      };

      ws.onclose = () => {
        setIsConnected(false);
        setSocket(null);
        console.log('WS Disconnected. Reconnecting...');
        reconnectTimeoutRef.current = setTimeout(connect, 2000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [url]);

  const send = (type: string, payload: any) => {
    if (socket && isConnected) {
      socket.send(JSON.stringify({ type, payload }));
    } else {
      console.warn("Cannot send, socket not connected");
    }
  };

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, send, lastMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
