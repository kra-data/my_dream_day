// src/controllers/employeeAuthController.ts
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import {
  signEmployeeAccessToken,
  signEmployeeRefreshToken,
} from '../utils/jwt';
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

  const shop = await prisma.shop.findUnique({ where: { id: BigInt(emp.shopId) } });
  if (!shop) {res.status(404).json({ message: '존재하지 않는 가게' }); return;}

  const accessToken = signEmployeeAccessToken({
    empId: Number(emp.id),
    shopId: Number(emp.shopId),
    shopName:shop.name,
    empName: emp.name,
    shopRole: emp.shopRole ?? 'employee',
  });
  const refreshToken = signEmployeeRefreshToken({
    empId: Number(emp.id),
    shopId: Number(emp.shopId),
        shopName:shop.name,
    empName: emp.name,
    shopRole: emp.shopRole ?? 'employee',
  });

  // EmployeeLoginResponse
  res.json({
    accessToken,
    refreshToken,
    employeeId: Number(emp.id),
    shopId: Number(emp.shopId),
    name: emp.name,
  });
};
