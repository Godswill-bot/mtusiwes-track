import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateConversation, listMessages, sendMessage, formatDateGroup } from '@/lib/chatHelpers';
import { Paperclip, Send, User, ArrowLeft, Reply, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// Minimal supervisor mini-profile component
function SupervisorProfile({ supervisor }: { supervisor: any }) {
  return (
    <div className="flex flex-col items-center p-4 border-r h-full bg-white">
      <div className="h-16 w-16 bg-purple-100 rounded-full flex items-center justify-center mb-3">
        <User className="h-8 w-8 text-purple-700" />
      </div>
      <div className="font-bold text-lg text-gray-800">{supervisor?.name || 'Supervisor'}</div>
      <div className="text-sm text-gray-500">{supervisor?.email}</div>
    </div>
  );
}

export default function StudentChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [supervisor, setSupervisor] = useState<any>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // New states for reply feature
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        .select('id, supervisor_id, school_supervisor_name, school_supervisor_email')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (studentData) {
        stuId = studentData.id;
        supervisorId = studentData.supervisor_id;
        supervisorName = studentData.school_supervisor_name;
        supervisorEmail = studentData.school_supervisor_email;
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
    setActiveMessageId(null);
    
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

  // Poll
  useEffect(() => {
    if (!conversation?.id) return;
    const interval = setInterval(async () => {
      const msgs = await listMessages(conversation.id);
      setMessages(msgs);
    }, 3000);
    return () => clearInterval(interval);
  }, [conversation?.id]);

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-300 border-t-transparent"></div></div>;
  if (!supervisor) return <div className="flex items-center justify-center h-screen text-red-500">No supervisor assigned. Chat unavailable.</div>;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 border-t" onClick={() => setActiveMessageId(null)}>
      {/* Left Profile */}
      <div className="hidden md:block w-1/4 max-w-[280px] shadow-sm z-10">
        <SupervisorProfile supervisor={supervisor} />
      </div>

      {/* Main Chat Thread */}
      <div className="flex-1 flex flex-col h-full bg-white relative">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center p-3 border-b bg-white shadow-sm z-10">
          <button onClick={() => navigate(-1)} className="mr-3 text-gray-500 hover:text-purple-700 transition" title="Go back">
            <ArrowLeft />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-purple-100 p-1 rounded-full">
              <User className="h-5 w-5 text-purple-700" />
            </div>
            <span className="font-bold text-gray-800">{supervisor.name}</span>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar bg-[radial-gradient(#f3e8ff_1px,transparent_1px)] bg-[size:24px_24px]">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-70">
              <Send className="h-12 w-12 mb-4 text-purple-200" />
              <p>Start a secure conversation with your supervisor.</p>
            </div>
          ) : (
            <div className="space-y-6">
                {messages.map((msg, index) => {
                  const isMe = msg.sender_role === 'student';
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
                    <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className="group relative max-w-[85%] md:max-w-[70%]"
                    >
                      {/* Message Bubble container */}
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
                        <div className={`p-3.5 rounded-2xl shadow-sm border ${isMe ? 'bg-purple-600 text-white rounded-tr-sm border-purple-700' : 'bg-white text-gray-800 rounded-tl-sm border-gray-100'}`}>
                           
                           {/* Replied to... section */}
                           {msg.parent && (
                             <div className={`mb-2 p-2 rounded-lg text-xs border ${isMe ? 'bg-purple-500/50 border-purple-500' : 'bg-gray-50 border-gray-200'} flex flex-col opacity-90`}>
                               <span className={`font-semibold mb-1 ${isMe ? 'text-purple-100' : 'text-purple-700'}`}>
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
                                <div className={`flex items-center gap-2 p-2 rounded-lg border ${isMe ? 'bg-purple-700 border-purple-500' : 'bg-gray-50 border-gray-200'}`}>
                                  <Paperclip className="h-4 w-4 shrink-0" />
                                  <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                                    {msg.attachment_name || 'Download File'}
                                  </a>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Metadata */}
                          <div className={`text-[10px] mt-2 flex justify-end items-center gap-1 ${isMe ? 'text-purple-200' : 'text-gray-400'}`}>
                            {msg.optimistic ? 'sending...' : new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
        <div className="p-4 bg-white border-t z-10 shadow-[0_-10px_20px_-15px_rgba(0,0,0,0.05)]">
          <AnimatePresence>
            {replyingTo && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                exit={{ opacity: 0, height: 0 }}
                className="mb-3 flex items-center justify-between bg-purple-50/50 border border-purple-100 rounded-lg p-2 overflow-hidden"
              >
                <div className="flex-1 border-l-2 border-purple-500 pl-3">
                  <div className="text-xs text-purple-700 font-semibold flex items-center gap-1">
                    <Reply className="h-3 w-3" />
                    Replying to {replyingTo.sender_role === 'student' ? 'yourself' : supervisor.name}
                  </div>
                  <div className="text-sm text-gray-600 truncate">{replyingTo.content || 'Attachment'}</div>
                </div>
                <button aria-label="Cancel reply" title="Cancel reply" type="button" onClick={() => setReplyingTo(null)} className="p-1 hover:bg-purple-100 rounded-full text-gray-400 hover:text-gray-600 transition">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <form className="flex gap-2 items-center" onSubmit={handleSend}>
            <label htmlFor="chat-upload" className="cursor-pointer p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-full transition" title="Attach file">
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
            
            <div className="flex-1 flex flex-col bg-gray-50 border rounded-2xl ring-purple-100 focus-within:ring-2 focus-within:border-purple-300 transition-all overflow-hidden px-3 py-1">
              {attachment && (
                <div className="flex items-center gap-2 text-xs bg-purple-100 text-purple-800 p-1.5 rounded-lg mb-1 mt-1 font-medium w-fit max-w-full">
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
                className="w-full bg-transparent border-none focus:outline-none py-2 text-[15px]"
                placeholder="Type your message..."
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>
            
            <button
              type="submit"
              disabled={(!message.trim() && !attachment) || loading}
              className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full disabled:opacity-50 disabled:hover:bg-purple-600 transition flex items-center justify-center shadow-md active:scale-95"
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
