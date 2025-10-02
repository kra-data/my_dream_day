// src/utils/nationalId.ts
import crypto from 'crypto';

const encKeyB64 = process.env.NATIONAL_ID_ENC_KEY || '';
const hmacKeyB64 = process.env.NATIONAL_ID_HMAC_KEY || '';
const ENC_KEY = Buffer.from(encKeyB64, 'base64');   // 32 bytes
const HMAC_KEY = Buffer.from(hmacKeyB64, 'base64'); // 32 bytes

if (ENC_KEY.length !== 32) throw new Error('NATIONAL_ID_ENC_KEY must be 32 bytes (base64)');
if (HMAC_KEY.length === 0) throw new Error('NATIONAL_ID_HMAC_KEY required');

export function encryptNationalId(plain: string): string {
  const iv = crypto.randomBytes(12); // GCM 권장 12 bytes
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // 저장 포맷: base64(iv|tag|ciphertext)
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

// ✅ 복호화: base64(iv|tag|ciphertext) → plain
export function decryptNationalId(encB64: string): string {
  const buf = Buffer.from(encB64, 'base64');
  // 최소 길이: iv(12) + tag(16) + ct(>=1)
  if (buf.length < 12 + 16 + 1) {
    throw new Error('invalid ciphertext payload');
  }
  const iv  = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct  = buf.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString('utf8');
}

// 안전하게 쓰고 싶으면 실패 시 null 반환 버전도 함께 제공
export function tryDecryptNationalId(encB64: string): string | null {
  try {
    return decryptNationalId(encB64);
  } catch {
    return null;
  }
}

// 멀티테넌트 스코프 필요 시 shopId를 섞으세요.
export function hashNationalId(plain: string /* , shopId?: number */): string {
  const h = crypto.createHmac('sha256', HMAC_KEY);
  // if (shopId) h.update(String(shopId)).update(':');
  h.update(plain);
  return h.digest('hex'); // 64 hex
}

export function maskNationalId(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length >= 13) {
    const a = digits.slice(0, 6);
    const b = digits.slice(6, 7);
    return `${a}-${b}${'*'.repeat(digits.length - 7)}`;
  }
  return digits.replace(/^(\d{2,4})(\d+)(\d{1,2})$/, (_, p1, mid, p3) => p1 + '*'.repeat(mid.length) + p3);
}
