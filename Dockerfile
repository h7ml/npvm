# ================================
# Stage 1: Build
# ================================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# 复制依赖文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/web/package.json ./packages/web/
COPY packages/cli/package.json ./packages/cli/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY packages ./packages

# 构建
RUN pnpm build

# ================================
# Stage 2: Production
# ================================
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 npvm

# 复制构建产物
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/package.json ./packages/server/
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/web/dist ./packages/web/dist

# 仅安装生产依赖
RUN pnpm install --frozen-lockfile --prod

# 切换用户
USER npvm

# 暴露端口
EXPOSE 3456

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3456/api/pm/detect || exit 1

# 启动服务
CMD ["node", "packages/server/dist/index.js"]
