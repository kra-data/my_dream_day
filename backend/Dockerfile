# ─────────────────────────────
# 1) Build stage
# ─────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Prisma 러ntime에 openssl 필요 (alpine)
RUN apk add --no-cache openssl

# deps
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# sources
COPY tsconfig.json ./
COPY src ./src

# Prisma client generate (빌드에 필요)
RUN npx prisma generate

# build TS -> dist
RUN npm run build


# ─────────────────────────────
# 2) Runtime stage
# ─────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Prisma 러ntime에 openssl 필요 (alpine)
RUN apk add --no-cache openssl

# 런타임에 필요한 것만 복사
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

# ✅ 정적 자산(폰트/로고)을 이미지에 포함
#    프로젝트 루트의 ./assets 가 존재해야 합니다.
COPY assets ./assets

# ✅ 애플리케이션이 자산을 찾는 기준 경로
ENV ASSETS_DIR=/app/assets

# entrypoint
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3001

CMD ["./docker-entrypoint.sh"]
