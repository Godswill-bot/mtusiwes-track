import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateConversation, listMessages, sendMessage, formatDateGroup } from '@/lib/chatHelpers';
import { Paperclip, Send, User, ArrowLeft, Reply, X, RefreshCw, Copy, Edit2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

// Custom hook to simulate long press for touch devices
function useLongPress(onLongPress: (e: any) => void, ms = 500) {
  const timerRef = useRef<NodeJS.Timeout>();

  const start = useCallback((e: any) => {
    e.persist?.();
    timerRef.current = setTimeout(() => {
      onLongPress(e);
    }, ms);
  }, [onLongPress, ms]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  return { onTouchStart: start, onTouchEnd: stop, onTouchMove: stop, onTouchCancel: stop }; }

// Minimal supervisor mini-profile component
function SupervisorProfile({ supervisor }: { supervisor: any }) {
  return (
    <div className="flex flex-col items-center p-4 border-r h-full bg-card">
      <div className="h-16 w-16 bg-primary/20 rounded-full flex items-center justify-center mb-3">
        <User className="h-8 w-8 text-primary" />
      </div>
      <div className="font-bold text-lg text-foreground">{supervisor?.name || 'Supervisor'}</div>
      <div className="text-sm text-muted-foreground">{supervisor?.email}</div>
    </div>
  );
}

export default function StudentChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [supervisor, setSupervisor] = useState<any>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // New states for reply feature
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [editingMsg, setEditingMsg] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleReply = (msg: any) => {
    setReplyingTo(msg);
    setEditingMsg(null);
    setTimeout(() => {
      const input = document.getElementById('message-input');
      if (input) {
        input.focus();
      }
    }, 150);
  };

  const handleEdit = (msg: any) => {
    setEditingMsg(msg);
    setReplyingTo(null);
    setMessage(msg.content || "");
    setTimeout(() => {
      const inputEl = document.getElementById('message-input');
      if (inputEl) inputEl.focus();
    }, 150);
  };

  const longPressHandlers = useLongPress((e) => {
    if (e.touches && e.touches.length > 0) {
      const touch = e.touches[0];
      const target = e.currentTarget as HTMLElement;
      // We simulate a context menu event
      const contextMenuEvent = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
      target.dispatchEvent(contextMenuEvent);
      // Try to vibrate
      if (navigator.vibrate) navigator.vibrate(50);
    }
  }, 500);

  const handleManualReload = async () => {
    if (!conversation?.id) return;
    setIsRefreshing(true);
    const msgs = await listMessages(conversation.id);
    setMessages(msgs);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Fetch assigned supervisor and conversation
  useEffect(() => {
    async function fetchChat() {
      setLoading(true);
      let supervisorId = null;
      let supervisorName = null;
      let supervisorEmail = null;
      let stuId = null;
      
      const { data: studentData } = await supabase
        .from('students')
        .select('id, supervisor_id, school_supervisor_name, school_supervisor_email, profile_image_url')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (studentData) {
        stuId = studentData.id;
        supervisorId = studentData.supervisor_id;
        supervisorName = studentData.school_supervisor_name;
        supervisorEmail = studentData.school_supervisor_email;
        if (studentData.profile_image_url) {
          setMyAvatar(studentData.profile_image_url);
        }
      }
      if (stuId) {
        const { data: assignment } = await supabase
          .from('supervisor_assignments')
          .select('supervisor_id, supervisors(name, email)')
          .eq('student_id', stuId)
          .eq('assignment_type', 'school_supervisor')
          .maybeSingle();
          
        if (assignment && assignment.supervisor_id) {
          supervisorId = assignment.supervisor_id;
          supervisorName = (assignment.supervisors as any)?.name;
          supervisorEmail = (assignment.supervisors as any)?.email;
        }
      }
      
      if (!supervisorId || !stuId) {
        setLoading(false);
        return;
      }
      
      setSupervisor({ id: supervisorId, name: supervisorName, email: supervisorEmail });
      
      const conv = await getOrCreateConversation(supervisorId, stuId);
      setConversation(conv);
      setStudentId(stuId);
      
      if (conv) {
        const msgs = await listMessages(conv.id);
        setMessages(msgs);
      }
      setLoading(false);
    }
    
    if (user?.id) fetchChat();
  }, [user?.id]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message && !attachment) return;

    if (editingMsg) {
      // Handle optimistic update
      const tempId = editingMsg.id;
      setMessages((prev: any[]) => prev.map(m => m.id === tempId ? { ...m, content: message.trim() } : m));
      
      const { error } = await (supabase as any)
        .from('messages')
        .update({ content: message.trim() })
        .eq('id', tempId);
        
      if (error) {
         console.error('Failed to update message', error);
         // could optionally restore old message here
      }
      setEditingMsg(null);
      setMessage('');
      return;
    }

    let attachmentUrl = null;
    let attachmentName = null;
    
    if (attachment) {
      if (attachment.size > 5 * 1024 * 1024) {
        setUploadError('File too large (max 5MB)');
        return;
      }
      const allowed = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowed.some(type => attachment.type.startsWith(type))) {
        setUploadError('Invalid file type');
        return;
      }
      
      const filePath = `chat/${conversation.id}/${Date.now()}_${attachment.name}`;
      const { error } = await supabase.storage.from('chat-attachments').upload(filePath, attachment);
      
      if (error) {
        setUploadError('Upload failed');
        return;
      }
      
      const { data: publicData } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
      attachmentUrl = publicData?.publicUrl;
      attachmentName = attachment.name;
    }
    
    setUploadError('');
    
    const tempId = `temp-${Date.now()}`;
    
    // Add optimistic message
    setMessages(msgs => [...msgs, {
      id: tempId,
      sender_id: studentId,
      sender_role: 'student',
      content: message,
      attachment_url: attachmentUrl,
      attachment_name: attachmentName,
      created_at: new Date().toISOString(),
      parent_id: replyingTo?.id || null,
      parent: replyingTo ? {
        id: replyingTo.id,
        content: replyingTo.content,
        sender_role: replyingTo.sender_role
      } : null,
      optimistic: true,
    }]);
    
    const sentMessageContent = message;
    const parentIdToUse = replyingTo?.id;
    
    setMessage('');
    setAttachment(null);
    setReplyingTo(null);
    const sent = await sendMessage({
      conversationId: conversation.id,
      senderId: studentId,
      senderRole: 'student',
      content: sentMessageContent,
      attachmentUrl,
      attachmentName,
      parentId: parentIdToUse,
    });
    
    if (sent) {
      // In case the sent message doesn't return the joined parent object, we manually add it for the UI
      if (parentIdToUse) {
        sent.parent = messages.find(m => m.id === parentIdToUse);
      }
      setMessages(msgs => msgs.map(m => m.id === tempId ? sent : m));
    }
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/40 border-t-transparent"></div></div>;
  if (!supervisor) return <div className="flex items-center justify-center h-screen text-red-500">No supervisor assigned. Chat unavailable.</div>;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-muted border-t" >
      {/* Left Profile */}
      <div className="hidden md:block w-1/4 max-w-[280px] shadow-sm z-10">
        <SupervisorProfile supervisor={supervisor} />
      </div>

      {/* Main Chat Thread */}
      <div className="flex-1 flex flex-col h-full bg-card relative">
          {/* Header */}
          <div className="flex items-center p-3 border-b bg-card shadow-sm z-10 justify-between">
            <div className="flex items-center">
              <button onClick={() => navigate(-1)} className="mr-3 md:hidden text-muted-foreground hover:text-primary transition" title="Go back">
                <ArrowLeft />
              </button>
              <div className="flex items-center gap-2">
                <div className="bg-primary/20 p-1 rounded-full md:hidden">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <span className="font-bold text-foreground md:hidden">{supervisor.name}</span>
                <span className="font-bold text-foreground hidden md:inline ml-2">Chat Thread</span>
              </div>
            </div>
            
            <button 
              onClick={handleManualReload}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted text-sm font-medium transition"
              title="Refresh messages"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar  ">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/70 opacity-70">
              <Send className="h-12 w-12 mb-4 text-primary/40" />
              <p>Start a secure conversation with your supervisor.</p>
            </div>
          ) : (
            <div className="space-y-6">
                {messages.map((msg, index) => {
                  const isMe = msg.sender_role === 'student';
                  const currentDateGroup = formatDateGroup(msg.created_at);
                  const prevDateGroup = index > 0 ? formatDateGroup(messages[index - 1].created_at) : null;
                  const showDateGroup = currentDateGroup !== prevDateGroup;

                  return (
                  <React.Fragment key={msg.id}>
                    {showDateGroup && (
                      <div className="flex justify-center my-4 sticky top-0 z-10">
                        <span className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full shadow-sm font-medium">
                          {currentDateGroup}
                        </span>
                      </div>
                    )}
                    <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
                      {!isMe && (
                        <Avatar className="h-8 w-8 mt-auto shrink-0 shadow-sm">
                          <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                            {supervisor?.name?.charAt(0)?.toUpperCase() || 'S'}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="group relative max-w-[92%] sm:max-w-[85%] md:max-w-[70%]">
                        {/* Message Bubble container with ContextMenu */}
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`relative transition flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              {...longPressHandlers}
                              style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
                              className={`flex flex-col w-full ${isMe ? 'items-end' : 'items-start'}`}
                            >
                           
                           {/* Replied to... section */}
                           {msg.parent && (
                             <div className={`mb-2 p-2 rounded-lg text-xs border ${isMe ? 'bg-primary/50 border-primary' : 'bg-muted border-border'} flex flex-col opacity-90`}>
                               <span className={`font-semibold mb-1 ${isMe ? 'text-primary-foreground' : 'text-primary'}`}>
                                 {msg.parent.sender_role === 'student' ? 'You' : supervisor.name}
                               </span>
                               <span className="truncate">{msg.parent.content || 'Attachment'}</span>
                             </div>
                           )}

                          {/* Content */}
                          {msg.content && <div className="text-[15px] leading-relaxed break-words">{msg.content}</div>}
                          
                          {/* Attachments */}
                          {msg.attachment_url && (
                            <div className="mt-2 text-sm">
                              {msg.attachment_url.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                                <img src={msg.attachment_url} alt={msg.attachment_name} className="max-h-48 rounded-lg mt-1 cursor-pointer hover:opacity-90 transition border border-black/10" onClick={(e) => { e.stopPropagation(); window.open(msg.attachment_url, '_blank'); }} />
                              ) : (
                                <div className={`flex items-center gap-2 p-2 rounded-lg border ${isMe ? 'bg-primary border-primary' : 'bg-muted border-border'}`}>
                                  <Paperclip className="h-4 w-4 shrink-0" />
                                  <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                                    {msg.attachment_name || 'Download File'}
                                  </a>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Metadata */}
                          <div className={`text-[10px] mt-2 flex justify-end items-center gap-1 ${isMe ? 'text-primary/40' : 'text-muted-foreground/70'}`}>
                            {msg.optimistic ? 'sending...' : new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>

                            </div>
                          </ContextMenuTrigger>

                          <ContextMenuContent className="w-48 bg-card shadow-lg p-1">
                            <ContextMenuItem 
                              onSelect={() => handleReply(msg)}
                                className="flex items-center cursor-pointer px-2 py-1.5 text-sm outline-none rounded-sm hover:bg-muted focus:bg-muted"
                              >
                                <Reply className="mr-2 h-4 w-4" />
                                <span>Reply</span>
                              </ContextMenuItem>
                              {isMe && msg.content && (
                                <ContextMenuItem
                                  onSelect={() => handleEdit(msg)}
                                  className="flex items-center cursor-pointer px-2 py-1.5 text-sm outline-none rounded-sm hover:bg-muted focus:bg-muted"
                                >
                                  <Edit2 className="mr-2 h-4 w-4" />
                                  <span>Edit</span>
                                </ContextMenuItem>
                              )}
                              {msg.content && (
                                <ContextMenuItem 
                                  onSelect={(e) => {
                                    navigator.clipboard.writeText(msg.content);
                                }}
                                className="flex items-center cursor-pointer px-2 py-1.5 text-sm outline-none rounded-sm hover:bg-muted focus:bg-muted"
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                <span>Copy message</span>
                              </ContextMenuItem>
                            )}
                          </ContextMenuContent>
                        </ContextMenu>
                        </motion.div>
                    </div>                      {isMe && (
                        <Avatar className="h-8 w-8 mt-auto shrink-0 shadow-sm border border-primary/20">
                          {myAvatar && <AvatarImage src={myAvatar} alt="My profile" />}
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                            {user?.email?.charAt(0)?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      )}                  </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-card border-t z-10 shadow-[0_-10px_20px_-15px_rgba(0,0,0,0.05)]">
          <AnimatePresence>
            {replyingTo && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                exit={{ opacity: 0, height: 0 }}
                className="mb-3 flex items-center justify-between bg-primary/10/50 border border-primary/20 rounded-lg p-2 overflow-hidden"
              >
                <div className="flex-1 border-l-2 border-primary pl-3">
                  <div className="text-xs text-primary font-semibold flex items-center gap-1">
                    <Reply className="h-3 w-3" />
                    Replying to {replyingTo.sender_role === 'student' ? 'yourself' : supervisor.name}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">{replyingTo.content || 'Attachment'}</div>
                </div>
                <button aria-label="Cancel reply" title="Cancel reply" type="button" onClick={() => setReplyingTo(null)} className="p-1 hover:bg-primary/20 rounded-full text-muted-foreground/70 hover:text-muted-foreground transition">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

        {/* Edit mode banner */}
        {editingMsg && (
          <div className="flex items-center justify-between bg-primary/10 px-4 py-2 border-t border-primary/20">
            <div className="text-sm text-primary font-medium flex items-center gap-2">
              <Edit2 className="h-4 w-4" />
              Editing message...
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 rounded-full"
              onClick={() => setEditingMsg(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

          <form className="flex gap-2 items-center" onSubmit={handleSend}>
            <label htmlFor="chat-upload" className="cursor-pointer p-2 text-muted-foreground/70 hover:text-primary hover:bg-primary/10 rounded-full transition" title="Attach file">
              <Paperclip className="h-5 w-5" />
            </label>
            <input
              id="chat-upload"
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={e => setAttachment(e.target.files?.[0] || null)}
              className="hidden"
              title="Attach file"
              aria-label="Attach file"
            />
            
            <div className="flex-1 flex flex-col bg-transparent dark:bg-muted/10 border rounded-2xl ring-primary/20 focus-within:ring-2 focus-within:border-primary/40 transition-all overflow-hidden px-3 py-1">
              {attachment && (
                <div className="flex items-center gap-2 text-xs bg-primary/20 text-primary p-1.5 rounded-lg mb-1 mt-1 font-medium w-fit max-w-full">
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="truncate">{attachment.name}</span>
                  <X className="h-3 w-3 cursor-pointer shrink-0 ml-1" onClick={() => setAttachment(null)} />
                </div>
              )}
              <input
                id="message-input"
                name="message"
                title="Message input"
                aria-label="Message input"
                type="text"
                className="w-full bg-transparent border-none focus:outline-none py-2 text-[15px] text-foreground placeholder:text-muted-foreground"
                placeholder="Type your message..."
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>
            
            <button
              type="submit"
              disabled={(!message.trim() && !attachment) || loading}
              className="bg-primary hover:bg-primary text-primary-foreground p-3 rounded-full disabled:opacity-50 disabled:hover:bg-primary transition flex items-center justify-center shadow-md active:scale-95"
              aria-label="Send message"
              title="Send message"
            >
              <Send className="h-5 w-5 ml-1" />
            </button>
          </form>
          
          {uploadError && <div className="text-red-500 text-xs mt-2 pl-12">{uploadError}</div>}
        </div>
      </div>
    </div>
  );
}

