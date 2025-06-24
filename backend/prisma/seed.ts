import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 샵 생성
  const shop = await prisma.shop.create({
    data: {
      name: '테스트 상점',
      hourlyWage: 10000,
      payday: 25,
      qrSecret: 'dummysecret123'
    }
  });

  // 직원 생성
  await prisma.employee.create({
    data: {
      shopId: shop.id,
      name: '홍길동',
      nationalId: '9001011234567',
      accountNumber: '123-456-7890',
      phone: '01012341234',
      schedule: {
        weekday: { amStart: '09:00', amEnd: '12:00', pmStart: '13:00', pmEnd: '18:00' },
        weekend: { amStart: '09:00', amEnd: '12:00', pmStart: '13:00', pmEnd: '17:00' }
      },
      role: 'admin'
    }
  });

  console.log('✅ Seed 데이터 생성 완료');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
