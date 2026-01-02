import { api } from "./client";

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  data?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  room?: {
    id: number;
    name: string;
    code: string;
  };
}

export interface NotificationData {
  id?: number;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  room_id?: number;
  created_at: string;
}

export const notificationsApi = {
  // Get all notifications
  getAll: (params?: { is_read?: string; limit?: number }) =>
    api.get<{ data: Notification[] }>("/notifications", { params }),

  // Get unread count
  getUnreadCount: () =>
    api.get<{ data: { count: number } }>("/notifications/unread-count"),

  // Mark as read
  markAsRead: (id: number) =>
    api.put(`/notifications/${id}/read`),

  // Mark all as read
  markAllAsRead: () =>
    api.put("/notifications/mark-all-read"),

  // Delete notification
  delete: (id: number) =>
    api.delete(`/notifications/${id}`),

  // Clear all
  clearAll: () =>
    api.delete("/notifications"),
};

// SSE Event types
export type SSEEventType = 
  | "connected"
  | "ping"
  | "notification"
  | "visit_created"
  | "admission_request"
  | "admission_approved"
  | "admission_rejected";
