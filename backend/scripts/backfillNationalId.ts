// scripts/backfillNationalId.ts
import 'dotenv/config';
import crypto from 'crypto';
import { prisma } from '../src/db/prisma';

/** ───────── 키 로드 ───────── */
const ENC_KEY_B64  = process.env.NATIONAL_ID_ENC_KEY || '';
const HMAC_KEY_B64 = process.env.NATIONAL_ID_HMAC_KEY || '';
const ENC_KEY  = Buffer.from(ENC_KEY_B64, 'base64');
const HMAC_KEY = Buffer.from(HMAC_KEY_B64, 'base64');

if (ENC_KEY.length !== 32) throw new Error('NATIONAL_ID_ENC_KEY must be 32 bytes (base64).');
if (HMAC_KEY.length === 0) throw new Error('NATIONAL_ID_HMAC_KEY is required (base64).');
if (ENC_KEY.equals(HMAC_KEY)) throw new Error('ENC/HMAC keys must be different.');

/** ───────── 유틸 ───────── */
function maskNationalId(nid: string): string {
  // 예: 123456-1234567 → 123456-1******
  const only = nid.replace(/\D/g, '');
  if (only.length >= 7) {
    return `${only.slice(0,6)}-${only.slice(6,7)}******`;
  }
  // 포맷 불명일 때도 최대한 마스킹
  return nid.replace(/\d(?=\d{4})/g, '*');
}

function encryptGCM(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // 저장 포맷: iv:ct:tag (base64)
  return `${iv.toString('base64')}:${ct.toString('base64')}:${tag.toString('base64')}`;
}

function hmacSha256Base64(plain: string): string {
  return crypto.createHmac('sha256', HMAC_KEY).update(plain, 'utf8').digest('base64');
}

/** ───────── 메인 ───────── */
async function main() {
  // 1) 백필 대상 조회: 아직 암호화 안 되었고, nationalId가 빈 문자열이 아닌 것만
  const targets = await prisma.employee.findMany({
    where: {
      nationalIdEnc: null,        // 아직 미백필
      NOT: { nationalId: '' },    // 빈 문자열 제외 (nullable 아님)
    },
    select: { id: true, nationalId: true },
    orderBy: { id: 'asc' },
  });

  console.log(`Backfilling ${targets.length} employee(s)...`);

  // 2) 배치 처리
  const BATCH = 100;
  for (let i = 0; i < targets.length; i += BATCH) {
    const slice = targets.slice(i, i + BATCH);

    const tx = slice.map((row) => {
      const plain = row.nationalId; // 스키마상 non-null
      const enc = encryptGCM(plain);
      const hash = hmacSha256Base64(plain);
      const masked = maskNationalId(plain);

      return prisma.employee.update({
        where: { id: row.id },
        data: {
          nationalIdEnc: enc,
          nationalIdHash: hash,
          nationalIdMasked: masked,
        },
      });
    });

    // ⬇️ 옵션 없이 호출 (timeout 제거)
    await prisma.$transaction(tx);
    console.log(`  done ${Math.min(i + BATCH, targets.length)}/${targets.length}`);
  }

  console.log('Backfill completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
