/**
 * 安全工具模块 - 输入验证和安全检查
 */

import { resolve } from 'path';
import { homedir } from 'os';

// 有效的 npm 包名正则（支持 @scope/package@version 格式）
const VALID_PACKAGE_NAME = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[a-z0-9^~>=<.*-]+)?$/i;

// 有效的 Git 分支名正则
const VALID_BRANCH_NAME = /^[a-zA-Z0-9._/-]+$/;

// 危险字符检测（shell 元字符）
const DANGEROUS_CHARS = /[;&|`$(){}[\]<>!#*?\\'"]/;

// 允许的文件系统根目录
const ALLOWED_FS_ROOTS = [
  homedir(),
  process.cwd(),
  '/tmp',
];

/**
 * 验证包名是否安全
 * @throws Error 如果包名无效或包含危险字符
 */
export function validatePackageName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new Error('Package name is required');
  }

  if (name.length > 214) {
    throw new Error('Package name too long');
  }

  if (DANGEROUS_CHARS.test(name)) {
    throw new Error(`Invalid package name: contains dangerous characters`);
  }

  if (!VALID_PACKAGE_NAME.test(name)) {
    throw new Error(`Invalid package name format: ${name}`);
  }
}

/**
 * 批量验证包名
 * @throws Error 如果任何包名无效
 */
export function validatePackageNames(packages: string[]): void {
  if (!Array.isArray(packages) || packages.length === 0) {
    throw new Error('Packages array is required');
  }

  if (packages.length > 100) {
    throw new Error('Too many packages (max 100)');
  }

  for (const pkg of packages) {
    validatePackageName(pkg);
  }
}

/**
 * 验证 URL 格式
 * @throws Error 如果 URL 无效
 */
export function validateUrl(url: string): void {
  if (!url || typeof url !== 'string') {
    throw new Error('URL is required');
  }

  if (DANGEROUS_CHARS.test(url)) {
    throw new Error('URL contains dangerous characters');
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only HTTP/HTTPS URLs are allowed');
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('Only HTTP')) {
      throw e;
    }
    throw new Error('Invalid URL format');
  }
}

/**
 * 验证 Git 分支名
 * @throws Error 如果分支名无效
 */
export function validateBranchName(branch: string): void {
  if (!branch || typeof branch !== 'string') {
    throw new Error('Branch name is required');
  }

  if (branch.length > 255) {
    throw new Error('Branch name too long');
  }

  if (branch.includes('..')) {
    throw new Error('Branch name cannot contain ".."');
  }

  if (!VALID_BRANCH_NAME.test(branch)) {
    throw new Error('Invalid branch name format');
  }
}

/**
 * 验证文件路径是否在允许的目录内
 * @throws Error 如果路径不在允许范围内
 */
export function validatePath(path: string, additionalRoots: string[] = []): string {
  if (!path || typeof path !== 'string') {
    throw new Error('Path is required');
  }

  const resolvedPath = resolve(path);
  const allowedRoots = [...ALLOWED_FS_ROOTS, ...additionalRoots];

  const isAllowed = allowedRoots.some((root) => {
    const resolvedRoot = resolve(root);
    return resolvedPath === resolvedRoot || resolvedPath.startsWith(resolvedRoot + '/');
  });

  if (!isAllowed) {
    throw new Error('Access denied: path outside allowed directories');
  }

  return resolvedPath;
}

/**
 * 验证项目路径（必须包含 package.json 或 node_modules）
 */
export function validateProjectPath(path: string): string {
  const resolvedPath = validatePath(path);
  // 项目路径验证在调用处进行（需要 fs 检查）
  return resolvedPath;
}

/**
 * 清理错误消息，移除敏感信息
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // 移除文件路径中的用户目录
    let message = error.message;
    const home = homedir();
    if (home) {
      message = message.replace(new RegExp(home, 'g'), '~');
    }
    // 移除堆栈跟踪
    return message.split('\n')[0];
  }
  return 'An unexpected error occurred';
}

/**
 * 清理日志中的敏感路径
 */
export function sanitizePath(path: string): string {
  const home = homedir();
  if (home && path.startsWith(home)) {
    return path.replace(home, '~');
  }
  return path;
}
