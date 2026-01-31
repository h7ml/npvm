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
  YarnTreeChild,
  YarnTreeData,
  YarnAuditAdvisory,
} from '@dext7r/npvm-shared';
import type { PackageManagerAdapter, InstallOptions, UninstallOptions, WorkspaceInfo } from './base.js';
import { validatePackageNames, validateUrl } from '../utils/security.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export class YarnAdapter implements PackageManagerAdapter {
  readonly type = 'yarn' as const;

  async detect(): Promise<PackageManagerInfo> {
    try {
      const path = await which('yarn');
      const { stdout } = await execa('yarn', ['--version'], { timeout: 5000 });
      return {
        type: 'yarn',
        version: stdout.trim(),
        path,
        available: true,
      };
    } catch {
      return { type: 'yarn', version: '', path: '', available: false };
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

      // yarn workspaces info
      const { stdout } = await execa('yarn', ['workspaces', 'info', '--json'], { cwd, reject: false });
      const data = JSON.parse(stdout || '{}');
      const packages = Object.keys(data);

      return { isWorkspace: true, packages };
    } catch {
      return { isWorkspace: false };
    }
  }

  async getInstalledPackages(cwd: string): Promise<InstalledPackage[]> {
    try {
      const { stdout } = await execa('yarn', ['list', '--json', '--depth=0'], { cwd });
      const lines = stdout.trim().split('\n');
      const packages: InstalledPackage[] = [];

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.type === 'tree' && data.data?.trees) {
            for (const tree of data.data.trees) {
              const match = tree.name?.match(/^(.+)@(.+)$/);
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
          }
        } catch { /* ignore parse errors */ }
      }

      return packages;
    } catch {
      return [];
    }
  }

  async getGlobalPackages(): Promise<InstalledPackage[]> {
    try {
      const { stdout } = await execa('yarn', ['global', 'list', '--json', '--depth=0']);
      const lines = stdout.trim().split('\n');
      const packages: InstalledPackage[] = [];

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.type === 'tree' && data.data?.trees) {
            for (const tree of data.data.trees) {
              const match = tree.name?.match(/^(.+)@(.+)$/);
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
          }
        } catch { /* ignore parse errors */ }
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

    const args = options?.global ? ['global', 'add', ...packages] : ['add', ...packages];
    if (options?.dev) args.push('--dev');
    if (options?.workspace) args.push('-W');  // yarn workspace root
    if (options?.filter) args.unshift('workspace', options.filter);  // yarn workspace <name> add
    if (options?.registry) args.push('--registry', options.registry);

    const operationId = randomUUID();
    const progress: OperationProgress = {
      id: operationId,
      type: 'install',
      status: 'running',
      package: packages.join(', '),
      progress: 0,
      message: 'Installing with Yarn...',
      logs: [],
      startedAt: Date.now(),
    };

    onProgress?.(progress);

    const subprocess = execa('yarn', args, { cwd });

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

    let args = options?.global ? ['global', 'remove', ...packages] : ['remove', ...packages];
    if (options?.workspace) args.push('-W');
    if (options?.filter) args = ['workspace', options.filter, 'remove', ...packages];

    const operationId = randomUUID();
    const progress: OperationProgress = {
      id: operationId,
      type: 'uninstall',
      status: 'running',
      package: packages.join(', '),
      progress: 0,
      message: 'Uninstalling with Yarn...',
      logs: [],
      startedAt: Date.now(),
    };

    onProgress?.(progress);

    await execa('yarn', args, { cwd });

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

    const args = packages.length ? ['upgrade', ...packages] : ['upgrade'];

    const operationId = randomUUID();
    const progress: OperationProgress = {
      id: operationId,
      type: 'update',
      status: 'running',
      package: packages.join(', ') || 'all',
      progress: 0,
      message: 'Updating with Yarn...',
      logs: [],
      startedAt: Date.now(),
    };

    onProgress?.(progress);

    await execa('yarn', args, { cwd });

    progress.status = 'completed';
    progress.progress = 100;
    progress.message = 'Update complete';
    progress.completedAt = Date.now();
    onProgress?.(progress);
  }

  async getDependencyTree(cwd: string): Promise<DependencyNode> {
    try {
      const { stdout } = await execa('yarn', ['list', '--json'], { cwd });
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.type === 'tree') {
            return this.parseYarnTree(data.data);
          }
        } catch { /* ignore parse errors */ }
      }

      return { name: 'root', version: '0.0.0', children: [] };
    } catch {
      return { name: 'root', version: '0.0.0', children: [] };
    }
  }

  private parseYarnTree(data: YarnTreeData): DependencyNode {
    const node: DependencyNode = {
      name: 'root',
      version: '0.0.0',
      children: [],
    };

    if (data?.trees) {
      for (const tree of data.trees) {
        const match = tree.name?.match(/^(.+)@(.+)$/);
        if (match) {
          const child: DependencyNode = {
            name: match[1],
            version: match[2],
            children: [],
          };
          if (tree.children) {
            child.children = tree.children.map((c: YarnTreeChild) => {
              const m = c.name?.match(/^(.+)@(.+)$/);
              return {
                name: m?.[1] || c.name || 'unknown',
                version: m?.[2] || 'unknown',
                children: [],
              };
            });
          }
          node.children.push(child);
        }
      }
    }

    return node;
  }

  async audit(cwd: string): Promise<AuditResult> {
    try {
      console.warn(`[yarn audit] Running: yarn audit --json in ${cwd}`);
      const { stdout, stderr, exitCode } = await execa('yarn', ['audit', '--json'], {
        cwd,
        reject: false
      });

      if (stderr) {
        console.warn(`[yarn audit] stderr:`, stderr);
      }

      console.warn(`[yarn audit] Exit code: ${exitCode}`);
      console.warn(`[yarn audit] Raw output length: ${stdout.length} bytes`);

      if (!stdout || stdout.trim().length === 0) {
        console.warn('[yarn audit] Empty output from yarn audit');
        return {
          vulnerabilities: [],
          summary: { critical: 0, high: 0, moderate: 0, low: 0, total: 0 },
        };
      }

      const lines = stdout.trim().split('\n');
      const vulnerabilities: VulnerabilityInfo[] = [];
      let summary = { critical: 0, high: 0, moderate: 0, low: 0, total: 0 };

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          console.warn(`[yarn audit] Line type: ${data.type}`);

          if (data.type === 'auditAdvisory') {
            const adv = data.data.advisory as YarnAuditAdvisory;
            vulnerabilities.push({
              id: String(adv.id || 'unknown'),
              title: adv.title || 'Unknown vulnerability',
              severity: (adv.severity as 'critical' | 'high' | 'moderate' | 'low') || 'moderate',
              package: adv.module_name || 'unknown',
              version: adv.vulnerable_versions || '*',
              recommendation: adv.recommendation || 'Update to latest version',
              url: adv.url,
            });
          } else if (data.type === 'auditSummary') {
            const vulns = data.data.vulnerabilities || {};
            summary = {
              critical: vulns.critical || 0,
              high: vulns.high || 0,
              moderate: vulns.moderate || 0,
              low: vulns.low || 0,
              total: vulns.total || 0,
            };
          }
        } catch {
          console.warn('[yarn audit] Failed to parse line:', line.substring(0, 100));
        }
      }

      console.warn(`[yarn audit] Found ${vulnerabilities.length} vulnerabilities:`, summary);
      return { vulnerabilities, summary };
    } catch (error) {
      console.error('[yarn audit] Error:', error);
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
      progress.message = 'Running yarn upgrade...';
      onProgress?.(progress);

      // Yarn v1 doesn't have audit fix, use upgrade instead
      const { stdout, stderr } = await execa('yarn', ['upgrade'], { cwd, reject: false });
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
      console.error('[yarn audit fix] Error:', error);
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
    await execa('yarn', ['config', 'set', 'registry', url]);
  }

  async getRegistry(): Promise<string> {
    const { stdout } = await execa('yarn', ['config', 'get', 'registry']);
    return stdout.trim();
  }
}
