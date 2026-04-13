import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const encryptionSeed = process.env.ADMIN_PROFILE_CHANGE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'admin-profile-change-secret';
const encryptionKey = crypto.createHash('sha256').update(encryptionSeed).digest();
const requestSigningKey = crypto.createHash('sha256').update(`${encryptionSeed}:request-token`).digest();

const base64UrlEncode = (value) => Buffer.from(value).toString('base64url');
const base64UrlDecode = (value) => Buffer.from(value, 'base64url').toString('utf8');

const signPayload = (payloadString) => {
  return crypto
    .createHmac('sha256', requestSigningKey)
    .update(payloadString)
    .digest('base64url');
};

const buildRequestToken = (payload) => {
  const payloadJson = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(payloadJson);
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
};

const parseRequestToken = (token) => {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expected = signPayload(encodedPayload);
  if (expected !== signature) return null;

  try {
    return JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    return null;
  }
};

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
  const payload = {
    admin_user_id: adminUserId,
    current_email: currentEmail,
    new_email: newEmail,
    encrypted_new_password: encryptedNewPassword,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  };

  const requestToken = buildRequestToken(payload);
  return {
    id: requestToken,
    ...payload,
  };
};

export const getPendingAdminProfileChange = async ({ adminUserId, requestId }) => {
  const payload = parseRequestToken(requestId);
  if (!payload) return null;
  if (payload.admin_user_id !== adminUserId) return null;

  const expiresAt = new Date(payload.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  return {
    id: requestId,
    ...payload,
  };
};

export const completePendingAdminProfileChange = async (requestId) => {
  return requestId;
};
