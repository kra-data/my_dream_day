// src/utils/serialize.ts
import { Prisma } from '@prisma/client';

// Prisma Decimal인지 체크
const isDecimal = (v: any): v is Prisma.Decimal =>
  v && typeof v === 'object' && typeof (v as any).toNumber === 'function';

/** JSON 응답 전에 BigInt/Decimal 등을 안전하게 변환 */
export const toJSONSafe = <T>(data: T): any => {
  return JSON.parse(
    JSON.stringify(
      data,
      (_k, v) => {
        if (typeof v === 'bigint') return v.toString();         // BigInt -> string
        if (isDecimal(v)) return v.toNumber();                   // Decimal -> number
        return v;
      }
    )
  );
};