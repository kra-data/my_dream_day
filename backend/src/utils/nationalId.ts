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

// 멀티테넌트 스코프 필요 시 shopId를 섞으세요.
export function hashNationalId(plain: string /* , shopId?: number */): string {
  const h = crypto.createHmac('sha256', HMAC_KEY);
  // if (shopId) h.update(String(shopId)).update(':');
  h.update(plain);
  return h.digest('hex'); // 64 hex
}

export function maskNationalId(input: string): string {
  // 주민번호 형식: 000000-0000000 or 13자리
  const digits = input.replace(/\D/g, '');
  if (digits.length >= 13) {
    const a = digits.slice(0, 6); // 생년월일
    const b = digits.slice(6, 7); // 성별 식별 1자리
    return `${a}-${b}${'*'.repeat(digits.length - 7)}`; // 예: 900101-1******
  }
  // 일반 숫자 마스킹(fallback)
  // 앞 2~4자리/뒤 1~2자리만 노출
  return digits.replace(/^(\d{2,4})(\d+)(\d{1,2})$/, (_, p1, mid, p3) => p1 + '*'.repeat(mid.length) + p3);
}
