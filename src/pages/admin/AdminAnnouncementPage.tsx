import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const AdminAnnouncementPage = () => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  const sendAnnouncement = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required");
      return;
    }
    setLoading(true);
      // Fallback: Just insert into announcements table if RPC is not available
      // Use supabase client with correct types if available
      // If 'announcements' is not in generated types, use 'from("announcements" as any)' and only insert supported fields
      const { data, error } = await supabase
        .from("announcements")
        .insert({
          title,
          message: body
        })
        .select()
        .single();
      setLoading(false);
      if (error || !data) {
        toast.error("Failed to create announcement");
        return;
      }
      toast.success("Announcement created");
      setTitle("");
      setBody("");
  };

  return (
    <Card className="max-w-xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Send Announcement to All Students</CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title"
          className="mb-4"
        />
        <Textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Type your announcement here..."
          rows={6}
          className="mb-4"
        />
        <Button onClick={sendAnnouncement} disabled={loading}>
          {loading ? "Sending..." : "Send Announcement"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminAnnouncementPage;
