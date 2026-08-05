# ─────────────────────────────────────
# Stage 1: Install dependencies
# ─────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ─────────────────────────────────────
# Stage 2: Build Next.js
# ─────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client explicitly because dependencies are installed with
# lifecycle scripts disabled in the dependency stage.
RUN DATABASE_URL="mysql://root:root@localhost:3306/livechatnemark" npx prisma generate

# Build Next.js (production)
RUN npm run build
RUN test -s .next/BUILD_ID \
    && find .next/static -type f -name '*.js' -print -quit | grep -q .

# ─────────────────────────────────────
# Stage 3: Production runner
# ─────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install Chromium for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copy production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# We still need tsx for the backend at runtime
RUN npm install tsx concurrently

# Copy built Next.js output
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
RUN DATABASE_URL="mysql://root:root@localhost:3306/livechatnemark" npx prisma generate

# Copy backend source (runs via tsx at runtime)
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts/smoke-static-assets.ts ./scripts/smoke-static-assets.ts
COPY --from=builder /app/scripts/smoke-public-assets.mjs ./scripts/smoke-public-assets.mjs

# Create directories for persistent data
RUN mkdir -p /app/data/browser-profiles /app/data/zalo-sessions /app/public/uploads

EXPOSE 3020 4020

CMD ["npx", "concurrently", "next start -p 3020", "node --import tsx src/bootstrap/index.ts"]
