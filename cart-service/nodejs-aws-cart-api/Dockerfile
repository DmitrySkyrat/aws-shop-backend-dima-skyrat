# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – builder
# Install ALL dependencies (including devDeps) and compile TypeScript → dist/
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first so that "npm ci" is cached as long as they don't change.
# TypeScript source files are copied AFTER this layer, so editing .ts files
# does NOT invalidate the npm-install cache layer.
COPY package.json package-lock.json ./

RUN npm ci

# Now copy source and config files needed for the build
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – production image
# Only the compiled output + production node_modules end up in the final image,
# keeping the image small (~140 MB with alpine).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Copy manifests and install ONLY production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled application from the builder stage
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV APP_PORT=4000

EXPOSE 4000

CMD ["node", "dist/main"]
