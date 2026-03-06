# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-slim

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist

CMD ["node", "dist/worker.js"]
