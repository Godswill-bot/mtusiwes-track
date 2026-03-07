
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Fallback type for demonstration if conversations table is not in types
interface Conversation {
  id: string;
  participant_ids?: string[];
  last_message?: string | null;
  updated_at?: string;
}

export const ChatLobby = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    // Use 'as any' to bypass type error if conversations table is not in types
    supabase
      .from("conversations" as any)
      .select("*")
      .contains("participant_ids", [user.id])
      .order("updated_at", { ascending: false })
      .then(({ data, error }: { data: any[]; error: any }) => {
        setLoading(false);
        if (error || !data) {
          setConversations([]);
        } else {
          setConversations(data as Conversation[]);
        }
      });
  }, [user]);

  if (!user) {
    return <div className="p-8 text-center text-destructive">Please log in to view your conversations.</div>;
  }

  return (
    <Card className="max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Chat Lobby</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div>Loading conversations...</div>
        ) : conversations.length === 0 ? (
          <div className="text-center text-muted-foreground">No conversations found.</div>
        ) : (
          <ul className="space-y-4">
            {conversations.map((conv) => (
              <li key={conv.id} className="flex items-center justify-between border-b pb-2">
                <div>
                  <div className="font-semibold">Conversation ID: {conv.id}</div>
                  <div className="text-xs text-muted-foreground">
                    Last message: {conv.last_message || "(No messages yet)"}
                  </div>
                </div>
                <Button onClick={() => navigate(`/chat/${conv.id}`)} size="sm">
                  Open
                </Button>
              </li>
            ))}
          </ul>
        )}
        {/* Optionally, add a button to start a new conversation */}
        <div className="mt-6 text-center">
          <Button onClick={() => navigate("/student/dashboard")}>Back to Dashboard</Button>
        </div>
      </CardContent>
    </Card>
  );
};
