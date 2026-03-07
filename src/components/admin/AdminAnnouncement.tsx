import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const AdminAnnouncement = () => {
  const [announcement, setAnnouncement] = useState("");
  const [loading, setLoading] = useState(false);

  const sendAnnouncement = async () => {
    if (!announcement.trim()) {
      toast.error("Announcement cannot be empty");
      return;
    }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in as an admin to send announcements");
      setLoading(false);
      return;
    }

    // Insert into global announcements table for scalability
    const { error: insertError } = await (supabase as any)
      .from("announcements")
      .insert({
        title: "Important Update",
        body: announcement,
        created_by: user.id,
        created_at: new Date().toISOString()
      });

    setLoading(false);
    if (insertError) {
      console.error(insertError);
      toast.error("Failed to send announcement");
    } else {
      toast.success("Announcement sent to all students");
      setAnnouncement("");
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Send Announcement to All Students</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          value={announcement}
          onChange={e => setAnnouncement(e.target.value)}
          placeholder="Type your announcement here..."
          rows={4}
          className="mb-4"
        />
        <Button onClick={sendAnnouncement} disabled={loading}>
          {loading ? "Sending..." : "Send Announcement"}
        </Button>
      </CardContent>
    </Card>
  );
};
