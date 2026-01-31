import { randomUUID } from 'node:crypto';
import { execa } from 'execa';
import which from 'which';
import type {
  PackageManagerInfo,
  InstalledPackage,
  DependencyNode,
  AuditResult,
  AuditFixResult,
  OperationProgress,
  VulnerabilityInfo,
  NpmAuditVulnerability,
  NpmAuditAdvisory,
} from '@dext7r/npvm-shared';
import type { PackageManagerAdapter, InstallOptions, UninstallOptions } from './base.js';
import { validatePackageNames, validateUrl } from '../utils/security.js';

export class BunAdapter implements PackageManagerAdapter {
  readonly type = 'bun' as const;

  async detect(): Promise<PackageManagerInfo> {
    try {
      const path = await which('bun');
      const { stdout } = await execa('bun', ['--version']);
      return {
        type: 'bun',
        version: stdout.trim(),
        path,
        available: true,
      };
    } catch {
      return { type: 'bun', version: '', path: '', available: false };
    }
  }

  async getInstalledPackages(cwd: string): Promise<InstalledPackage[]> {
    try {
      const { stdout } = await execa('bun', ['pm', 'ls'], { cwd });
      const packages: InstalledPackage[] = [];
      const lines = stdout.split('\n');

      for (const line of lines) {
        const match = line.match(/^([^@\s]+)@(\S+)/);
        if (match) {
          packages.push({
            name: match[1],
            version: match[2],
            isDev: line.includes('dev'),
            isPeer: line.includes('peer'),
            hasUpdate: false,
          });
        }
      }

      return packages;
    } catch {
      return [];
    }
  }

  async getGlobalPackages(): Promise<InstalledPackage[]> {
    try {
      const { stdout } = await execa('bun', ['pm', 'ls', '-g']);
      const packages: InstalledPackage[] = [];
      const lines = stdout.split('\n');

      for (const line of lines) {
        const match = line.match(/^([^@\s]+)@(\S+)/);
        if (match) {
          packages.push({
            name: match[1],
            version: match[2],
            isDev: false,
            isPeer: false,
            hasUpdate: false,
          });
        }
      }

      return packages;
    } catch {
      return [];
    }
  }

  async install(
    packages: string[],
    cwd: string,
    options?: InstallOptions,
    onProgress?: (progress: OperationProgress) => void
  ): Promise<void> {
    // Validate package names
    validatePackageNames(packages);
    if (options?.registry) {
      validateUrl(options.registry);
    }

    const args = ['add', ...packages];
    if (options?.dev) args.push('--dev');
    if (options?.global) args.push('-g');

    const operationId = randomUUID();
    const progress: OperationProgress = {
      id: operationId,
      type: 'install',
      status: 'running',
      package: packages.join(', '),
      progress: 0,
      message: 'Installing with Bun...',
      logs: [],
      startedAt: Date.now(),
    };

    onProgress?.(progress);

    const subprocess = execa('bun', args, { cwd });

    subprocess.stdout?.on('data', (data: Buffer) => {
      progress.logs.push(data.toString());
      progress.progress = Math.min(progress.progress + 20, 90);
      onProgress?.(progress);
    });

    subprocess.stderr?.on('data', (data: Buffer) => {
      progress.logs.push(data.toString());
      onProgress?.(progress);
    });

    await subprocess;

    progress.status = 'completed';
    progress.progress = 100;
    progress.message = 'Installation complete';
    progress.completedAt = Date.now();
    onProgress?.(progress);
  }

  async uninstall(
    packages: string[],
    cwd: string,
    options?: UninstallOptions,
    onProgress?: (progress: OperationProgress) => void
  ): Promise<void> {
    // Validate package names
    validatePackageNames(packages);

    const args = ['remove', ...packages];
    if (options?.global) args.push('-g');

    const operationId = randomUUID();
    const progress: OperationProgress = {
      id: operationId,
      type: 'uninstall',
      status: 'running',
      package: packages.join(', '),
      progress: 0,
      message: 'Uninstalling with Bun...',
      logs: [],
      startedAt: Date.now(),
    };

    onProgress?.(progress);

    await execa('bun', args, { cwd });

    progress.status = 'completed';
    progress.progress = 100;
    progress.message = 'Uninstallation complete';
    progress.completedAt = Date.now();
    onProgress?.(progress);
  }

  async update(
    packages: string[],
    cwd: string,
    onProgress?: (progress: OperationProgress) => void
  ): Promise<void> {
    // Validate package names if provided
    if (packages.length > 0) {
      validatePackageNames(packages);
    }

    const args = packages.length ? ['update', ...packages] : ['update'];

    const operationId = randomUUID();
    const progress: OperationProgress = {
      id: operationId,
      type: 'update',
      status: 'running',
      package: packages.join(', ') || 'all',
      progress: 0,
      message: 'Updating with Bun...',
      logs: [],
      startedAt: Date.now(),
    };

    onProgress?.(progress);

    await execa('bun', args, { cwd });

    progress.status = 'completed';
    progress.progress = 100;
    progress.message = 'Update complete';
    progress.completedAt = Date.now();
    onProgress?.(progress);
  }

  async getDependencyTree(cwd: string): Promise<DependencyNode> {
    // Bun 目前没有原生的依赖树命令，使用 package.json 解析
    try {
      const { stdout } = await execa('cat', ['package.json'], { cwd });
      const pkg = JSON.parse(stdout);
      const node: DependencyNode = {
        name: pkg.name || 'root',
        version: pkg.version || '0.0.0',
        children: [],
      };

      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const [name, version] of Object.entries(deps)) {
        node.children.push({
          name,
          version: String(version),
          children: [],
        });
      }

      return node;
    } catch {
      return { name: 'root', version: '0.0.0', children: [] };
    }
  }

  async audit(cwd: string): Promise<AuditResult> {
    // Bun 目前没有内置 audit 功能，使用 npm audit 作为后备方案
    try {
      console.warn(`[bun audit] Bun doesn't have native audit, falling back to npm audit in ${cwd}`);

      // 检查是否有 npm 可用
      try {
        await which('npm');
      } catch {
        console.warn('[bun audit] npm not found, cannot perform audit');
        return {
          vulnerabilities: [],
          summary: { critical: 0, high: 0, moderate: 0, low: 0, total: 0 },
        };
      }

      const { stdout, stderr, exitCode } = await execa('npm', ['audit', '--json'], {
        cwd,
        reject: false
      });

      if (stderr) {
        console.warn(`[bun audit] stderr:`, stderr);
      }

      console.warn(`[bun audit] Exit code: ${exitCode}`);

      if (!stdout || stdout.trim().length === 0) {
        console.warn('[bun audit] Empty output from npm audit');
        return {
          vulnerabilities: [],
          summary: { critical: 0, high: 0, moderate: 0, low: 0, total: 0 },
        };
      }

      const data = JSON.parse(stdout);
      const vulnerabilities: VulnerabilityInfo[] = [];

      // npm v7+ 使用 vulnerabilities 对象
      if (data.vulnerabilities && typeof data.vulnerabilities === 'object') {
        for (const [pkgName, vuln] of Object.entries(data.vulnerabilities) as [string, NpmAuditVulnerability][]) {
          if (!vuln.via || vuln.via.length === 0) continue;

          for (const via of vuln.via) {
            if (typeof via === 'object' && via.title) {
              const fixInfo = typeof vuln.fixAvailable === 'object' ? vuln.fixAvailable : null;
              vulnerabilities.push({
                id: String(via.source || via.cve || 'unknown'),
                title: via.title,
                severity: (vuln.severity as 'critical' | 'high' | 'moderate' | 'low') || 'moderate',
                package: pkgName,
                version: vuln.range || '*',
                recommendation: fixInfo
                  ? `Update to ${fixInfo.name}@${fixInfo.version}`
                  : 'Update to latest version',
                url: via.url,
              });
            }
          }
        }
      }

      // npm v6 使用 advisories 对象
      if (data.advisories && typeof data.advisories === 'object') {
        for (const [, advisory] of Object.entries(data.advisories) as [string, NpmAuditAdvisory][]) {
          vulnerabilities.push({
            id: String(advisory.id || 'unknown'),
            title: advisory.title || 'Unknown vulnerability',
            severity: (advisory.severity as 'critical' | 'high' | 'moderate' | 'low') || 'moderate',
            package: advisory.module_name || 'unknown',
            version: advisory.vulnerable_versions || '*',
            recommendation: advisory.recommendation || 'Update to latest version',
            url: advisory.url,
          });
        }
      }

      const summary = {
        critical: data.metadata?.vulnerabilities?.critical || 0,
        high: data.metadata?.vulnerabilities?.high || 0,
        moderate: data.metadata?.vulnerabilities?.moderate || 0,
        low: data.metadata?.vulnerabilities?.low || 0,
        total: data.metadata?.vulnerabilities?.total || vulnerabilities.length,
      };

      console.warn(`[bun audit] Found ${vulnerabilities.length} vulnerabilities:`, summary);
      return { vulnerabilities, summary };
    } catch (error) {
      console.error('[bun audit] Error:', error);
      return {
        vulnerabilities: [],
        summary: { critical: 0, high: 0, moderate: 0, low: 0, total: 0 },
      };
    }
  }

  async auditFix(cwd: string, onProgress?: (progress: OperationProgress) => void): Promise<AuditFixResult> {
    const logs: string[] = [];
    const operationId = randomUUID();
    const progress: OperationProgress = {
      id: operationId,
      type: 'audit',
      status: 'running',
      progress: 0,
      message: 'Fixing vulnerabilities...',
      logs: [],
      startedAt: Date.now(),
    };

    onProgress?.(progress);

    try {
      // Bun doesn't have audit fix, fall back to npm
      try {
        await which('npm');
      } catch {
        console.warn('[bun audit fix] npm not found');
        progress.status = 'failed';
        progress.message = 'npm not found for audit fix';
        onProgress?.(progress);
        return {
          fixed: 0,
          remaining: { vulnerabilities: [], summary: { critical: 0, high: 0, moderate: 0, low: 0, total: 0 } },
          logs: ['npm not available for audit fix'],
        };
      }

      const beforeAudit = await this.audit(cwd);
      const beforeCount = beforeAudit.summary.total;

      progress.progress = 20;
      progress.message = 'Running npm audit fix...';
      onProgress?.(progress);

      const { stdout, stderr } = await execa('npm', ['audit', 'fix'], { cwd, reject: false });
      if (stdout) logs.push(stdout);
      if (stderr) logs.push(stderr);

      progress.progress = 70;
      progress.message = 'Re-scanning...';
      onProgress?.(progress);

      const remaining = await this.audit(cwd);
      const fixed = Math.max(0, beforeCount - remaining.summary.total);

      progress.status = 'completed';
      progress.progress = 100;
      progress.message = `Fixed ${fixed} vulnerabilities`;
      progress.completedAt = Date.now();
      onProgress?.(progress);

      return { fixed, remaining, logs };
    } catch (error) {
      console.error('[bun audit fix] Error:', error);
      progress.status = 'failed';
      progress.message = String(error);
      onProgress?.(progress);
      return {
        fixed: 0,
        remaining: { vulnerabilities: [], summary: { critical: 0, high: 0, moderate: 0, low: 0, total: 0 } },
        logs,
      };
    }
  }

  async setRegistry(url: string): Promise<void> {
    // Validate registry URL
    validateUrl(url);

    // Bun 通过 bunfig.toml 配置 registry
    const { stdout } = await execa('echo', [`registry = "${url}"`]);
    console.warn('Bun registry config:', stdout);
  }

  async getRegistry(): Promise<string> {
    return 'https://registry.npmjs.org/';
  }
}
