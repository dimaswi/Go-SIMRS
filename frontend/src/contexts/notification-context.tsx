import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useAuthStore } from "@/lib/store";
import { toast } from "sonner";
import {
  notificationsApi,
  type Notification,
  type NotificationData,
} from "@/lib/api/notifications";

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  clearAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuthStore();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      const [notifRes, countRes] = await Promise.all([
        notificationsApi.getAll({ limit: 50 }),
        notificationsApi.getUnreadCount(),
      ]);

      setNotifications(notifRes.data?.data || []);
      setUnreadCount(countRes.data?.data?.count || 0);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Mark single notification as read
  const markAsRead = useCallback(async (id: number) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (id: number) => {
    try {
      await notificationsApi.delete(id);
      setNotifications((prev) => {
        const notif = prev.find((n) => n.id === id);
        if (notif && !notif.is_read) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n.id !== id);
      });
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  }, []);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    try {
      await notificationsApi.clearAll();
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to clear notifications:", error);
    }
  }, []);

  // Handle incoming SSE notification
  const handleSSENotification = useCallback(
    (data: NotificationData) => {
      console.log("[handleSSENotification] Called with:", data);
      
      // Show toast using sonner
      console.log("[handleSSENotification] Showing toast:", data.title, data.message);
      toast.info(data.title || "Notifikasi Baru", {
        description: data.message || "Ada notifikasi baru",
        duration: 5000,
      });

      // Add to notifications list if has ID
      if (data.id) {
        const newNotif: Notification = {
          id: data.id,
          type: data.type,
          title: data.title,
          message: data.message,
          data: data.data ? JSON.stringify(data.data) : undefined,
          is_read: false,
          created_at: data.created_at,
        };

        setNotifications((prev) => [newNotif, ...prev]);
      }

      // Increment unread count
      setUnreadCount((prev) => prev + 1);
    },
    []
  );

  // Connect to SSE
  const connectSSE = useCallback(() => {
    if (!token || eventSourceRef.current) return;

    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
    const sseUrl = `${baseUrl}/sse/notifications`;

    const controller = new AbortController();

    const connect = async () => {
      try {
        const response = await fetch(sseUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        setIsConnected(true);
        console.log("SSE connected");

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (!reader) return;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let currentEvent = "";
          let currentData = "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
              console.log("[SSE] Event:", currentEvent);
            } else if (line.startsWith("data:")) {
              currentData = line.slice(5).trim();
              console.log("[SSE] Data:", currentData);
            } else if (line === "" && currentEvent && currentData) {
              // Process event
              console.log("[SSE] Processing event:", currentEvent, "data:", currentData);
              try {
                if (currentEvent === "notification") {
                  const parsed = JSON.parse(currentData);
                  console.log("[SSE] Parsed notification:", parsed);
                  const notifData = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
                  console.log("[SSE] Final notifData:", notifData);
                  handleSSENotification(notifData);
                } else if (currentEvent === "connected") {
                  console.log("SSE connection confirmed");
                } else if (currentEvent === "ping") {
                  // Keep-alive ping
                  console.log("[SSE] Ping received");
                }
              } catch (e) {
                console.error("Failed to parse SSE data:", e, "Raw data:", currentData);
              }
              currentEvent = "";
              currentData = "";
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("SSE error:", error);
          setIsConnected(false);

          // Reconnect after 5 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            connectSSE();
          }, 5000);
        }
      }
    };

    connect();

    // Store abort controller for cleanup
    eventSourceRef.current = { close: () => controller.abort() } as EventSource;
  }, [token, handleSSENotification]);

  // Disconnect SSE
  const disconnectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Connect when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchNotifications();
      connectSSE();
    } else {
      disconnectSSE();
      setNotifications([]);
      setUnreadCount(0);
    }

    return () => {
      disconnectSSE();
    };
  }, [isAuthenticated, token, fetchNotifications, connectSSE, disconnectSSE]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isConnected,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
