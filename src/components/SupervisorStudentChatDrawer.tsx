import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, Send, X, Download, Pencil, Reply, Image as ImageIcon } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrCreateConversation, listMessages, sendMessage, markMessagesRead, editMessage, formatDateGroup } from '../lib/chatHelpers';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function SupervisorStudentChatDrawer({
  open, onClose, supervisorId, student, supervisorInfo,
}) {
  const { userRole } = useAuth();
  const isStudent = userRole === 'student';
  const [conversation, setConversation] = useState(null);
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{url: string, name: string} | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [chatDisabled, setChatDisabled] = useState(false);
  
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<any>(null);

  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);

  // Get or create conversation
  useEffect(() => {
    // Only disable chat if supervisorId or student.id is missing
    if (open && supervisorId && student?.id) {
      getOrCreateConversation(supervisorId, student.id).then(setConversation);
      setChatDisabled(false);
    } else {
      setConversation(null);
      setChatDisabled(true);
    }
  }, [open, supervisorId, student?.id]);

  // Fetch messages
  const { data: messages = [], refetch, isLoading } = useQuery({
    queryKey: ['chat-messages', conversation?.id],
    queryFn: () => conversation?.id ? listMessages(conversation.id) : [],
    enabled: !!conversation?.id,
  });

  // Mark messages as read when opened
  useEffect(() => {
    if (open && conversation?.id) {
      markMessagesRead(conversation.id, isStudent ? 'student' : 'supervisor');
    }
  }, [open, conversation]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Send message
  const mutation = useMutation({
    mutationFn: async (args: { content: string; attachment: any; parentId?: string }) => {
      let attachmentUrl = null;
      let attachmentName = null;
          if (args.attachment) {
        // Validate file
        if (args.attachment.size > 5 * 1024 * 1024) {
          setUploadError('File too large (max 5MB)');
          throw new Error('File too large');
        }
        const allowed = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowed.some(type => args.attachment.type.startsWith(type))) {
          setUploadError('Invalid file type');
          throw new Error('Invalid file type');
        }
        // Upload to Supabase Storage
        const filePath = `chat/${conversation.id}/${Date.now()}_${args.attachment.name}`;
        const { data, error } = await supabase.storage.from('chat-attachments').upload(filePath, args.attachment);
        if (error) {
          setUploadError('Upload failed');
          throw new Error('Upload failed');
        }
        const { data: publicData } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
        attachmentUrl = publicData?.publicUrl;
        attachmentName = args.attachment.name;
      }
      setUploadError('');
      await sendMessage({
        conversationId: conversation.id,
        senderId: isStudent ? student?.id : supervisorId,
        senderRole: isStudent ? 'student' : 'supervisor',
        content: args.content,
        attachmentUrl,
        attachmentName,
        parentId: args.parentId,
      });
    },
    onSuccess: () => {
      setMessage('');
      setAttachment(null);
      setImagePreview(null);
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ['chat-messages', conversation?.id] });
    }
  });

  const editMutation = useMutation({
    mutationFn: async ({ messageId, newContent }: { messageId: string, newContent: string }) => {
      await editMessage(messageId, newContent);
    },
    onSuccess: () => {
      setEditingMessageId(null);
      setEditContent('');
      queryClient.invalidateQueries({ queryKey: ['chat-messages', conversation?.id] });
    }
  });

  const handleAttachment = (file: File | undefined) => {
    if (!file) {
      setAttachment(null);
      setImagePreview(null);
      return;
    }
    setAttachment(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }
  };

  // Cleanup object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Render
  return (
    <div className={`fixed inset-y-0 right-0 w-96 bg-card shadow-lg z-50 flex flex-col transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`} aria-modal="true" role="dialog">
      <div className="flex-none flex items-center justify-between p-4 border-b bg-card relative z-10">
        <div className="flex items-center gap-3">
          {isStudent ? (
            <>
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold shrink-0 shadow-sm border border-primary/10">
                {supervisorInfo?.name?.charAt(0)?.toUpperCase() || 'S'}
              </div>
              <div>
                <div className="font-bold text-primary leading-tight">{supervisorInfo?.name || 'Supervisor'}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Your Supervisor</div>
              </div>
            </>
          ) : (
            <>
              {student?.profile?.profile_image_url || student?.profile_image_url || student?.avatar_url ? (
                <img src={student?.profile?.profile_image_url || student?.profile_image_url || student?.avatar_url} alt="Profile" className="h-10 w-10 rounded-full object-cover shrink-0 shadow-sm border border-primary/10" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold shrink-0 shadow-sm border border-primary/10">
                  {(student?.profile?.full_name || student?.full_name || student?.name || 'S').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="font-bold text-primary leading-tight">{student?.profile?.full_name || student?.full_name || student?.name || 'Student'}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Matric: {student?.matric_no || student?.matric_number || 'Unknown Matric'}</div>
              </div>
            </>
          )}
        </div>
        <button onClick={onClose} className="text-muted-foreground/70 hover:text-primary transition z-10" aria-label="Close chat">✕</button>
      </div>
      <div 
        className="flex-1 overflow-y-auto p-4 custom-scrollbar"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='%236366f1' fill-opacity='0.04'%3E%3Cpath d='M20 20h12v16H20z'/%3E%3Cpath d='M22 22h8v2h-8zm0 4h8v2h-8zm0 4h8v2h-8z'/%3E%3Cpath d='M80 30l10-5 10 5-10 5zm-6 2v6l6 3 6-3v-6'/%3E%3Cpath d='M30 80l2-2 6 6-2 2h-4v-4l-2-2z'/%3E%3Cpath d='M85 80l3-7 3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5z'/%3E%3Ccircle cx='60' cy='50' r='3'/%3E%3C/g%3E%3C/svg%3E")` }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-4 border-primary/40 border-t-transparent"></div></div>
        ) : chatDisabled ? (
          <div className="text-center text-red-500">
            Chat is disabled. Please ensure you are assigned to a supervisor and SIWES is active.<br/>
            <span className="text-xs text-muted-foreground/70">Debug: supervisorId={String(supervisorId)}, studentId={String(student?.id)}</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground/70">No messages yet</div>
        ) : (
          <div>
            {messages.map((msg, index) => {
              const isMine = msg.sender_role === (isStudent ? 'student' : 'supervisor');
              const theirName = isStudent ? (supervisorInfo?.name || 'Supervisor') : (student?.profile?.full_name || student?.full_name || student?.name || 'Student');
              const isEditing = editingMessageId === msg.id;
              
              const currentDateGroup = formatDateGroup(msg.created_at);
              const prevDateGroup = index > 0 ? formatDateGroup(messages[index - 1].created_at) : null;
              const showDateGroup = currentDateGroup !== prevDateGroup;

              return (
              <React.Fragment key={msg.id}>
                {showDateGroup && (
                  <div className="flex justify-center my-4">
                    <span className="bg-secondary text-muted-foreground text-[10px] px-3 py-1 rounded-full font-medium">
                      {currentDateGroup}
                    </span>
                  </div>
                )}
              <div className={`mb-4 flex ${isMine ? 'justify-end' : 'justify-start'} group relative`}>
                {/* Action buttons on hover */}
                <div className={`hidden sm:flex absolute top-1/2 -translate-y-1/2 ${isMine ? 'right-[100%] mr-1' : 'left-[100%] ml-1'} items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 ease-in-out scale-95 group-hover:scale-100 z-10`}>
                  {!isEditing && <button onClick={() => setReplyingTo(msg)} className="p-1.5 bg-background border shadow-sm rounded-full text-muted-foreground hover:text-primary hover:bg-muted transition" title="Reply"><Reply className="w-3.5 h-3.5" /></button>}
                  {isMine && !isEditing && (
                    <button onClick={() => { setEditingMessageId(msg.id); setEditContent(msg.content || ''); }} className="p-1.5 bg-background border shadow-sm rounded-full text-muted-foreground hover:text-primary hover:bg-muted transition" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                  )}
                </div>

                <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm relative ${isMine ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border rounded-tl-sm text-foreground'}`}>

                  <div className={`text-[10px] ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'} mb-1 ${isMine ? 'text-right' : 'text-left'}`}>
                    {isMine ? 'You' : theirName} • {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    {msg.is_edited && <span className="ml-1 italic">(edited)</span>}
                  </div>

                  {msg.parent && (
                    <div className={`mb-2 p-1.5 rounded text-xs border-l-2 opacity-90 line-clamp-2 ${isMine ? 'bg-primary-foreground/20 border-primary-foreground/30 text-primary-foreground' : 'bg-muted border-primary/50 text-foreground'}`}>
                       <span className="font-semibold">{msg.parent.sender_role === (isStudent ? 'student' : 'supervisor') ? 'You' : theirName}</span>: {msg.parent.content || 'Attached file'}
                    </div>
                  )}

                  {isEditing ? (
                    <div className="mt-1">
                      <textarea
                        title="Edit message"
                        aria-label="Edit message"
                        className="w-full text-sm p-1 border rounded resize-none focus:outline-none focus:ring-1 bg-background text-foreground focus:ring-primary/50"
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        autoFocus
                        rows={2}
                      />
                      <div className="flex justify-end gap-1 mt-1">
                        <button onClick={() => setEditingMessageId(null)} className="text-[10px] px-2 py-0.5 border rounded hover:bg-muted">Cancel</button>
                        <button 
                          onClick={() => editMutation.mutate({ messageId: msg.id, newContent: editContent })} 
                          disabled={editMutation.isPending || editContent.trim() === msg.content}
                          className="text-[10px] px-2 py-0.5 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    msg.content && <div className="mb-1 text-sm whitespace-pre-wrap">{msg.content}</div>
                  )}
                  {msg.attachment_url && (
                    <div className="mt-2 text-left">
                      {msg.attachment_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <div 
                          className="relative group/img cursor-pointer inline-block"
                          onClick={() => setSelectedImage({ url: msg.attachment_url, name: msg.attachment_name || 'Attached Image' })}
                        >
                          <img src={msg.attachment_url} alt={msg.attachment_name || 'Attachment'} className="max-w-[200px] max-h-40 object-cover rounded border shadow-sm transition-opacity group-hover/img:opacity-90" />
                          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center rounded">
                            <span className="bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover/img:opacity-100 transition-opacity">Click to view</span>
                          </div>
                        </div>
                      ) : (
                          <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" download className={`${isMine ? 'text-primary-foreground hover:text-primary-foreground/80' : 'text-primary hover:text-primary/80'} underline text-sm break-all flex items-center gap-1`}>
                          <Paperclip className="h-3 w-3 flex-shrink-0" /> {msg.attachment_name || 'Download File'}
                        </a>
                      )}
                    </div>
                  )}
                </div>
      {/* Fullscreen Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm transition-all" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedImage(null)} 
              className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors bg-black/50 rounded-full p-2"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={selectedImage.url} 
              alt={selectedImage.name} 
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl border border-white/10" 
            />
            <div className="flex gap-4 items-center">
              <a 
                href={selectedImage.url} 
                download={selectedImage.name}
                target="_blank" 
                rel="noopener noreferrer" 
                className="bg-card/10 hover:bg-card/20 text-white border border-white/20 px-6 py-2.5 rounded-full font-medium transition-all shadow-lg flex items-center gap-2 backdrop-blur-md"
              >
                <Download className="w-4 h-4" /> Download Image
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
    </React.Fragment>
  );
})}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      {(!chatDisabled && conversation) && (
        <div className="flex-none bg-card border-t">
          {replyingTo && (
            <div className="px-4 py-2 bg-muted text-xs flex items-center justify-between border-b">
              <div className="flex items-center gap-2 text-muted-foreground truncate">
                <Reply className="w-3 h-3 flex-shrink-0" />
                <span className="font-semibold">{replyingTo.sender_role === (isStudent ? 'student' : 'supervisor') ? 'You' : 'Them'}</span>: {replyingTo.content || 'Attached file'}
              </div>
              <button type="button" aria-label="Cancel reply" title="Cancel reply" onClick={() => setReplyingTo(null)} className="text-muted-foreground/70 hover:text-foreground/90">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {attachment && (
            <div className="px-4 pt-3 flex items-start gap-3">
              <div className="relative inline-block mt-1">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded border shadow-sm" />
                ) : (
                  <div className="w-16 h-16 bg-muted flex items-center justify-center rounded border shadow-sm">
                    <Paperclip className="w-6 h-6 text-muted-foreground/70" />
                  </div>
                )}
                <button
                  type="button"
                  aria-label="Remove attachment"
                  title="Remove attachment"
                  onClick={() => handleAttachment(undefined)}
                  className="absolute -top-2 -right-2 bg-card text-muted-foreground rounded-full p-0.5 shadow-md border hover:bg-muted"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="text-xs text-muted-foreground truncate pt-1 max-w-[200px]">
                {attachment.name}
              </div>
            </div>
          )}

          <form className="p-4 flex gap-2 items-center" onSubmit={e => { e.preventDefault(); mutation.mutate({ content: message, attachment, parentId: replyingTo?.id }); }} aria-label="Send message">
            <label htmlFor="drawer-chat-upload" className="cursor-pointer p-2 text-muted-foreground/70 hover:text-primary hover:bg-primary/10 rounded-full transition" title="Attach file">
              <Paperclip className="h-5 w-5" />
            </label>
            <input
              id="drawer-chat-upload"
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={e => handleAttachment(e.target.files?.[0])}
              aria-label="Attach file"
              disabled={chatDisabled}
              className="hidden"
            />
            
            <div className="flex-1 flex flex-col bg-transparent dark:bg-muted/10 border rounded-3xl ring-primary/20 focus-within:ring-2 focus-within:border-primary/40 transition-all overflow-hidden px-4 py-1.5 shadow-sm">
              <input
                type="text"
                className="w-full bg-transparent border-none focus:outline-none py-1 text-[14px] text-foreground placeholder:text-muted-foreground"
                placeholder="Type a message..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                aria-label="Message input"
                disabled={chatDisabled}
              />
            </div>
            
            <button
              type="submit"
              disabled={chatDisabled || (!message && !attachment) || mutation.isPending}
              className="bg-primary hover:bg-primary text-primary-foreground p-2.5 rounded-full disabled:opacity-50 disabled:hover:bg-primary transition flex items-center justify-center shadow-md active:scale-95"
              aria-label="Send message"
            >
              <Send className="h-5 w-5 ml-1" />
            </button>
          </form>
          <div className="px-4 pb-2 text-xs text-muted-foreground">Max file size: 5MB. Allowed: images, PDF, DOC, DOCX.</div>
          {uploadError && <div className="text-red-500 text-xs px-4 pb-2">{uploadError}</div>}
        </div>
      )}
    </div>
  );
}

// How to test:
// - Supervisor opens chat with assigned student via "Chat" button
// - Student sees same thread
// - Messages appear in real time or polling
// - Attachments upload and render correctly
// - Unauthorized access is blocked by RLS



