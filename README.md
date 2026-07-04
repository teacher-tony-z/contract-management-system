# 合同流程管理系统

公司内部使用的合同全流程管理系统，覆盖销售录入→财务评审→生产→质检→发货→售后完整业务闭环。

## 技术栈

- **前端**: Vue 3 + TypeScript + Element Plus + Vite + Pinia
- **后端**: NestJS + TypeORM + PostgreSQL
- **部署**: Docker + Nginx

## 快速开始

### 开发环境

1. 启动 PostgreSQL: `docker compose -f docker-compose.yml up -d`
2. 启动后端: `cd server && npm run start:dev`
3. 启动前端: `cd client && npm run dev`
4. 访问: http://localhost:5173

### 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| sales1 | 123456 | 销售 |
| finance1 | 123456 | 财务 |
| prod1 | 123456 | 生产 |
| qc1 | 123456 | 质检 |

## 项目结构

```
contract-management-system/
├── client/                 # 前端 Vue 3 应用
│   ├── src/
│   │   ├── views/         # 页面组件
│   │   ├── router/        # 路由配置
│   │   └── store/         # Pinia 状态管理
│   └── dist/              # 构建产物
├── server/                 # 后端 NestJS 应用
│   ├── src/
│   │   ├── modules/       # 业务模块
│   │   ├── common/        # 公共模块
│   │   └── database/      # 数据库配置
│   └── dist/              # 构建产物
├── deploy/                 # 部署配置
│   ├── Dockerfile
│   ├── nginx.conf
│   └── docker-compose.yml
└── .env.example           # 环境变量模板
```
