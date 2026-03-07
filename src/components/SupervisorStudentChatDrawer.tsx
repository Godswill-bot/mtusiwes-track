import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, Send, X, Download } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrCreateConversation, listMessages, sendMessage, markMessagesRead } from '../lib/chatHelpers';
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
  const [selectedImage, setSelectedImage] = useState<{url: string, name: string} | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [chatDisabled, setChatDisabled] = useState(false);
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
    refetchInterval: open ? 3000 : false,
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
    mutationFn: async (args: { content: string; attachment: any }) => {
      let attachmentUrl = null;
      let attachmentName = null;
          if (attachment) {
        // Validate file
        if (attachment.size > 5 * 1024 * 1024) {
          setUploadError('File too large (max 5MB)');
          return;
        }
        const allowed = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowed.some(type => attachment.type.startsWith(type))) {
          setUploadError('Invalid file type');
          return;
        }
        // Upload to Supabase Storage
        const filePath = `chat/${conversation.id}/${Date.now()}_${attachment.name}`;
        const { data, error } = await supabase.storage.from('chat-attachments').upload(filePath, attachment);
        if (error) {
          setUploadError('Upload failed');
          return;
        }
        const { data: publicData } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
        attachmentUrl = publicData?.publicUrl;
        attachmentName = attachment.name;
      }
      setUploadError('');
      await sendMessage({
        conversationId: conversation.id,
        senderId: isStudent ? student?.id : supervisorId,
        senderRole: isStudent ? 'student' : 'supervisor',
        content: message,
        attachmentUrl,
        attachmentName,
      });
      setMessage('');
      setAttachment(null);
      queryClient.invalidateQueries({ queryKey: ['chat-messages', conversation.id] });
    },
  });

  // Render
  return (
    <div className={`fixed inset-y-0 right-0 w-96 bg-white shadow-lg z-50 flex flex-col transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`} aria-modal="true" role="dialog">
      <div className="flex-none flex items-center justify-between p-4 border-b">
        <div>
          
          {isStudent ? (
            <>
              <div className="font-bold text-purple-700">{supervisorInfo?.name || 'Supervisor'}</div>
              <div className="text-xs text-gray-500">Your Supervisor</div>
            </>
          ) : (
            <>
              <div className="font-bold text-purple-700">{student?.profile?.full_name || student?.full_name || student?.name || 'Student'}</div>
              <div className="text-xs text-gray-500">Matric: {student?.matric_no || student?.matric_number || 'Unknown Matric'}</div>
            </>
          )}

        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-purple-700" aria-label="Close chat">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-300 border-t-transparent"></div></div>
        ) : chatDisabled ? (
          <div className="text-center text-red-500">
            Chat is disabled. Please ensure you are assigned to a supervisor and SIWES is active.<br/>
            <span className="text-xs text-gray-400">Debug: supervisorId={String(supervisorId)}, studentId={String(student?.id)}</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400">No messages yet</div>
        ) : (
          <div>
            {messages.map(msg => {
              const isMine = msg.sender_role === (isStudent ? 'student' : 'supervisor');
              const theirName = isStudent ? (supervisorInfo?.name || 'Supervisor') : (student?.profile?.full_name || student?.full_name || student?.name || 'Student');
              
              return (
              <div key={msg.id} className={`mb-4 flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs rounded-lg p-2 shadow ${isMine ? 'bg-purple-100' : 'bg-white border'}`}>
                  <div className={`text-xs text-gray-500 mb-1 ${isMine ? 'text-right' : 'text-left'}`}>
                    {isMine ? 'You' : theirName} • {new Date(msg.created_at).toLocaleString()}
                  </div>
                  {msg.content && <div className="mb-1">{msg.content}</div>}
                  {msg.attachment_url && (
                    <div className="mt-2 text-left">
                      {msg.attachment_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <div 
                          className="relative group cursor-pointer inline-block"
                          onClick={() => setSelectedImage({ url: msg.attachment_url, name: msg.attachment_name || 'Attached Image' })}
                        >
                          <img src={msg.attachment_url} alt={msg.attachment_name || 'Attachment'} className="max-w-[200px] max-h-40 object-cover rounded border shadow-sm transition-opacity group-hover:opacity-90" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center rounded">
                            <span className="bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Click to view</span>
                          </div>
                        </div>
                      ) : (
                        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" download className="text-purple-700 underline text-sm break-all flex items-center gap-1">
                          <Paperclip className="h-3 w-3" /> {msg.attachment_name || 'Download File'}
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
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-6 py-2.5 rounded-full font-medium transition-all shadow-lg flex items-center gap-2 backdrop-blur-md"
              >
                <Download className="w-4 h-4" /> Download Image
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
})}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      {(!chatDisabled && conversation) && (
        <div className="flex-none bg-white">
          <form className="p-4 border-t flex gap-2 items-center" onSubmit={e => { e.preventDefault(); mutation.mutate({ content: message, attachment }); }} aria-label="Send message">
            <label htmlFor="chat-upload" className="cursor-pointer flex items-center" title="Attach file">
              <Paperclip className="h-5 w-5 text-purple-700" />
            </label>
            <input
              id="chat-upload"
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={e => setAttachment(e.target.files[0])}
              aria-label="Attach file"
              disabled={chatDisabled}
              className="hidden"
            />
            <input
              type="text"
              className="flex-1 border rounded px-2 py-1"
              placeholder="Type a message..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              aria-label="Message input"
              disabled={chatDisabled}
            />
            <button
              type="submit"
              disabled={chatDisabled || (!message && !attachment) || mutation.isPending}
              className="bg-purple-700 text-white px-3 py-1 rounded disabled:opacity-50 flex items-center justify-center"
              aria-label="Send message"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
          <div className="px-4 pb-2 text-xs text-gray-500">Max file size: 5MB. Allowed: images, PDF, DOC, DOCX.</div>
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

