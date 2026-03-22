import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ChatFileUpload } from "@/components/chat/ChatFileUpload";
import { Reply, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { listMessages, formatDateGroup } from "@/lib/chatHelpers";
import React from 'react';

interface Message {
  id: string;
  sender_id: string;
  sender_role: string;
  content: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name?: string | null;
  created_at: string;
  parent_id?: string | null;
  parent?: any;
}

export const ChatPage = ({ conversationId }: { conversationId: string }) => {
  const { user, userRole } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reply states
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    // Use our helper to get messages with parent joins
    const fetchMsgs = async () => {
      const msgs = await listMessages(conversationId);
      setMessages(msgs || []);
    };
    fetchMsgs();

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          // Re-fetch to get the joins (parent messages), easier than manually querying the parent
          const updatedMsgs = await listMessages(conversationId);
          setMessages(updatedMsgs || []);
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

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);
    
    await supabase
      .from("messages" as any)
      .insert({
        conversation_id: conversationId,
        sender_id: user?.id,
        sender_role: userRole,
        content: input,
        parent_id: replyingTo?.id || null,
      } as any);
      
    setInput("");
    setReplyingTo(null);
    setActiveMessageId(null);
    setLoading(false);
  };

  const handleFileUpload = async (url: string, type: string) => {
    setLoading(true);
    await supabase
      .from("messages" as any)
      .insert({
        conversation_id: conversationId,
        sender_id: user?.id,
        sender_role: userRole,
        content: input || null,
        attachment_url: url,
        attachment_type: type,
        parent_id: replyingTo?.id || null,
      } as any);
      
    setInput("");
    setReplyingTo(null);
    setActiveMessageId(null);
    setLoading(false);
  };

  return (
    <Card className="max-w-3xl mx-auto mt-8 shadow-card flex flex-col h-[80vh]" onClick={() => setActiveMessageId(null)}>
      <CardHeader className="border-b bg-gray-50/50 pb-4">
        <CardTitle className="text-xl text-primary">Chat Console</CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50 relative bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-[size:24px_24px]">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground mt-10">Starting conversation...</div>
          ) : (
            <div className="space-y-6">
                {messages.map((msg, index) => {
                  const isMe = msg.sender_id === user?.id;
                  const showActions = activeMessageId === msg.id;

                  const currentDateGroup = formatDateGroup(msg.created_at);
                  const prevDateGroup = index > 0 ? formatDateGroup(messages[index - 1].created_at) : null;
                  const showDateGroup = currentDateGroup !== prevDateGroup;

                  return (
                  <React.Fragment key={msg.id}>
                    {showDateGroup && (
                      <div className="flex justify-center my-4 sticky top-0 z-10">
                        <span className="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full shadow-sm font-medium">
                          {currentDateGroup}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div 
                      className="group relative max-w-[85%] md:max-w-[70%]"
                    >
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`relative transition select-none flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        {/* Option Actions Sidebar - Always visible on mobile, hover on desktop */}
                        <div 
                          className={`absolute top-1/2 -translate-y-1/2 ${isMe ? '-left-12' : '-right-12'} 
                          opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300 ease-in-out flex bg-white border shadow-sm rounded-full p-1.5 z-10 cursor-pointer`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setReplyingTo(msg);
                          }}
                          title="Reply"
                        >
                          <Reply className="h-4 w-4 text-purple-600 hover:text-purple-800" />
                        </div>

                        {/* Message Bubble */}
                        <div className={`p-3.5 rounded-2xl shadow-sm border ${isMe ? 'bg-primary text-primary-foreground rounded-br-sm border-primary' : 'bg-white text-gray-800 rounded-bl-sm border-gray-100'}`}>
                          
                          {/* Replied to section */}
                          {msg.parent && (
                            <div className={`mb-2 p-2 rounded-lg text-xs border ${isMe ? 'bg-primary-foreground/20 border-primary-foreground/30' : 'bg-gray-50 border-gray-200'} flex flex-col opacity-90`}>
                              <span className="font-semibold mb-1 opacity-80">
                                Replying to {msg.parent.sender_role === msg.sender_role ? 'themselves' : (msg.parent.sender_role === 'student' ? 'Student' : 'Supervisor')}
                              </span>
                              <span className="truncate">{msg.parent.content || 'Attachment'}</span>
                            </div>
                          )}

                          {/* Content */}
                          {msg.content && <div className="text-[15px] leading-relaxed break-words">{msg.content}</div>}
                          
                          {/* Attachment Container */}
                          {msg.attachment_url && (
                            <div className="mt-2 text-sm">
                              {msg.attachment_url.match(/\.(jpg|jpeg|png|gif)$/i) || msg.attachment_type?.startsWith('image') ? (
                                <img src={msg.attachment_url} alt="attachment" className="max-h-48 rounded-lg mt-1 cursor-pointer hover:opacity-90 transition border border-black/10" onClick={(e) => { e.stopPropagation(); window.open(msg.attachment_url!, '_blank'); }} />
                              ) : (
                                <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className={`underline mt-2 inline-block ${isMe ? 'text-primary-foreground' : 'text-primary'}`}>
                                  Download ${msg.attachment_type === 'application/pdf' ? 'PDF' : 'Attachment'}
                                </a>
                              )}
                            </div>
                          )}

                          <div className={`text-[10px] mt-2 flex justify-end gap-1 ${isMe ? 'text-primary-foreground/70' : 'text-gray-400'}`}>
                            {format(new Date(msg.created_at), "p")}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t relative z-20 shadow-[0_-10px_20px_-15px_rgba(0,0,0,0.05)]">
          <AnimatePresence>
            {replyingTo && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                exit={{ opacity: 0, height: 0 }}
                className="mb-3 flex items-center justify-between bg-primary/5 border border-primary/10 rounded-lg p-2 overflow-hidden mx-1"
              >
                <div className="flex-1 border-l-2 border-primary pl-3">
                  <div className="text-xs text-primary font-semibold flex items-center gap-1">
                    <Reply className="h-3 w-3" />
                    Replying to {replyingTo.sender_role === 'student' ? 'Student' : 'Supervisor'}
                  </div>
                  <div className="text-sm text-gray-600 truncate">{replyingTo.content || 'Attachment'}</div>
                </div>
                <button title="Cancel reply" type="button" onClick={() => setReplyingTo(null)} className="p-1 hover:bg-primary/10 rounded-full text-gray-500 transition">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2 items-center">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type your message..."
              onKeyDown={e => { if (e.key === "Enter") handleSendMessage(); }}
              className="flex-1 shadow-sm rounded-full py-5 px-4"
            />
            <Button onClick={handleSendMessage} disabled={loading || !input.trim()} size="icon" className="rounded-full shrink-0 h-10 w-10">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </Button>
            <ChatFileUpload conversationId={conversationId} onUpload={handleFileUpload} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
