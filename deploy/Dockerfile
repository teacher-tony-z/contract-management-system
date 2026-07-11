# ============================================
# Stage 1: Build frontend (Vue 3 + Vite)
# ============================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --omit=optional
COPY client/ ./
RUN npm run build

# ============================================
# Stage 2: Build backend (NestJS)
# ============================================
FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=optional
COPY server/ ./
RUN npm run build

# ============================================
# Stage 3: Production image (backend only)
# ============================================
FROM node:20-alpine
LABEL maintainer="Contract Management System"
LABEL description="合同管理系统 - NestJS 后端服务"

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy built backend artifacts
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/package.json ./

# Switch to non-root user
USER appuser

EXPOSE 3000
CMD ["node", "dist/main"]
