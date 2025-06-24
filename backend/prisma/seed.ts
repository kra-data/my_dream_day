import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  /** 1) 샵 생성 */
  const shop = await prisma.shop.create({
    data: {
      name: '테스트 상점',
      hourlyWage: 10_000,
      payday: 25,
      qrSecret: 'dummysecret123'
    }
  });

  /** 2) 관리자 계정 */
  await prisma.employee.create({
    data: {
      shopId:       shop.id,
      name:         '홍길동',
      nationalId:   '9001011234567',
      accountNumber:'123-456-7890',
      phone:        '01012341234',
      schedule: {
        weekday: { amStart:'09:00', amEnd:'12:00', pmStart:'13:00', pmEnd:'18:00' },
        weekend: { amStart:'09:00', amEnd:'12:00', pmStart:'13:00', pmEnd:'17:00' }
      },
      role: 'admin'
    }
  });

  /** 3) 🌟 일반 직원 계정 추가 */
  await prisma.employee.create({
    data: {
      shopId:       shop.id,
      name:         '김철수',
      nationalId:   '0001011234567',
      accountNumber:'987-654-3210',
      phone:        '01098765432',
      schedule: {
        weekday: { amStart:'10:00', amEnd:'13:00', pmStart:'14:00', pmEnd:'18:00' },
        weekend: { amStart:'10:00', amEnd:'13:00', pmStart:'14:00', pmEnd:'17:00' }
      },
      role: 'employee'      // ← 일반 직원
    }
  });

  console.log('✅ Seed 데이터(관리자 + 직원) 생성 완료');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
