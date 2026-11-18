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
import { useToast } from "@/hooks/use-toast";
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

const isStandaloneDisplayRoute = () => {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  return (
    path.startsWith("/kiosk") ||
    path.startsWith("/queue-display") ||
    path.startsWith("/room-queue/display") ||
    path.startsWith("/display/") ||
    path.startsWith("/antrean-online")
  );
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuthStore();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seenNotifIdsRef = useRef<Set<number>>(new Set());
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('/notifications.wav');
  }, []);
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
      if (data.id && seenNotifIdsRef.current.has(data.id)) {
        return;
      }
      if (data.id) {
        seenNotifIdsRef.current.add(data.id);
      }

      toast({
        variant: data.type === "error" ? "destructive" : "default",
        title:
          data.title ||
          (data.type === "error"
            ? "Error"
            : data.type === "warning"
              ? "Peringatan"
              : "Notifikasi Baru"),
        description: data.message || "Ada notifikasi baru",
      });

      // Play sound
      if (audioRef.current) {
        audioRef.current.play().catch((err) => console.log('Audio play failed:', err));
      }

      // Add to notifications list if has ID (deduplicated)
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

        setNotifications((prev) =>
          prev.some((n) => n.id === newNotif.id) ? prev : [newNotif, ...prev]
        );
      }

      // Increment unread count
      setUnreadCount((prev) => prev + 1);
    },
    [toast]
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
        let currentEvent = "";
        let currentData = "";

        if (!reader) return;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const rawLine of lines) {
            const line = rawLine.replace(/\r$/, "");
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              currentData = line.slice(5).trim();
            } else if (line === "" && currentEvent && currentData) {
              try {
                if (currentEvent === "notification") {
                  const parsed = JSON.parse(currentData);
                  const notifData = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
                  handleSSENotification(notifData);
                  broadcastChannelRef.current?.postMessage({
                    type: "notification",
                    payload: notifData,
                  });
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

  // Connect when authenticated (skip public kiosk/display routes; 1 shared SSE leader across tabs)
  useEffect(() => {
    if (!isAuthenticated || !token || isStandaloneDisplayRoute()) {
      disconnectSSE();
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications();

    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("simrs_sse_notifications")
        : null;
    broadcastChannelRef.current = channel;

    if (channel) {
      channel.onmessage = (event) => {
        if (event.data?.type === "notification" && event.data?.payload) {
          handleSSENotification(event.data.payload);
        }
      };
    }

    let released = false;
    let releaseLock: (() => void) | null = null;
    const lockAbortController = new AbortController();

    const startLeaderSSE = () => {
      if (typeof navigator !== "undefined" && "locks" in navigator && channel) {
        void navigator.locks
          .request(
            "simrs_sse_leader",
            { signal: lockAbortController.signal },
            () =>
              new Promise<void>((resolve) => {
                if (released) {
                  resolve();
                  return;
                }
                releaseLock = resolve;
                connectSSE();
              })
          )
          .catch(() => {
            // Lock request aborted on unmount
          });
      } else {
        connectSSE();
      }
    };

    startLeaderSSE();

    const handlePageHide = () => {
      released = true;
      lockAbortController.abort();
      disconnectSSE();
      releaseLock?.();
      releaseLock = null;
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      released = true;
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      lockAbortController.abort();
      disconnectSSE();
      releaseLock?.();
      releaseLock = null;
      channel?.close();
      if (broadcastChannelRef.current === channel) {
        broadcastChannelRef.current = null;
      }
    };
  }, [isAuthenticated, token, fetchNotifications, connectSSE, disconnectSSE, handleSSENotification]);

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


