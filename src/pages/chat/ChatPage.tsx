import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ChatFileUpload } from "@/components/chat/ChatFileUpload";

interface Message {
  id: string;
  sender_id: string;
  sender_role: string;
  content: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  created_at: string;
}

export const ChatPage = ({ conversationId }: { conversationId: string }) => {
  const { user, userRole } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId) return;
    // Fetch messages
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error || !data || !Array.isArray(data)) {
          setMessages([]);
        } else {
          // Filter out any items that do not have required Message fields
          const validMessages = (data as any[]).filter(
            (msg) =>
              msg &&
              typeof msg.id === "string" &&
              typeof msg.sender_id === "string" &&
              typeof msg.sender_role === "string" &&
              "content" in msg &&
              "created_at" in msg
          );
          setMessages(validMessages.map((msg) => ({
            id: msg.id,
            sender_id: msg.sender_id,
            sender_role: msg.sender_role,
            content: msg.content ?? null,
            attachment_url: msg.attachment_url ?? null,
            attachment_type: msg.attachment_type ?? null,
            created_at: msg.created_at,
          })));
        }
      });
    // Subscribe to new messages
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);
    await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        sender_role: userRole,
        content: input,
      } as any);
    setInput("");
    setLoading(false);
  };

  const handleFileUpload = async (url: string, type: string) => {
    setLoading(true);
    await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        sender_role: userRole,
        content: input || null,
        attachment_url: url,
        attachment_type: type,
      } as any);
    setInput("");
    setLoading(false);
  };

  return (
    <Card className="max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Chat</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96 overflow-y-auto mb-4 border rounded p-2 bg-muted">
          {messages.map((msg) => (
            <div key={msg.id} className={`mb-2 flex ${msg.sender_id === user.id ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-xs p-2 rounded-lg ${msg.sender_id === user.id ? "bg-blue-100" : "bg-gray-100"}`}>
                {msg.content && <div className="mb-1">{msg.content}</div>}
                {msg.attachment_url && (
                  <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                    Attachment
                  </a>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {format(new Date(msg.created_at), "PPP p")}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex gap-2 items-center">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={loading || !input.trim()}>
            Send
          </Button>
          <ChatFileUpload conversationId={conversationId} onUpload={handleFileUpload} />
        </div>
      </CardContent>
    </Card>
  );
};
