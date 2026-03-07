import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const SupervisorChatList = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) return;
    // Fetch all conversations for this supervisor
    supabase
      .from("conversations" as any)
      .select("id, student_id")
      .eq("supervisor_id", user.id)
      .then(({ data }) => {
        setConversations(data || []);
      });
  }, [user?.id]);

  if (conversations.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Chats with Students</CardTitle>
      </CardHeader>
      <CardContent>
        {conversations.map(conv => (
          <div key={conv.id} className="mb-2 flex items-center justify-between">
            <span>Student: {conv.student_id}</span>
            <Button onClick={() => navigate(`/chat/${conv.id}`)}>
              Open Chat
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
