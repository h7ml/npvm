import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';
import type { PackageManagerType } from '@dext7r/npvm-shared';
import { registerRoutes } from './routes/api.js';
import { detectAllPackageManagers } from './adapters/index.js';
import { getLandingPage } from './landing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ServerOptions {
  port?: number;
  host?: string;
  projectPath?: string;
}

// 检测目录是否为项目目录
function isProjectDirectory(dir: string): boolean {
  return existsSync(join(dir, 'package.json')) || existsSync(join(dir, 'node_modules'));
}

export async function createServer(options: ServerOptions = {}) {
  const {
    port = 3456,
    host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost',
    projectPath = process.cwd()
  } = options;

  // 确保使用绝对路径
  const absoluteProjectPath = resolve(projectPath);

  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  });

  // 注册 Swagger 文档
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'npvm API',
        description: 'Node Package Manager Visual Platform API',
        version: '0.1.0',
      },
      servers: [
        { url: `http://localhost:${port}`, description: 'Local server' },
      ],
      tags: [
        { name: 'pm', description: 'Package Manager detection' },
        { name: 'registry', description: 'Registry management' },
        { name: 'project', description: 'Project configuration' },
        { name: 'packages', description: 'Package operations' },
        { name: 'deps', description: 'Dependency analysis' },
        { name: 'security', description: 'Security audit' },
      ],
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // 检测可用的包管理器并设置默认值
  const managers = await detectAllPackageManagers();
  const defaultPm =
    managers.find((m) => m.available)?.type || ('npm' as PackageManagerType);

  // 智能检测：如果当前目录是项目目录则使用项目模式，否则使用全局模式
  const isProject = isProjectDirectory(absoluteProjectPath);

  const state = {
    currentPm: defaultPm,
    currentRegistry: 'https://registry.npmjs.org/',
    projectPath: absoluteProjectPath,
    isGlobal: !isProject,
  };

  console.warn(`📦 Mode: ${state.isGlobal ? 'Global' : 'Project'} (${absoluteProjectPath})`);

  // 注册 API 路由
  await registerRoutes(app, state);

  // 静态文件服务（前端构建产物）- 必须在 SEO 路由之前注册
  const webDistPath = join(__dirname, '../../web/dist');
  if (existsSync(webDistPath)) {
    await app.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
      wildcard: false,
    });
    // SPA fallback：非 API/docs/SEO 路由返回 index.html
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/docs')) {
        reply.code(404).send({ error: 'Not Found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  } else {
    app.get('/', async (_request, reply) => {
      reply.type('text/html').send(getLandingPage(port));
    });
  }

  return { app, port, host };
}

export async function startServer(options: ServerOptions = {}) {
  const { app, port, host } = await createServer(options);

  try {
    await app.listen({ port, host });
    console.warn(`\n🚀 npvm Server running at http://${host}:${port}\n`);
    return app;
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// 直接运行时启动服务器
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
