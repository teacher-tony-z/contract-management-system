# 合同管理系统 - 部署文档

## 架构概览

```
                        ┌──────────────┐
                        │   用户浏览器   │
                        └──────┬───────┘
                               │ :80
                        ┌──────▼───────┐
                        │   Nginx      │  ← 反向代理
                        │   (contract- │
                        │    nginx)     │
                        └──────┬───────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
         ┌──────▼──────┐   ┌──▼──────────┐   │
         │ 前端静态文件  │   │ /api/* 代理  │   │
         │ (client/dist)│   └──┬──────────┘   │
         └─────────────┘      │              │
                      ┌───────▼───────┐      │
                      │  NestJS 后端   │      │
                      │  (contract-app)│      │
                      └───────┬───────┘      │
                              │              │
                      ┌───────▼───────┐      │
                      │  PostgreSQL    │      │
                      │  (contract-    │      │
                      │   postgres)    │      │
                      └───────────────┘      │
                                             │
                 同一 Docker 网络 (contract-network)
```

## 部署步骤

### 前提条件

| 组件 | 版本要求 | 备注 |
|------|---------|------|
| Windows Server | 2019/2022 | 或 Windows 10/11 Pro |
| Docker | 24+ | 自动安装或手动下载 |
| 网络 | 公网 IP | 云服务器默认提供 |

### 方式一：一键部署（推荐）

以 **管理员身份** 打开 PowerShell，执行：

```powershell
# 1. 确保 Docker 已安装（如已安装可跳过）
.\deploy\setup-docker.ps1

# 2. 如果安装 Docker 后重启了服务器，再次打开 PowerShell

# 3. 一键部署
.\deploy\deploy.ps1
```

脚本会自动完成：
- ✅ 检查 Docker 环境
- ✅ 检查项目文件完整性
- ✅ 构建前端静态文件（基于 Docker，无需本地 Node.js）
- ✅ 构建后端镜像
- ✅ 启动 PostgreSQL + 后端 + Nginx
- ✅ 配置 Windows 防火墙
- ✅ 验证所有服务状态

### 方式二：分步部署

```powershell
# 1. 构建前端
docker run --rm -v "${PWD}/client:/app/client" -w /app/client node:20-alpine sh -c "npm ci && npm run build"

# 2. 启动所有服务
docker compose --project-directory $PWD -f deploy/docker-compose.yml up -d --build

# 3. 查看状态
docker ps
```

### 方式三：Linux 服务器部署

如果是 Linux 云服务器，在服务器上执行：

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 克隆项目
git clone <你的仓库地址> /opt/contract-system
cd /opt/contract-system

# 构建前端
docker run --rm -v "$(pwd)/client:/app/client" -w /app/client node:20-alpine sh -c "npm ci && npm run build"

# 启动服务
HTTP_PORT=80 docker compose --project-directory $(pwd) -f deploy/docker-compose.yml up -d --build
```

## 访问系统

部署完成后，浏览器访问：**`http://<服务器IP>`**

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| sales1 | 123456 | 销售 |
| finance1 | 123456 | 财务 |
| prod1 | 123456 | 生产 |
| qc1 | 123456 | 质检 |

## 代码更新

```powershell
# 在服务器项目目录下执行
cd C:\contract-management-system

# 拉取最新代码
git pull

# 重新部署（自动重新构建并启动）
.\deploy\deploy.ps1
```

## 常用运维命令

### 查看状态

```powershell
# 所有运行中的容器
docker ps

# 容器详细信息
docker inspect contract-app

# 资源占用
docker stats
```

### 查看日志

```powershell
# 所有服务日志
docker compose -f deploy/docker-compose.yml logs -f

# 单独某个服务
docker compose -f deploy/docker-compose.yml logs -f app
docker compose -f deploy/docker-compose.yml logs -f nginx
docker compose -f deploy/docker-compose.yml logs -f postgres
```

### 服务管理

```powershell
# 停止所有服务
docker compose -f deploy/docker-compose.yml down

# 重新启动
docker compose -f deploy/docker-compose.yml up -d

# 重启某个服务
docker compose -f deploy/docker-compose.yml restart app

# 查看端口映射
docker port contract-nginx

# 进入容器内部
docker exec -it contract-app sh
docker exec -it contract-postgres psql -U postgres -d contract_db
```

### 数据库管理

```powershell
# 连接数据库
docker exec -it contract-postgres psql -U postgres -d contract_db

# 备份数据库
docker exec contract-postgres pg_dump -U postgres contract_db > backup_$(Get-Date -Format yyyyMMdd).sql

# 恢复数据库
Get-Content backup.sql | docker exec -i contract-postgres psql -U postgres -d contract_db
```

### 磁盘清理

```powershell
# 查看磁盘占用
docker system df

# 清理未使用的镜像、容器、卷
docker system prune -f

# 清理所有（包括未使用的镜像）
docker system prune -a -f
```

## 安全建议

### 1. 修改默认密码

部署后立即修改以下密码：

| 位置 | 默认值 | 操作 |
|------|--------|------|
| `deploy/.env` → `JWT_SECRET` | 默认值 | 改为随机字符串 |
| `deploy/.env` → `DB_PASSWORD` | `Contract@DB2024!` | 改为强密码 |
| admin 账号 | `admin123` | 登录后修改 |
| 其他测试账号 | `123456` | 登录后修改 |

生成随机密钥：
```powershell
# 安装 openssl 后
openssl rand -base64 32
```

### 2. HTTPS 配置

通过反向代理或云服务商配置 SSL 证书，建议使用 Let's Encrypt 或云服务商提供的免费证书。

### 3. 数据库安全

- 生产环境建议将 `synchronize: false` 并改用数据库迁移
- 定期备份数据库
- 限制数据库端口仅内部访问

## 故障排查

### 问题：服务启动失败

```powershell
# 查看详细错误
docker compose -f deploy/docker-compose.yml logs

# 检查 Docker 是否正常运行
docker info

# 检查端口占用
netstat -ano | Select-String ":80 "
```

### 问题：数据库连接失败

```powershell
# 检查 PostgreSQL 是否就绪
docker compose -f deploy/docker-compose.yml logs postgres

# 手动测试连接
docker exec -it contract-postgres psql -U postgres -d contract_db -c "SELECT 1;"
```

### 问题：页面返回 502 Bad Gateway

```powershell
# 检查后端是否正常运行
docker compose -f deploy/docker-compose.yml logs app

# 直接在容器内测试
docker exec contract-app wget --spider http://localhost:3000/api/health
```

### 问题：前端显示空白页

```powershell
# 检查前端文件是否存在
docker run --rm -v contract-frontend-dist:/dist alpine ls -la /dist

# 重新构建前端
.\deploy\deploy.ps1
```

### 问题：磁盘空间不足

```powershell
# 查看 Docker 磁盘使用
docker system df

# 清理
docker system prune -a -f

# 清理旧的构建缓存
docker builder prune -f
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `Dockerfile` | 多阶段构建（前端 + 后端 ⇒ 生产镜像） |
| `docker-compose.yml` | 服务编排（PostgreSQL + NestJS + Nginx） |
| `nginx.conf` | Nginx 反向代理配置 |
| `.env` | 生产环境变量 |
| `deploy.ps1` | Windows Server 一键部署脚本 |
| `setup-docker.ps1` | Docker 环境安装脚本 |

## 环境变量参考

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DB_PASSWORD` | `postgres` | 数据库密码 |
| `JWT_SECRET` | - | JWT 签名密钥（**必须修改**） |
| `HTTP_PORT` | `80` | HTTP 监听端口 |
