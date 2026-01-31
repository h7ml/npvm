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
  NpmAuditVulnerability,
  NpmAuditAdvisory,
} from '@dext7r/npvm-shared';
import type { PackageManagerAdapter, InstallOptions, UninstallOptions, WorkspaceInfo } from './base.js';
import { validatePackageNames, validateUrl } from '../utils/security.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export class NpmAdapter implements PackageManagerAdapter {
  readonly type = 'npm' as const;

  async detect(): Promise<PackageManagerInfo> {
    try {
      const path = await which('npm');
      const { stdout } = await execa('npm', ['--version'], { timeout: 5000 });
      return {
        type: 'npm',
        version: stdout.trim(),
        path,
        available: true,
      };
    } catch {
      return { type: 'npm', version: '', path: '', available: false };
    }
  }

  async detectWorkspace(cwd: string): Promise<WorkspaceInfo> {
    try {
      const pkgPath = join(cwd, 'package.json');
      if (!existsSync(pkgPath)) {
        return { isWorkspace: false };
      }

      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (!pkg.workspaces) {
        return { isWorkspace: false };
      }

      // npm workspaces 在 package.json 中定义
      const { stdout } = await execa('npm', ['query', '.workspace'], { cwd, reject: false });
      const workspaces = JSON.parse(stdout || '[]');
      const packages = workspaces.map((w: { name?: string }) => w.name).filter(Boolean);

      return { isWorkspace: true, packages };
    } catch {
      return { isWorkspace: false };
    }
  }

  async getInstalledPackages(cwd: string): Promise<InstalledPackage[]> {
    try {
      const { stdout } = await execa('npm', ['ls', '--json', '--depth=0'], { cwd });
      const data = JSON.parse(stdout);
      const packages: InstalledPackage[] = [];

      const deps = data.dependencies || {};
      for (const [name, info] of Object.entries(deps) as [string, { version?: string }][]) {
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

  async getGlobalPackages(): Promise<InstalledPackage[]> {
    try {
      const { stdout } = await execa('npm', ['ls', '-g', '--json', '--depth=0']);
      const data = JSON.parse(stdout);
      const packages: InstalledPackage[] = [];

      const deps = data.dependencies || {};
      for (const [name, info] of Object.entries(deps) as [string, { version?: string }][]) {
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
    // 安全验证：检查包名
    validatePackageNames(packages);
    if (options?.registry) {
      validateUrl(options.registry);
    }

    const args = ['install', ...packages];
    if (options?.dev) args.push('--save-dev');
    if (options?.global) args.push('-g');
    if (options?.workspace) args.push('-w');  // npm v7+ workspace root
    if (options?.filter) args.push('-w', options.filter);  // 安装到指定 workspace
    if (options?.registry) args.push('--registry', options.registry);

    const operationId = randomUUID();
    const progress: OperationProgress = {
      id: operationId,
      type: 'install',
      status: 'running',
      package: packages.join(', '),
      progress: 0,
      message: 'Installing...',
      logs: [],
      startedAt: Date.now(),
    };

    onProgress?.(progress);

    const subprocess = execa('npm', args, { cwd });

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
    // 安全验证：检查包名
    validatePackageNames(packages);

    const args = ['uninstall', ...packages];
    if (options?.global) args.push('-g');
    if (options?.workspace) args.push('-w');
    if (options?.filter) args.push('-w', options.filter);

    const operationId = randomUUID();
    const progress: OperationProgress = {
      id: operationId,
      type: 'uninstall',
      status: 'running',
      package: packages.join(', '),
      progress: 0,
      message: 'Uninstalling...',
      logs: [],
      startedAt: Date.now(),
    };

    onProgress?.(progress);

    await execa('npm', args, { cwd });

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
    // 安全验证：检查包名（如果指定了包）
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
      message: 'Updating...',
      logs: [],
      startedAt: Date.now(),
    };

    onProgress?.(progress);

    await execa('npm', args, { cwd });

    progress.status = 'completed';
    progress.progress = 100;
    progress.message = 'Update complete';
    progress.completedAt = Date.now();
    onProgress?.(progress);
  }

  async getDependencyTree(cwd: string): Promise<DependencyNode> {
    try {
      const { stdout } = await execa('npm', ['ls', '--json', '--all'], { cwd });
      const data = JSON.parse(stdout);
      return this.parseDepTree(data.name || 'root', data.version || '0.0.0', data.dependencies);
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
      console.warn(`[npm audit] Running: npm audit --json in ${cwd}`);
      const { stdout, stderr, exitCode } = await execa('npm', ['audit', '--json'], {
        cwd,
        reject: false
      });

      if (stderr) {
        console.warn(`[npm audit] stderr:`, stderr);
      }

      console.warn(`[npm audit] Exit code: ${exitCode}`);
      console.warn(`[npm audit] Raw output length: ${stdout.length} bytes`);

      if (!stdout || stdout.trim().length === 0) {
        console.warn('[npm audit] Empty output from npm audit');
        return {
          vulnerabilities: [],
          summary: { critical: 0, high: 0, moderate: 0, low: 0, total: 0 },
        };
      }

      const data = JSON.parse(stdout);
      console.warn(`[npm audit] Parsed data keys:`, Object.keys(data));

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

      console.warn(`[npm audit] Found ${vulnerabilities.length} vulnerabilities:`, summary);
      return { vulnerabilities, summary };
    } catch (error) {
      console.error('[npm audit] Error:', error);
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
      console.error('[npm audit fix] Error:', error);
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
    // 安全验证：检查 URL 格式
    validateUrl(url);
    await execa('npm', ['config', 'set', 'registry', url]);
  }

  async getRegistry(): Promise<string> {
    const { stdout } = await execa('npm', ['config', 'get', 'registry']);
    return stdout.trim();
  }
}
