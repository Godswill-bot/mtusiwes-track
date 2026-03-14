import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateConversation, listMessages, sendMessage } from '@/lib/chatHelpers';
import { Paperclip, Send, User, ArrowLeft } from 'lucide-react';

// Minimal supervisor mini-profile component
function SupervisorProfile({ supervisor }) {
  return (
    <div className="flex flex-col items-center p-4 border-r h-full">
      <User className="h-12 w-12 text-purple-700 mb-2" />
      <div className="font-bold text-lg text-purple-700">{supervisor?.name || 'Supervisor'}</div>
      <div className="text-xs text-gray-500">{supervisor?.email}</div>
      {/* Add last active/status if available */}
    </div>
  );
}

export default function StudentChatPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [supervisor, setSupervisor] = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  // Fetch assigned supervisor and conversation
  useEffect(() => {
    async function fetchChat() {
      setLoading(true);
      let supervisorId = null;
      let supervisorName = null;
      let supervisorEmail = null;
      let studentId = null;
      // Try students table first
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, supervisor_id, school_supervisor_name, school_supervisor_email')
        .eq('user_id', user?.id)
        .maybeSingle();
      if (studentData) {
        studentId = studentData.id;
        supervisorId = studentData.supervisor_id;
        supervisorName = studentData.school_supervisor_name;
        supervisorEmail = studentData.school_supervisor_email;
        console.log('Debug: students table', { studentId, supervisorId, supervisorName, supervisorEmail });
      } else {
        console.log('Debug: students table error', studentError);
      }
      // Always try supervisor_assignments for reliability
      if (studentId) {
        const { data: assignment, error: assignmentError } = await supabase
          .from('supervisor_assignments')
          .select('supervisor_id, supervisors(name, email)')
          .eq('student_id', studentId)
          .eq('assignment_type', 'school_supervisor')
          .maybeSingle();
        if (assignment && assignment.supervisor_id) {
          supervisorId = assignment.supervisor_id;
          supervisorName = assignment.supervisors?.name;
          supervisorEmail = assignment.supervisors?.email;
          console.log('Debug: supervisor_assignments table', { supervisorId, supervisorName, supervisorEmail });
        } else {
          console.log('Debug: supervisor_assignments error', assignmentError);
        }
      }
      if (!supervisorId || !studentId) {
        setLoading(false);
        console.log('Chat disabled. Please ensure you are assigned to a supervisor and SIWES is active.');
        console.log('Debug: supervisorId=' + supervisorId + ', studentId=' + studentId);
        return;
      }
      setSupervisor({
        id: supervisorId,
        name: supervisorName,
        email: supervisorEmail,
      });
      // Get or create conversation
      const conv = await getOrCreateConversation(supervisorId, studentId);
      console.log('Conversation object:', conv);
        setConversation(conv);
      setStudentId(studentId);
      // Load messages
      const msgs = await listMessages(conv.id);
      setMessages(msgs);
      setLoading(false);
    }
    if (user?.id) fetchChat();
  }, [user?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Send message handler
  async function handleSend(e) {
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
    // Optimistic UI
    const tempId = `temp-${Date.now()}`;
    setMessages(msgs => [...msgs, {
      id: tempId,
      sender_id: studentId,
      sender_role: 'student',
      content: message,
      attachment_url: attachmentUrl,
      attachment_name: attachmentName,
      created_at: new Date().toISOString(),
      optimistic: true,
    }]);
    setMessage('');
    setAttachment(null);
    // Send to backend
    const sent = await sendMessage({
      conversationId: conversation.id,
      senderId: studentId,
      senderRole: 'student',
      content: message,
      attachmentUrl,
      attachmentName,
      parentId: undefined,
    });
    setMessages(msgs => msgs.map(m => m.id === tempId ? sent : m));
  }

  // Minimal real-time: poll every 3s (replace with Supabase Realtime if needed)
  useEffect(() => {
    if (!conversation?.id) return;
    const interval = setInterval(async () => {
      const msgs = await listMessages(conversation.id);
      setMessages(msgs);
    }, 3000);
    return () => clearInterval(interval);
  }, [conversation?.id]);

  // Layout
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-300 border-t-transparent"></div></div>;
  if (!supervisor) return <div className="flex items-center justify-center h-screen text-red-500">No supervisor assigned. Chat unavailable.</div>;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-white">
      {/* Left: Supervisor profile (desktop) */}
      <div className="hidden md:block w-1/3 max-w-xs border-r bg-gray-50">
        <SupervisorProfile supervisor={supervisor} />
      </div>
      {/* Right: Chat thread */}
      <div className="flex-1 flex flex-col h-full">
        {/* Mobile header */}
        <div className="md:hidden flex items-center p-2 border-b bg-gray-50">
          <button onClick={() => navigate(-1)} className="mr-2" title="Go back"><ArrowLeft /></button>
          <span className="font-bold text-purple-700">{supervisor.name}</span>
        </div>
        {/* Chat thread */}
        <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-purple-50 to-white">
          
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">Start a conversation with your supervisor.</div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`mb-4 flex ${msg.sender_role === 'student' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs rounded-lg p-2 shadow ${msg.sender_role === 'student' ? 'bg-purple-100' : 'bg-white border'}`}>
                  <div className="text-xs text-gray-500 mb-1 text-right">{msg.sender_role === 'student' ? 'You' : supervisor?.name || 'Supervisor'} � {new Date(msg.created_at).toLocaleString()}</div>
                  {msg.content && <div className="mb-1">{msg.content}</div>}
                  {msg.attachment_url && (
                    <div>
                      {msg.attachment_url.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                        <img src={msg.attachment_url} alt={msg.attachment_name} className="max-h-32 rounded cursor-pointer" onClick={() => window.open(msg.attachment_url, '_blank')} />
                      ) : (
                        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" download className="text-purple-700 underline">{msg.attachment_name || 'Download'}</a>
                      )}
                    </div>
                  )}
                  {msg.optimistic && <div className="text-xs text-gray-400 italic">sending…</div>}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        {/* Input area */}
        <form className="p-4 border-t flex gap-2 items-center" onSubmit={handleSend}>
          <label htmlFor="chat-upload" className="cursor-pointer flex items-center" title="Attach file">
            <Paperclip className="h-5 w-5 text-purple-700" />
          </label>
          <input
            placeholder="Type your message..."
            id="chat-upload"
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            onChange={e => setAttachment(e.target.files[0])}
            className="hidden"
          />
          <input
            type="text"
            className="flex-1 border rounded px-2 py-1"
            placeholder="Type a message…"
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
          <button
            type="submit"
            disabled={!message && !attachment}
            className="bg-purple-700 text-white px-3 py-1 rounded disabled:opacity-50 flex items-center justify-center"
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
        <div className="px-4 pb-2 text-xs text-gray-500">Max file size: 5MB. Allowed: images, PDF, DOC, DOCX.</div>
        {uploadError && <div className="text-red-500 text-xs px-4 pb-2">{uploadError}</div>}
      </div>
    </div>
  );
}







