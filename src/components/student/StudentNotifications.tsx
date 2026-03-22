import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, UserCheck, AlertCircle, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link?: string;
  created_at: string;
}

export const StudentNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState(false); // For dropdown/collapse
  const [openAnnouncement, setOpenAnnouncement] = useState<null | Notification>(null);
  const navigate = useNavigate();

  const { data: notifications = [], isPending } = useQuery({
    queryKey: ["student", "notifications", user?.id],
        queryFn: async (): Promise<Notification[]> => {
      if (!user?.id) return [];

      // 1. Query personal notifications
      const { data: personalNotes, error: notifError } = await (supabase as any)
        .from('notifications')
        .select('id, title, message, type, is_read, link, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (notifError) console.error('Failed to fetch notifications:', notifError);

      // 2. Query global announcements
      const { data: globalAnnouncements, error: annError } = await (supabase as any)
        .from('announcements')
        .select('id, title, body, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (annError) console.error('Failed to fetch announcements:', annError);

      const parsedPersonal = (personalNotes as unknown as Notification[]) || [];
      
      const parsedGlobal = (globalAnnouncements || []).map((ann: any) => ({
        id: `ann-${ann.id}`,
        title: `?? Global: ${ann.title}`,
        message: ann.body,
        type: 'announcement',
        is_read: false, // Announcements are treated as unread or stateless
        created_at: ann.created_at
      }));

      // Merge and sort
      const allNotifs = [...parsedPersonal, ...parsedGlobal].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return allNotifs;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
        const { error } = await (supabase as any)
          .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", "notifications", user?.id] });
    },
  });

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`student-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["student", "notifications", user?.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "supervisor_assignment":
      case "assignment":
        return <UserCheck className="h-4 w-4 text-blue-500" />;
      case "logbook_review":
        return <FileText className="h-4 w-4 text-green-500" />;
      case "system_alert":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "supervisor_assignment":
      case "assignment":
        return "bg-blue-100 text-blue-800";
      case "logbook_review":
        return "bg-green-100 text-green-800";
      case "system_alert":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-muted text-foreground";
    }
  };


  const unreadCount = notifications.filter(n => !n.is_read).length;
  const displayNotifications = showAll ? notifications : notifications.filter(n => !n.is_read);
  // For dropdown: show only a few notifications unless expanded
  const COLLAPSED_COUNT = 3;
  const visibleNotifications = expanded ? displayNotifications : displayNotifications.slice(0, COLLAPSED_COUNT);

  // Don't render if no notifications
  if (notifications.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount} new
              </Badge>
            )}
          </CardTitle>
          {notifications.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? "Show unread only" : "Show all"}
              </Button>
              {displayNotifications.length > COLLAPSED_COUNT && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExpanded((prev) => !prev)}
                >
                  {expanded ? "Show less" : `Show more (${displayNotifications.length - COLLAPSED_COUNT})`}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <p className="text-muted-foreground text-sm">Loading notifications...</p>
        ) : displayNotifications.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {showAll ? "No notifications yet." : "No unread notifications."}
          </p>
        ) : (
          <div className="space-y-3">
            {visibleNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  notification.is_read ? "bg-muted/30" : "bg-primary/10 border-blue-200"
                } cursor-pointer`}
                  // Remove ref_id usage, fallback to notification.id for navigation if needed
                  onClick={() => {
                    if (notification.type === "announcement") {
                      navigate(`/announcements/${notification.id}`);
                    }
                  }}
              >
                <div className="mt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-medium text-sm ${!notification.is_read ? "text-blue-900" : ""}`}>
                      {notification.title}
                    </h4>
                    <Badge variant="outline" className={`text-xs ${getTypeBadgeColor(notification.type)}`}>
                      {notification.type.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className={`text-sm ${notification.is_read ? "text-muted-foreground" : "text-blue-800"}`}>
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </p>
                </div>
                  {"ref_id" in notification && notification.ref_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-2"
                      onClick={() => navigate(`/announcement/${notification.ref_id}`)}
                    >
                      View
                    </Button>
                  )}
              </div>
            ))}
            {/* Announcement Fullscreen Modal */}
            <Dialog open={!!openAnnouncement} onOpenChange={() => setOpenAnnouncement(null)}>
              <DialogContent className="max-w-2xl">
                {openAnnouncement && (
                  <>
                    <DialogHeader>
                      <DialogTitle>{openAnnouncement.title}</DialogTitle>
                      <DialogDescription>
                        {formatDistanceToNow(new Date(openAnnouncement.created_at), { addSuffix: true })}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 text-lg whitespace-pre-line">
                      {openAnnouncement.message}
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
