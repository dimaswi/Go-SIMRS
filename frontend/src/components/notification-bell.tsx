import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useNotifications } from "@/contexts/notification-context";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export function NotificationBell() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = (notification: {
    id: number;
    type: string;
    is_read: boolean;
    data?: string;
  }) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // Navigate based on notification type
    try {
      const data = notification.data ? JSON.parse(notification.data) : {};

      switch (notification.type) {
        case "visit_created":
          if (data.visit_id) {
            navigate(`/visits/${data.visit_id}`);
            setOpen(false);
          }
          break;
        case "admission_request":
          if (data.request_id) {
            navigate(`/admisi/${data.request_id}`);
            setOpen(false);
          }
          break;
        case "admission_approved":
          if (data.inpatient_visit_id) {
            navigate(`/visits/${data.inpatient_visit_id}`);
            setOpen(false);
          }
          break;
        case "procedure_order":
          if (data.target_visit_id) {
            navigate(`/visits/${data.target_visit_id}`);
            setOpen(false);
          }
          break;
        case "medicine_order":
          if (data.pharmacy_visit_id) {
            navigate(`/visits/${data.pharmacy_visit_id}`);
            setOpen(false);
          }
          break;
        case "bed_transfer":
          if (data.visit_id) {
            navigate(`/visits/${data.visit_id}`);
            setOpen(false);
          }
          break;
        case "discharge":
          if (data.visit_id) {
            navigate(`/visits/${data.visit_id}`);
            setOpen(false);
          }
          break;
        default:
          break;
      }
    } catch {
      // Ignore parse errors
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "visit_created":
        return "🏥";
      case "admission_request":
        return "📋";
      case "admission_approved":
        return "✅";
      case "admission_rejected":
        return "❌";
      case "procedure_order":
        return "🧪";
      case "medicine_order":
        return "💊";
      case "bed_transfer":
        return "🛏️";
      case "discharge":
        return "🚪";
      default:
        return "🔔";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] font-bold flex items-center justify-center"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifikasi</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notifikasi</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllAsRead()}
            >
              <Check className="h-3 w-3 mr-1" />
              Tandai semua dibaca
            </Button>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Tidak ada notifikasi</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 hover:bg-muted/50 cursor-pointer transition-colors relative group",
                    !notification.is_read && "bg-primary/5"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-3">
                    <span className="text-lg flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "text-sm font-medium truncate",
                            !notification.is_read && "text-primary"
                          )}
                        >
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: idLocale,
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Delete button - show on hover */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => {
                  // Could navigate to a full notifications page if we create one
                  setOpen(false);
                }}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Lihat semua notifikasi
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
