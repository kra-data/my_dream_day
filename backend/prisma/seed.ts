/**
 * prisma/seed.ts
 * ──────────────────────────────────────────────────────────
 * 새 스키마( pay / payUnit / position / section )에 맞춰
 * 샘플 데이터를 넣어주는 시드 스크립트입니다.
 */
import { PrismaClient, Position, Section, PayUnit } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  /* 1️⃣ 샵 생성 */
  const shop = await prisma.shop.create({
    data: {
      name: '테스트 상점',
      hourlyWage: 10_000,     // 알바 기본 시급
      payday: 25,             // 월급 지급일
      qrSecret: 'dummysecret123'
    }
  });

  /* 2️⃣ 관리자(매니저) 계정 — 월급제 */
  await prisma.employee.create({
    data: {
      shopId:       shop.id,
      name:         '홍길동',
      nationalId:   '9001011234567',
      accountNumber:'123-456-7890',
      bank:         '국민',
      phone:        '01012341234',
      schedule: {
        mon: { start: '09:00', end: '18:00' },
        tue: { start: '09:00', end: '18:00' }
      },
      position:     Position.MANAGER,
      section:      Section.HALL,
      pay:          2_800_000,            // 월급(원)
      payUnit:      PayUnit.MONTHLY,
      role:         'admin'
    }
  });

  /* 3️⃣ 일반 직원 계정 — 월급제 */
  await prisma.employee.create({
    data: {
      shopId:       shop.id,
      name:         '김철수',
      nationalId:   '0001011234567',
      accountNumber:'987-654-3210',
      bank:         '토스',
      phone:        '01098765432',
      schedule: {
        mon: { start: '10:00', end: '18:00' },
        tue: { start: '10:00', end: '18:00' }
      },
      position:     Position.STAFF,
      section:      Section.KITCHEN,
      pay:          2_300_000,            // 월급(원)
      payUnit:      PayUnit.MONTHLY,
      role:         'employee'
    }
  });

  console.log('✅ Seed 데이터(매니저 + 직원) 생성 완료');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
