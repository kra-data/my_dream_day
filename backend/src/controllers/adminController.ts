import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import crypto from 'crypto';

export const getShops = async (req: Request, res: Response): Promise<void> => {
  const shops = await prisma.shop.findMany({
    select: { id: true, name: true, hourlyWage: true, payday: true }
  });
  res.json(shops);
};

export const createShop = async (req: Request, res: Response): Promise<void> => {
  const { name, hourlyWage, payday } = req.body;
  if (!name || !hourlyWage || !payday) {
    res.status(400).json({ error: 'name, hourlyWage, payday required' });
    return;
  }
  const shop = await prisma.shop.create({
    data: { name, hourlyWage, payday, qrSecret: crypto.randomUUID() }
  });
  res.status(201).json(shop);
};

export const updateShop = async (req: Request, res: Response): Promise<void> => {
  const shopId = Number(req.params.id);
  const { name, hourlyWage, payday } = req.body;
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    res.status(404).json({ error: 'Shop not found' });
    return;
  }
  const updated = await prisma.shop.update({
    where: { id: shopId },
    data: { name, hourlyWage, payday }
  });
  res.json(updated);
};

export const deleteShop = async (req: Request, res: Response): Promise<void> => {
  const shopId = Number(req.params.id);
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    res.status(404).json({ error: 'Shop not found' });
    return;
  }
  await prisma.shop.delete({ where: { id: shopId } });
  res.status(204).send();
};

export const getEmployees = async (req: Request, res: Response): Promise<void> => {
  const shopId = Number(req.params.id);
  const employees = await prisma.employee.findMany({
    where: { shopId },
    select: { id: true, name: true, nationalId: true, phone: true, schedule: true }
  });
  res.json(employees);
};

export const createEmployee = async (req: Request, res: Response): Promise<void> => {
  const shopId = Number(req.params.id);
  const { name, nationalId, accountNumber, phone, schedule } = req.body;
  if (!name || !nationalId || !accountNumber || !phone || !schedule) {
    res.status(400).json({ error: 'All fields required' });
    return;
  }
  const emp = await prisma.employee.create({
    data: { shopId, name, nationalId, accountNumber, phone, schedule }
  });
  res.status(201).json(emp);
};

export const updateEmployee = async (req: Request, res: Response): Promise<void> => {
  const empId = Number(req.params.id);
  const { name, accountNumber, phone, schedule } = req.body;
  const emp = await prisma.employee.findUnique({ where: { id: empId } });
  if (!emp) {
    res.status(404).json({ error: 'Employee not found' });
    return;
  }
  const updated = await prisma.employee.update({
    where: { id: empId },
    data: { name, accountNumber, phone, schedule }
  });
  res.json(updated);
};

export const deleteEmployee = async (req: Request, res: Response): Promise<void> => {
  const empId = Number(req.params.id);
  const emp = await prisma.employee.findUnique({ where: { id: empId } });
  if (!emp) {
    res.status(404).json({ error: 'Employee not found' });
    return;
  }
  await prisma.employee.delete({ where: { id: empId } });
  res.status(204).send();
};
