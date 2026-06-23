# ─── Stage 1: builder ────────────────────────────────────────────────────────
# Install ALL deps and compile TypeScript → dist/
# package.json is copied before source so npm ci is cached when only .ts changes
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ─── Stage 2: production ──────────────────────────────────────────────────────
# Only compiled output + production deps → image ~100 MB
FROM node:20-alpine AS production

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
