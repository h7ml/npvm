import type {
  RemoteRepoInfo,
  RemotePackageInfo,
  RemoteUpdateInfo,
  DependencyNode,
  VulnerabilityInfo,
  RemoteAnalysisResult,
  NpmPackageMeta,
} from '@dext7r/npvm-shared';

const NPM_REGISTRY = 'https://registry.npmjs.org';
const OSV_API = 'https://api.osv.dev/v1/querybatch';

// 镜像源站点到 registry URL 映射
const NPM_SITE_REGISTRY_MAP: Record<string, string> = {
  'npmjs.com': 'https://registry.npmjs.org',
  'www.npmjs.com': 'https://registry.npmjs.org',
  'npmmirror.com': 'https://registry.npmmirror.com',
  'npm.taobao.org': 'https://registry.npmmirror.com',
  'yarnpkg.com': 'https://registry.yarnpkg.com',
};

// 输入类型
type InputType = 'npm-package' | 'npm-site-url' | 'git-url';

// 解析输入类型
export function parseInputType(input: string): { type: InputType; value: string; registry?: string } {
  const trimmed = input.trim();

  // 检测 npm 站点 URL
  for (const [domain, registry] of Object.entries(NPM_SITE_REGISTRY_MAP)) {
    const urlPattern = new RegExp(`^https?:\\/\\/${domain.replace('.', '\\.')}\\/package\\/(.+)$`);
    const match = trimmed.match(urlPattern);
    if (match) {
      return { type: 'npm-site-url', value: match[1], registry };
    }
  }

  // 检测 Git URL (http/https/git@)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('git@')) {
    return { type: 'git-url', value: trimmed };
  }

  // 其他情况视为 npm 包名 (lodash, @scope/package)
  if (/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i.test(trimmed)) {
    return { type: 'npm-package', value: trimmed };
  }

  // 默认尝试作为 Git URL 处理
  return { type: 'git-url', value: trimmed };
}

// 解析 Git URL
export function parseGitUrl(url: string): RemoteRepoInfo {
  const patterns = [
    // https://github.com/owner/repo
    /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/tree\/([^\/]+))?$/,
    // git@github.com:owner/repo.git
    /^git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/,
    // https://gitlab.com/owner/repo
    /^https?:\/\/gitlab\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/-\/tree\/([^\/]+))?$/,
    // git@gitlab.com:owner/repo.git
    /^git@gitlab\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const isGitlab = url.includes('gitlab');
      return {
        platform: isGitlab ? 'gitlab' : 'github',
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
        branch: match[3],
      };
    }
  }

  throw new Error(`Invalid Git URL: ${url}`);
}

// 获取 GitHub 文件内容
async function fetchGitHubFile(
  owner: string,
  repo: string,
  path: string,
  branch?: string
): Promise<string | null> {
  const ref = branch || 'HEAD';
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3.raw',
        'User-Agent': 'NPVM-Remote-Analyzer',
      },
    });

    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

// 获取 GitLab 文件内容
async function fetchGitLabFile(
  owner: string,
  repo: string,
  path: string,
  branch?: string
): Promise<string | null> {
  const projectId = encodeURIComponent(`${owner}/${repo}`);
  const ref = branch || 'HEAD';
  const encodedPath = encodeURIComponent(path);
  const url = `https://gitlab.com/api/v4/projects/${projectId}/repository/files/${encodedPath}/raw?ref=${ref}`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'NPVM-Remote-Analyzer' },
    });

    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

// 通过 API 获取仓库文件
export async function fetchRepoFile(
  repoInfo: RemoteRepoInfo,
  filePath: string
): Promise<string | null> {
  if (repoInfo.platform === 'github') {
    return fetchGitHubFile(repoInfo.owner, repoInfo.repo, filePath, repoInfo.branch);
  } else {
    return fetchGitLabFile(repoInfo.owner, repoInfo.repo, filePath, repoInfo.branch);
  }
}

// 解析 package.json
export function parsePackageJson(content: string): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
} {
  try {
    const pkg = JSON.parse(content);
    return {
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
    };
  } catch {
    return { dependencies: {}, devDependencies: {} };
  }
}

// 从 package.json 提取包列表
export function extractPackages(
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>
): RemotePackageInfo[] {
  const packages: RemotePackageInfo[] = [];

  for (const [name, version] of Object.entries(dependencies)) {
    packages.push({
      name,
      version: version.replace(/^[\^~>=<]/, ''),
      isDev: false,
    });
  }

  for (const [name, version] of Object.entries(devDependencies)) {
    packages.push({
      name,
      version: version.replace(/^[\^~>=<]/, ''),
      isDev: true,
    });
  }

  return packages;
}

// 检测 lock 文件类型
export async function detectLockFileType(
  repoInfo: RemoteRepoInfo
): Promise<{ type: 'npm' | 'yarn' | 'pnpm'; content: string } | null> {
  // 尝试 pnpm-lock.yaml
  let content = await fetchRepoFile(repoInfo, 'pnpm-lock.yaml');
  if (content) return { type: 'pnpm', content };

  // 尝试 yarn.lock
  content = await fetchRepoFile(repoInfo, 'yarn.lock');
  if (content) return { type: 'yarn', content };

  // 尝试 package-lock.json
  content = await fetchRepoFile(repoInfo, 'package-lock.json');
  if (content) return { type: 'npm', content };

  return null;
}

// 解析 package-lock.json 构建依赖树
function parseNpmLockFile(content: string): DependencyNode {
  try {
    const lock = JSON.parse(content);
    const root: DependencyNode = {
      name: lock.name || 'root',
      version: lock.version || '0.0.0',
      children: [],
    };

    // lockfileVersion 2+ 使用 packages 字段
    const packages = lock.packages || {};
    const deps = lock.dependencies || {};

    // 构建一级依赖
    if (Object.keys(packages).length > 0) {
      for (const [path, info] of Object.entries(packages) as [string, any][]) {
        if (path === '' || !path.startsWith('node_modules/')) continue;

        // 只处理一级依赖
        const parts = path.replace('node_modules/', '').split('node_modules/');
        if (parts.length === 1) {
          root.children.push({
            name: parts[0],
            version: info.version || '0.0.0',
            children: [],
          });
        }
      }
    } else if (Object.keys(deps).length > 0) {
      for (const [name, info] of Object.entries(deps) as [string, any][]) {
        root.children.push({
          name,
          version: info.version || '0.0.0',
          children: [],
        });
      }
    }

    return root;
  } catch {
    return { name: 'root', version: '0.0.0', children: [] };
  }
}

// 解析 yarn.lock
function parseYarnLockFile(content: string): DependencyNode {
  const root: DependencyNode = {
    name: 'root',
    version: '0.0.0',
    children: [],
  };

  try {
    // 简化解析：提取包名和版本
    const regex = /^"?([^@\s]+)@[^"]+?"?:\s*\n\s+version\s+"([^"]+)"/gm;
    let match;
    const seen = new Set<string>();

    while ((match = regex.exec(content)) !== null) {
      const name = match[1];
      const version = match[2];

      if (!seen.has(name)) {
        seen.add(name);
        root.children.push({ name, version, children: [] });
      }
    }
  } catch {
    // 忽略解析错误
  }

  return root;
}

// 解析 pnpm-lock.yaml
function parsePnpmLockFile(content: string): DependencyNode {
  const root: DependencyNode = {
    name: 'root',
    version: '0.0.0',
    children: [],
  };

  try {
    // 简化解析：提取 packages 下的条目
    const lines = content.split('\n');
    let inPackages = false;
    const seen = new Set<string>();

    for (const line of lines) {
      if (line.startsWith('packages:')) {
        inPackages = true;
        continue;
      }

      if (inPackages && line.match(/^[a-z]/i)) {
        break;
      }

      if (inPackages) {
        // 匹配形如 /package-name@version: 或 'package-name@version':
        const match = line.match(/^\s+['"]?\/?([@\w\-./]+)@(\d+\.\d+\.\d+[^'":]*)/);
        if (match) {
          const name = match[1];
          const version = match[2];

          if (!seen.has(name)) {
            seen.add(name);
            root.children.push({ name, version, children: [] });
          }
        }
      }
    }
  } catch {
    // 忽略解析错误
  }

  return root;
}

// 解析 lock 文件构建依赖树
export function parseLockFile(
  content: string,
  type: 'npm' | 'yarn' | 'pnpm'
): DependencyNode {
  switch (type) {
    case 'npm':
      return parseNpmLockFile(content);
    case 'yarn':
      return parseYarnLockFile(content);
    case 'pnpm':
      return parsePnpmLockFile(content);
    default:
      return { name: 'root', version: '0.0.0', children: [] };
  }
}

// 调用 OSV API 检查漏洞
export async function checkVulnerabilities(
  packages: { name: string; version: string }[]
): Promise<VulnerabilityInfo[]> {
  if (packages.length === 0) return [];

  try {
    const queries = packages.map((pkg) => ({
      package: { name: pkg.name, ecosystem: 'npm' },
      version: pkg.version,
    }));

    const response = await fetch(OSV_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const vulnerabilities: VulnerabilityInfo[] = [];

    for (let i = 0; i < (data.results || []).length; i++) {
      const result = data.results[i];
      const pkg = packages[i];

      for (const vuln of result.vulns || []) {
        const severity = mapOsvSeverity(vuln.severity || vuln.database_specific?.severity);
        vulnerabilities.push({
          id: vuln.id,
          title: vuln.summary || vuln.id,
          severity,
          package: pkg.name,
          version: pkg.version,
          recommendation: vuln.affected?.[0]?.ranges?.[0]?.events?.find((e: any) => e.fixed)?.fixed
            ? `Upgrade to ${vuln.affected[0].ranges[0].events.find((e: any) => e.fixed).fixed}`
            : 'No fix available',
          url: vuln.references?.[0]?.url,
        });
      }
    }

    return vulnerabilities;
  } catch {
    return [];
  }
}

function mapOsvSeverity(severity: string | undefined): 'critical' | 'high' | 'moderate' | 'low' {
  if (!severity) return 'moderate';
  const s = severity.toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'high';
  if (s === 'moderate' || s === 'medium') return 'moderate';
  return 'low';
}

// 批量检查包的最新版本
export async function checkUpdates(
  packages: { name: string; version: string }[]
): Promise<RemoteUpdateInfo[]> {
  const results = await Promise.all(
    packages.map(async (pkg) => {
      try {
        const response = await fetch(`${NPM_REGISTRY}/${pkg.name}`);
        if (!response.ok) {
          return {
            name: pkg.name,
            currentVersion: pkg.version,
            latestVersion: pkg.version,
            hasUpdate: false,
          };
        }

        const data = await response.json();
        const latest = data['dist-tags']?.latest || pkg.version;

        return {
          name: pkg.name,
          currentVersion: pkg.version,
          latestVersion: latest,
          hasUpdate: latest !== pkg.version && !pkg.version.includes(latest),
        };
      } catch {
        return {
          name: pkg.name,
          currentVersion: pkg.version,
          latestVersion: pkg.version,
          hasUpdate: false,
        };
      }
    })
  );

  return results;
}

// 从 npm registry 获取包信息
async function fetchNpmPackageInfo(
  packageName: string,
  registry: string = NPM_REGISTRY
): Promise<{ meta: NpmPackageMeta; dependencies: Record<string, string>; devDependencies: Record<string, string> }> {
  const url = `${registry}/${encodeURIComponent(packageName)}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'NPVM-Remote-Analyzer' },
  });

  if (!response.ok) {
    throw new Error(`Package not found: ${packageName}`);
  }

  const data = await response.json();
  const latestVersion = data['dist-tags']?.latest;
  const latestInfo = data.versions?.[latestVersion] || {};

  const meta: NpmPackageMeta = {
    name: data.name,
    version: latestVersion || '0.0.0',
    description: data.description,
    author: typeof data.author === 'string' ? data.author : data.author?.name,
    license: data.license,
    homepage: data.homepage,
    repository: typeof data.repository === 'string' ? data.repository : data.repository?.url,
    keywords: data.keywords,
  };

  return {
    meta,
    dependencies: latestInfo.dependencies || {},
    devDependencies: latestInfo.devDependencies || {},
  };
}

// 分析 npm 包
async function analyzeNpmPackage(
  packageName: string,
  registry: string = NPM_REGISTRY
): Promise<RemoteAnalysisResult> {
  const { meta, dependencies, devDependencies } = await fetchNpmPackageInfo(packageName, registry);
  const packages = extractPackages(dependencies, devDependencies);

  // 构建简单依赖树 (仅一层深度)
  const dependencyTree: DependencyNode = {
    name: meta.name,
    version: meta.version,
    children: packages.filter((p) => !p.isDev).map((p) => ({
      name: p.name,
      version: p.version,
      children: [],
    })),
  };

  // 并行执行漏洞检查和更新检查
  const packagesForCheck = packages.slice(0, 50).map((p) => ({ name: p.name, version: p.version }));

  const [vulnerabilities, updates] = await Promise.all([
    checkVulnerabilities(packagesForCheck),
    checkUpdates(packagesForCheck),
  ]);

  return {
    sourceType: 'npm',
    packageMeta: meta,
    packages,
    dependencyTree,
    vulnerabilities,
    updates,
  };
}

// 分析 Git 仓库
async function analyzeGitRepo(repoUrl: string, branch?: string): Promise<RemoteAnalysisResult> {
  const repoInfo = parseGitUrl(repoUrl);
  if (branch) repoInfo.branch = branch;

  const packageJsonContent = await fetchRepoFile(repoInfo, 'package.json');
  if (!packageJsonContent) {
    throw new Error('package.json not found in repository');
  }

  const { dependencies, devDependencies } = parsePackageJson(packageJsonContent);
  const packages = extractPackages(dependencies, devDependencies);

  let dependencyTree: DependencyNode | null = null;
  let lockFileType: 'npm' | 'yarn' | 'pnpm' | undefined;

  const lockFile = await detectLockFileType(repoInfo);
  if (lockFile) {
    lockFileType = lockFile.type;
    dependencyTree = parseLockFile(lockFile.content, lockFile.type);
  }

  const packagesForCheck = packages.slice(0, 50).map((p) => ({ name: p.name, version: p.version }));

  const [vulnerabilities, updates] = await Promise.all([
    checkVulnerabilities(packagesForCheck),
    checkUpdates(packagesForCheck),
  ]);

  return {
    sourceType: 'git',
    repoInfo,
    packages,
    dependencyTree,
    vulnerabilities,
    updates,
    lockFileType,
  };
}

// 统一入口：分析远程仓库或 npm 包
export async function analyzeRemoteRepo(input: string, branch?: string): Promise<RemoteAnalysisResult> {
  const parsed = parseInputType(input);

  switch (parsed.type) {
    case 'npm-package':
    case 'npm-site-url':
      return analyzeNpmPackage(parsed.value, parsed.registry);
    case 'git-url':
    default:
      return analyzeGitRepo(parsed.value, branch);
  }
}
