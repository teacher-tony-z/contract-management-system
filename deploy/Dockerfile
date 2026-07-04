# ============================================
# Stage 1: Build frontend (Vue 3 + Vite)
# ============================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ============================================
# Stage 2: Build backend (NestJS)
# ============================================
FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ============================================
# Stage 3: Production image (backend)
# ============================================
FROM node:20-alpine
WORKDIR /app
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/main"]
