import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_key';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const encryptionSeed = process.env.ADMIN_PROFILE_CHANGE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'admin-profile-change-secret';
const encryptionKey = crypto.createHash('sha256').update(encryptionSeed).digest();

export const encryptProfileChangeSecret = (value) => {
  if (!value) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
};

export const decryptProfileChangeSecret = (value) => {
  if (!value) return null;

  const [ivBase64, authTagBase64, encryptedBase64] = value.split(':');
  if (!ivBase64 || !authTagBase64 || !encryptedBase64) return null;

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey,
    Buffer.from(ivBase64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
};

export const replacePendingAdminProfileChange = async ({
  adminUserId,
  currentEmail,
  newEmail,
  encryptedNewPassword,
  expiresAt,
}) => {
  await supabase
    .from('admin_profile_change_requests')
    .delete()
    .eq('admin_user_id', adminUserId)
    .eq('status', 'pending');

  const { data, error } = await supabase
    .from('admin_profile_change_requests')
    .insert({
      admin_user_id: adminUserId,
      current_email: currentEmail,
      new_email: newEmail,
      encrypted_new_password: encryptedNewPassword,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

export const getPendingAdminProfileChange = async ({ adminUserId, requestId }) => {
  let query = supabase
    .from('admin_profile_change_requests')
    .select('*')
    .eq('admin_user_id', adminUserId)
    .eq('status', 'pending')
    .gte('expires_at', new Date().toISOString());

  if (requestId) {
    query = query.eq('id', requestId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
};

export const completePendingAdminProfileChange = async (requestId) => {
  const { error } = await supabase
    .from('admin_profile_change_requests')
    .update({
      status: 'completed',
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (error) throw error;
};
