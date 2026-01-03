import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  user_id: string | null;
  user_type: string | null;
  user_email: string | null;
  related_table: string | null;
  related_record_id: string | null;
  is_read: boolean;
  created_at: string;
}

const fetchNotifications = async (): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from("admin_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
};

const markAsRead = async (notificationId: string) => {
  const { error } = await supabase
    .from("admin_notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) throw error;
};

const markAllAsRead = async () => {
  const { error } = await supabase
    .from("admin_notifications")
    .update({ is_read: true })
    .eq("is_read", false);

  if (error) throw error;
};

const deleteNotification = async (notificationId: string) => {
  const { error } = await supabase
    .from("admin_notifications")
    .delete()
    .eq("id", notificationId);

  if (error) throw error;
};

export const AdminNotifications = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("unread");

  const { data: notifications = [], isPending, refetch } = useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const markReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      toast.success("All notifications marked as read");
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
    },
  });

  // Subscribe to real-time notifications
  useEffect(() => {
    const channel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "admin_notifications",
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((n) => !n.is_read)
      : notifications;

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "password_reset":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "profile_update":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "account_created":
        return "bg-green-100 text-green-800 border-green-300";
      case "account_verified":
        return "bg-purple-100 text-purple-800 border-purple-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "password_reset":
        return "🔑";
      case "profile_update":
        return "✏️";
      case "account_created":
        return "➕";
      case "account_verified":
        return "✓";
      default:
        return "📢";
    }
  };

  return (
    <Card className="shadow-elevated">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Notifications</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilter(filter === "all" ? "unread" : "all")}
            >
              {filter === "all" ? "Unread Only" : "Show All"}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
              >
                <Check className="h-4 w-4 mr-2" />
                Mark All Read
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isPending}
            >
              <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <CardDescription>
          Real-time updates on user activities and system changes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading notifications...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {filter === "unread" ? "No unread notifications" : "No notifications"}
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border ${
                  notification.is_read
                    ? "bg-muted/30 border-border"
                    : "bg-primary/5 border-primary/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">
                        {getNotificationIcon(notification.notification_type)}
                      </span>
                      <Badge
                        variant="outline"
                        className={getNotificationColor(notification.notification_type)}
                      >
                        {notification.notification_type.replace("_", " ")}
                      </Badge>
                      {!notification.is_read && (
                        <Badge variant="default" className="ml-auto">
                          New
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-semibold text-sm mb-1">
                      {notification.title}
                    </h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      {notification.message}
                    </p>
                    {notification.user_email && (
                      <p className="text-xs text-muted-foreground">
                        User: {notification.user_email} ({notification.user_type})
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {!notification.is_read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markReadMutation.mutate(notification.id)}
                        disabled={markReadMutation.isPending}
                        className="h-8 w-8 p-0"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(notification.id)}
                      disabled={deleteMutation.isPending}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

