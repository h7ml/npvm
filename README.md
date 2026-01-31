<div align="center">

# NPVM

**Node Package Manager Visual Platform**

[![npm version](https://img.shields.io/npm/v/@dext7r/npvm-cli.svg)](https://www.npmjs.com/package/@dext7r/npvm-cli)
[![CI](https://github.com/h7ml/NPVM/actions/workflows/ci.yml/badge.svg)](https://github.com/h7ml/NPVM/actions/workflows/ci.yml)
[![Release](https://github.com/h7ml/NPVM/actions/workflows/release.yml/badge.svg)](https://github.com/h7ml/NPVM/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.x-orange)](https://pnpm.io/)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://hub.docker.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)

**[Live Demo](https://npvm.zeabur.app)** | **[API Docs](https://npvm.zeabur.app/docs)**

[English](./README.md) | [简体中文](./README.zh-CN.md)

</div>

---

## Overview

NPVM is a modern visual platform for managing Node.js packages. It provides a clean web interface to manage npm/yarn/pnpm/bun packages across global and project-level installations.

<div align="center">
  <img src="./docs/screenshot.png" alt="NPVM Screenshot" width="800" />
</div>

## Features

- **Multi Package Manager Support** - Detect and switch between npm, yarn, pnpm, and bun
- **Global & Project Mode** - Manage both global packages and project dependencies
- **Registry Management** - Switch between npm, taobao, tencent, and other registries
- **Package Operations** - Install, uninstall, and update packages with real-time progress
- **Update Detection** - Check for package updates and deprecated packages
- **Security Audit** - Scan for vulnerabilities in your dependencies
- **Dependency Tree** - Visualize your dependency hierarchy
- **Remote Repository Analysis** - Analyze GitHub/GitLab repos without cloning
- **i18n Support** - English and Chinese interface
- **Dark Mode** - Built-in dark theme support
- **Swagger API** - RESTful API with Swagger documentation

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0

### Install via npm

```bash
npm install -g @dext7r/npvm-cli

# Launch
npvm
```

### Install from source

```bash
git clone https://github.com/h7ml/NPVM.git
cd NPVM
pnpm install
pnpm dev
```

The server will start at `http://localhost:3456` and the web UI at `http://localhost:5173`.

### Docker

```bash
# Build and run
docker compose up -d

# Or build manually
docker build -t npvm .
docker run -p 3456:3456 npvm
```

### Deploy to Zeabur

[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/npvm)

Or deploy manually:
1. Fork this repository
2. Create a new project on [Zeabur](https://zeabur.com)
3. Import from GitHub and select the forked repo
4. Zeabur will auto-detect Dockerfile and deploy

## Project Structure

```
NPVM/
├── packages/
│   ├── shared/          # @dext7r/npvm-shared - Shared types and utilities
│   ├── server/          # @dext7r/npvm-server - Fastify backend server
│   ├── cli/             # @dext7r/npvm-cli - CLI entry point
│   └── web/             # @dext7r/npvm-web - React frontend
├── Dockerfile
├── docker-compose.yml
└── turbo.json
```

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 18, Vite, TypeScript, TailwindCSS, Zustand, React Query |
| Backend  | Fastify, Node.js, TypeScript |
| Build    | pnpm workspaces, Turborepo |
| DevOps   | Docker, GitHub Actions |

## API Documentation

Once the server is running, visit `http://localhost:3456/docs` for the Swagger API documentation.

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pm/detect` | Detect installed package managers |
| GET | `/api/packages` | List installed packages |
| POST | `/api/packages/install` | Install packages (SSE) |
| POST | `/api/packages/update` | Update packages (SSE) |
| POST | `/api/packages/uninstall` | Uninstall packages (SSE) |
| POST | `/api/security/audit` | Run security audit |
| GET | `/api/deps/tree` | Get dependency tree |
| POST | `/api/remote/analyze` | Analyze remote repository |

## Development

```bash
# Install dependencies
pnpm install

# Start development (all packages)
pnpm dev

# Build all packages
pnpm build

# Type check
pnpm typecheck

# Clean build artifacts
pnpm clean
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=h7ml/NPVM&type=Date)](https://star-history.com/#h7ml/NPVM&Date)

## License

[MIT](./LICENSE) © 2026 [h7ml](https://github.com/h7ml)
