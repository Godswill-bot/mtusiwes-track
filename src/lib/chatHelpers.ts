// Helper functions for Supervisor ↔ Student chat
import { supabase } from '@/integrations/supabase/client';

export async function getOrCreateConversation(supervisorId, studentId) {
  // Ensure we have valid IDs before attempting to query/insert
  if (!supervisorId || !studentId) {
    console.error("Missing supervisorId or studentId in getOrCreateConversation", { supervisorId, studentId });
    return null;
  }

  try {
    // Phase 1: Try to safely find an existing conversation
    const { data: existingData, error: existingError } = await (supabase as any)
      .from('conversations')
      .select('*')
      .eq('supervisor_id', supervisorId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error("Error finding existing conversation:", existingError);
    }

    if (existingData) {
      return existingData; // Return if found
    }

    // Phase 2: Create new conversation if not found
    const { data: createdData, error: createError } = await (supabase as any)
      .from('conversations')
      .insert([{ supervisor_id: supervisorId, student_id: studentId }] as any)
      .select('*')
      .maybeSingle();

    // If we hit a 409 Conflict (code 23505) or any error indicating it already exists 
    // it means it was created exactly during the gap between phase 1 and 2
    if (createError) {
      console.log("Create threw an error (likely a 409 conflict). Falling back to select:", createError);
      const { data: fallbackData } = await (supabase as any)
        .from('conversations')
        .select('*')
        .eq('supervisor_id', supervisorId)
        .eq('student_id', studentId)
        .maybeSingle();
      
      return fallbackData || null;
    }

    return createdData || null;

  } catch (err) {
    console.error("Exception in getOrCreateConversation:", err);
    return null;
  }
}

export async function listMessages(conversationId) {
  const { data, error } = await (supabase as any)
    .from('messages')
    .select(`
      *,
      parent:parent_id (
        id,
        content,
        sender_role
      )
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  return data || [];
}

export async function sendMessage({ conversationId, senderId, senderRole, content, attachmentUrl, attachmentName, parentId }) {
  const result = await (supabase as any)
    .from('messages')
    .insert([
      {
        conversation_id: conversationId,
        sender_id: senderId,
        sender_role: senderRole,
        content,
        attachment_url: attachmentUrl || null,
        attachment_name: attachmentName || null,
        parent_id: parentId || null,
      }
    ] as any)
    .select('*')
    .single();
  const data = result.data;
  const error = result.error;
  if (error) {
    console.error('Error sending message:', error);
    return null;
  }
  return data || null;
}

export async function editMessage(messageId, newContent) {
  const { data, error } = await (supabase as any)
    .from('messages')
    .update({ 
      content: newContent,
      is_edited: true
    })
    .eq('id', messageId)
    .select()
    .single();
    
  if (error) {
    console.error('Error editing message:', error);
    return null;
  }
  return data;
}

export async function markMessagesRead(conversationId, viewerRole) {
  // Mark all unread messages as read for the viewer
  if (!conversationId || !viewerRole) return [];
  
  const { data, error } = await (supabase as any)
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .is('read_at', null)
    .neq('sender_role', viewerRole);
    
  if (error) {
    console.error('Error marking messages as read:', error);
  }
  return data || [];
}

export function formatDateGroup(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();
  
  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}
