import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export const StudentAnnouncementViewer = () => {
  const { id } = useParams<{ id: string }>();
  const [announcement, setAnnouncement] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const actualId = id.replace(/^ann-/, '');
    setLoading(true);
    supabase
      .from("announcements" as any)
      .select("*")
      .eq("id", actualId)
      .single()
      .then(({ data }) => {
        setAnnouncement(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!announcement) return <div className="p-8 text-center text-destructive">Announcement not found.</div>;

  return (
    <div className="flex justify-center items-center min-h-screen bg-background">
      <Card className="w-full max-w-2xl p-4">
        <CardHeader>
          <CardTitle className="text-2xl mb-2">{announcement.title}</CardTitle>
          <div className="text-xs text-muted-foreground mb-2">
            {format(new Date(announcement.created_at), "PPPpp")}
          </div>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-line text-lg">{announcement.body}</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentAnnouncementViewer;
