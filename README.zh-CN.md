<div align="center">

# NPVM

**Node 包管理器可视化平台**

[![npm version](https://img.shields.io/npm/v/@dext7r/npvm-cli.svg)](https://www.npmjs.com/package/@dext7r/npvm-cli)
[![CI](https://github.com/h7ml/NPVM/actions/workflows/ci.yml/badge.svg)](https://github.com/h7ml/NPVM/actions/workflows/ci.yml)
[![Release](https://github.com/h7ml/NPVM/actions/workflows/release.yml/badge.svg)](https://github.com/h7ml/NPVM/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.x-orange)](https://pnpm.io/)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://hub.docker.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)

**[在线演示](https://npvm.zeabur.app)** | **[API 文档](https://npvm.zeabur.app/docs)**

[English](./README.md) | [简体中文](./README.zh-CN.md)

</div>

---

## 概述

NPVM 是一个现代化的 Node.js 包管理可视化平台。提供简洁的 Web 界面来管理 npm/yarn/pnpm/bun 的全局和项目级别包。

## 功能特性

- **多包管理器支持** - 检测并切换 npm、yarn、pnpm、bun
- **全局/项目模式** - 管理全局包和项目依赖
- **镜像源管理** - 在 npm、淘宝、腾讯等镜像源间切换
- **包操作** - 安装、卸载、更新包，实时进度显示
- **更新检测** - 检查包更新和废弃状态
- **安全审计** - 扫描依赖中的安全漏洞
- **依赖树** - 可视化依赖层级
- **远程仓库分析** - 无需克隆即可分析 GitHub/GitLab 仓库
- **国际化** - 支持中英文界面
- **暗色模式** - 内置暗色主题
- **Swagger API** - RESTful API 文档

## 快速开始

### 环境要求

- Node.js >= 20.0.0
- pnpm >= 9.0.0

### 通过 npm 安装

```bash
npm install -g @dext7r/npvm-cli

# 启动
npvm
```

### 从源码安装

```bash
git clone https://github.com/h7ml/NPVM.git
cd NPVM
pnpm install
pnpm dev
```

服务器启动在 `http://localhost:3456`，Web 界面在 `http://localhost:5173`。

### Docker 部署

```bash
# 构建并运行
docker compose up -d

# 或手动构建
docker build -t npvm .
docker run -p 3456:3456 npvm
```

### 部署到 Zeabur

[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/npvm)

或手动部署：
1. Fork 本仓库
2. 在 [Zeabur](https://zeabur.com) 创建新项目
3. 从 GitHub 导入并选择 fork 的仓库
4. Zeabur 会自动检测 Dockerfile 并部署

## 项目结构

```
NPVM/
├── packages/
│   ├── shared/          # @dext7r/npvm-shared - 共享类型和工具
│   ├── server/          # @dext7r/npvm-server - Fastify 后端服务
│   ├── cli/             # @dext7r/npvm-cli - CLI 入口
│   └── web/             # @dext7r/npvm-web - React 前端
├── Dockerfile
├── docker-compose.yml
└── turbo.json
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18, Vite, TypeScript, TailwindCSS, Zustand, React Query |
| 后端 | Fastify, Node.js, TypeScript |
| 构建 | pnpm workspaces, Turborepo |
| 部署 | Docker, GitHub Actions |

## API 文档

服务器运行后，访问 `http://localhost:3456/docs` 查看 Swagger API 文档。

### 主要接口

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/pm/detect` | 检测已安装的包管理器 |
| GET | `/api/packages` | 获取已安装的包列表 |
| POST | `/api/packages/install` | 安装包 (SSE) |
| POST | `/api/packages/update` | 更新包 (SSE) |
| POST | `/api/packages/uninstall` | 卸载包 (SSE) |
| POST | `/api/security/audit` | 运行安全审计 |
| GET | `/api/deps/tree` | 获取依赖树 |
| POST | `/api/remote/analyze` | 分析远程仓库 |

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发模式
pnpm dev

# 构建所有包
pnpm build

# 类型检查
pnpm typecheck

# 清理构建产物
pnpm clean
```

## 贡献

欢迎贡献！请参阅 [贡献指南](./CONTRIBUTING.md)。

## 更新日志

查看 [CHANGELOG.md](./CHANGELOG.md) 了解发布历史。

## Star 趋势

[![Star History Chart](https://api.star-history.com/svg?repos=h7ml/NPVM&type=Date)](https://star-history.com/#h7ml/NPVM&Date)

## 许可证

[MIT](./LICENSE) © 2026 [h7ml](https://github.com/h7ml)
