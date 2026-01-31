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
  DependencyInfo,
  NpmAuditAdvisory,
} from '@dext7r/npvm-shared';
import type { PackageManagerAdapter, InstallOptions, UninstallOptions } from './base.js';
import { validatePackageNames, validateUrl } from '../utils/security.js';

export class PnpmAdapter implements PackageManagerAdapter {
  readonly type = 'pnpm' as const;

  async detect(): Promise<PackageManagerInfo> {
    try {
      const path = await which('pnpm');
      const { stdout } = await execa('pnpm', ['--version']);
      return {
        type: 'pnpm',
        version: stdout.trim(),
        path,
        available: true,
      };
    } catch {
      return { type: 'pnpm', version: '', path: '', available: false };
    }
  }

  async getInstalledPackages(cwd: string): Promise<InstalledPackage[]> {
    try {
      const { stdout } = await execa('pnpm', ['ls', '--json', '--depth=0'], { cwd });
      const data = JSON.parse(stdout);
      const packages: InstalledPackage[] = [];

      const list = Array.isArray(data) ? data[0] : data;
      const deps = list?.dependencies || {};
      const devDeps = list?.devDependencies || {};

      for (const [name, info] of Object.entries(deps) as [string, DependencyInfo][]) {
        packages.push({
          name,
          version: info.version || 'unknown',
          isDev: false,
          isPeer: false,
          hasUpdate: false,
        });
      }

      for (const [name, info] of Object.entries(devDeps) as [string, DependencyInfo][]) {
        packages.push({
          name,
          version: info.version || 'unknown',
          isDev: true,
          isPeer: false,
          hasUpdate: false,
        });
      }

      return packages;
    } catch {
      return [];
    }
  }

  async getGlobalPackages(): Promise<InstalledPackage[]> {
    try {
      const { stdout } = await execa('pnpm', ['ls', '-g', '--json', '--depth=0']);
      const data = JSON.parse(stdout);
      const packages: InstalledPackage[] = [];

      const list = Array.isArray(data) ? data[0] : data;
      const deps = list?.dependencies || {};

      for (const [name, info] of Object.entries(deps) as [string, DependencyInfo][]) {
        packages.push({
          name,
          version: info.version || 'unknown',
          isDev: false,
          isPeer: false,
          hasUpdate: false,
        });
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
    // 安全验证
    validatePackageNames(packages);
    if (options?.registry) {
      validateUrl(options.registry);
    }

    const args = ['add', ...packages];
    if (options?.dev) args.push('--save-dev');
    if (options?.global) args.push('-g');
    if (options?.registry) args.push('--registry', options.registry);

    const operationId = randomUUID();
    const progress: OperationProgress = {
      id: operationId,
      type: 'install',
      status: 'running',
      package: packages.join(', '),
      progress: 0,
      message: 'Installing with pnpm...',
      logs: [],
      startedAt: Date.now(),
    };

    onProgress?.(progress);

    const subprocess = execa('pnpm', args, { cwd });

    subprocess.stdout?.on('data', (data: Buffer) => {
      progress.logs.push(data.toString());
      progress.progress = Math.min(progress.progress + 10, 90);
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
    // 安全验证
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
      message: 'Uninstalling with pnpm...',
      logs: [],
      startedAt: Date.now(),
    };

    onProgress?.(progress);

    await execa('pnpm', args, { cwd });

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
    // 安全验证
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
      message: 'Updating with pnpm...',
      logs: [],
      startedAt: Date.now(),
    };

    onProgress?.(progress);

    await execa('pnpm', args, { cwd });

    progress.status = 'completed';
    progress.progress = 100;
    progress.message = 'Update complete';
    progress.completedAt = Date.now();
    onProgress?.(progress);
  }

  async getDependencyTree(cwd: string): Promise<DependencyNode> {
    try {
      const { stdout } = await execa('pnpm', ['ls', '--json', '--depth=Infinity'], { cwd });
      const data = JSON.parse(stdout);
      const list = Array.isArray(data) ? data[0] : data;
      return this.parseDepTree(list.name || 'root', list.version || '0.0.0', list.dependencies);
    } catch {
      return { name: 'root', version: '0.0.0', children: [] };
    }
  }

  private parseDepTree(
    name: string,
    version: string,
    deps?: Record<string, DependencyInfo>
  ): DependencyNode {
    const node: DependencyNode = { name, version, children: [] };
    if (deps) {
      for (const [depName, depInfo] of Object.entries(deps)) {
        node.children.push(
          this.parseDepTree(depName, depInfo.version || 'unknown', depInfo.dependencies)
        );
      }
    }
    return node;
  }

  async audit(cwd: string): Promise<AuditResult> {
    try {
      console.warn(`[pnpm audit] Running: pnpm audit --json in ${cwd}`);
      const { stdout, stderr, exitCode } = await execa('pnpm', ['audit', '--json'], {
        cwd,
        reject: false
      });

      if (stderr) {
        console.warn(`[pnpm audit] stderr:`, stderr);
      }

      console.warn(`[pnpm audit] Exit code: ${exitCode}`);
      console.warn(`[pnpm audit] Raw output length: ${stdout.length} bytes`);

      if (!stdout || stdout.trim().length === 0) {
        console.warn('[pnpm audit] Empty output from pnpm audit');
        return {
          vulnerabilities: [],
          summary: { critical: 0, high: 0, moderate: 0, low: 0, total: 0 },
        };
      }

      const data = JSON.parse(stdout);
      console.warn(`[pnpm audit] Parsed data keys:`, Object.keys(data));

      const vulnerabilities: VulnerabilityInfo[] = [];

      // pnpm 使用 advisories 对象
      const advisories = data.advisories || {};
      for (const [, adv] of Object.entries(advisories) as [string, NpmAuditAdvisory][]) {
        vulnerabilities.push({
          id: String(adv.id || 'unknown'),
          title: adv.title || 'Unknown vulnerability',
          severity: (adv.severity as 'critical' | 'high' | 'moderate' | 'low') || 'moderate',
          package: adv.module_name || 'unknown',
          version: adv.vulnerable_versions || '*',
          recommendation: adv.recommendation || 'Update to latest version',
          url: adv.url,
        });
      }

      const meta = data.metadata?.vulnerabilities || {};
      const summary = {
        critical: meta.critical || 0,
        high: meta.high || 0,
        moderate: meta.moderate || 0,
        low: meta.low || 0,
        total: meta.total || vulnerabilities.length,
      };

      console.warn(`[pnpm audit] Found ${vulnerabilities.length} vulnerabilities:`, summary);
      return { vulnerabilities, summary };
    } catch (error) {
      console.error('[pnpm audit] Error:', error);
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
      const beforeAudit = await this.audit(cwd);
      const beforeCount = beforeAudit.summary.total;

      progress.progress = 20;
      progress.message = 'Running pnpm audit --fix...';
      onProgress?.(progress);

      const { stdout, stderr } = await execa('pnpm', ['audit', '--fix'], { cwd, reject: false });
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
      console.error('[pnpm audit fix] Error:', error);
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
    // 安全验证
    validateUrl(url);
    await execa('pnpm', ['config', 'set', 'registry', url]);
  }

  async getRegistry(): Promise<string> {
    const { stdout } = await execa('pnpm', ['config', 'get', 'registry']);
    return stdout.trim();
  }
}
