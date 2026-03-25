import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bell, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

const StudentAnnouncements = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["student", "announcements"],
    queryFn: async (): Promise<AnnouncementRow[]> => {
      const { data, error } = await (supabase as any)
        .from("announcements")
        .select("id, title, body, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`lastReadAnnouncementTime_${user.id}`, new Date().toISOString());
    }
  }, [user?.id, announcements]);

  return (
    <div className="min-h-screen bg-gradient-light">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Button variant="ghost" onClick={() => navigate("/student/dashboard")}> 
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Announcements
              </CardTitle>
              <CardDescription>
                Stay updated with SIWES notices sent by the admin team.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading && <p className="text-sm text-muted-foreground">Loading announcements...</p>}

              {!isLoading && announcements.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="font-medium">No announcements yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    New updates will appear here once they are published.
                  </p>
                </div>
              )}

              {!isLoading &&
                announcements.map((announcement) => (
                  <button
                    key={announcement.id}
                    type="button"
                    onClick={() => navigate(`/announcements/${announcement.id}`)}
                    className="w-full rounded-lg border bg-card p-4 text-left transition hover:border-primary/50 hover:bg-accent/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{announcement.title}</h3>
                          <Badge variant="outline">Global</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {announcement.body}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </button>
                ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default StudentAnnouncements;
