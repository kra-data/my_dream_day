// src/controllers/employeeAuthController.ts
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { signToken } from '../utils/jwt';
import bcrypt from 'bcryptjs';

const EmployeeLoginRequest = z.object({
  name: z.string().min(1),
  // 스프링 서버 로직: 뒤 4자리만 입력받아 매칭
  phoneLastFour: z.string().length(4).regex(/^\d{4}$/),
});

const digitsOnly = (s?: string | null) => (s ?? '').replace(/\D/g, '');

export const employeeLogin = async (req: Request, res: Response): Promise<void> => {
  const shopId = Number(req.params.shopId);
  if (!Number.isFinite(shopId) || shopId <= 0) {
    res.status(400).json({ message: '잘못된 shopId' }); return;
  }

  const parsed = EmployeeLoginRequest.safeParse(req.body);
  if (!parsed.success) {res.status(400).json({ message: 'Invalid payload' }); return;}

  const { name, phoneLastFour } = parsed.data;
  const nameTrim = name.trim();

  // 후보 검색 (이름+shopId)
  const candidates = await prisma.employeeMember.findMany({
    where: { shopId: BigInt(shopId), name: nameTrim },
    take: 50,
  });

  // 뒤 4자리 매칭
  const emp = candidates.find((e) => digitsOnly(e.phone).endsWith(phoneLastFour));
  if (!emp) {res.status(404).json({ message: '직원 정보를 찾을 수 없습니다.' }); return;}

  // 서버 비밀번호 정책: 기존 데이터는 전화 뒤4자리로 bcrypt 해시가 저장돼 있음
  if (!emp.passwordHash || !(await bcrypt.compare(phoneLastFour, emp.passwordHash))) {
    res.status(401).json({ message: '로그인 정보가 올바르지 않습니다.' }); return;
  }

  const accessToken = signToken(
    {
      userId: Number(emp.id), // 스프링은 employeeId로 subject를 쓰지만, 여기선 payload내에 포함
      shopId: Number(emp.shopId),
      shopRole: emp.shopRole, // "EMPLOYEE" 등
    },
    { expiresIn: '1h' }
  );

  const refreshToken = signToken(
    { userId: Number(emp.id), shopId: Number(emp.shopId), shopRole: emp.shopRole },
    { expiresIn: '14d' }
  );

  // EmployeeLoginResponse
  res.json({
    accessToken,
    refreshToken,
    employeeId: Number(emp.id),
    shopId: Number(emp.shopId),
    name: emp.name,
  });
};
