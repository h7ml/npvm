import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Globe,
  Search,
  Package,
  GitBranch,
  Shield,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { useRemoteAnalysis } from '../hooks/usePackages';
import { useToast } from '../components/ui/Toast';
import type {
  RemoteAnalysisResult,
  RemotePackageInfo,
  RemoteUpdateInfo,
  DependencyNode,
  VulnerabilityInfo,
} from '@dext7r/npvm-shared';
import { clsx } from 'clsx';

type VulnerabilitySeverity = 'critical' | 'high' | 'moderate' | 'low';

const severityConfig: Record<VulnerabilitySeverity, { icon: typeof AlertCircle; color: string; bg: string }> = {
  critical: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
  high: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  moderate: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  low: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
};

function TreeNode({ node, level = 0 }: { node: DependencyNode; level?: number }) {
  const [isExpanded, setIsExpanded] = useState(level < 1);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown size={14} className="text-gray-400" />
          ) : (
            <ChevronRight size={14} className="text-gray-400" />
          )
        ) : (
          <span className="w-3.5" />
        )}
        <Package size={12} className="text-primary-500" />
        <span className="text-sm text-gray-800 dark:text-gray-200">{node.name}</span>
        <span className="text-xs text-gray-500">@{node.version}</span>
      </div>
      {isExpanded && hasChildren && node.children.slice(0, 20).map((child: DependencyNode, i: number) => (
        <TreeNode key={`${child.name}-${i}`} node={child} level={level + 1} />
      ))}
      {isExpanded && hasChildren && node.children.length > 20 && (
        <div className="text-xs text-gray-400 py-1" style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}>
          ... and {node.children.length - 20} more
        </div>
      )}
    </div>
  );
}

function VulnerabilityCard({ vuln }: { vuln: VulnerabilityInfo }) {
  const config = severityConfig[vuln.severity];
  const Icon = config.icon;

  return (
    <div className={clsx('p-3 rounded-lg border-l-4', config.bg, 'border-l-current')}>
      <div className="flex items-start gap-2">
        <Icon size={16} className={config.color} />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">
            {vuln.title}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            <span className="font-mono">{vuln.package}</span> ({vuln.version})
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{vuln.recommendation}</div>
          {vuln.url && (
            <a
              href={vuln.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary-500 hover:underline mt-1 inline-flex items-center gap-1"
            >
              More <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

const QUICK_PACKAGES = ['lodash', 'react', 'vue', 'express', 'axios', 'next'];

export function RemoteAnalysis() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [result, setResult] = useState<RemoteAnalysisResult | null>(null);
  const [copiedPm, setCopiedPm] = useState<string | null>(null);
  const analysisMutation = useRemoteAnalysis();

  const isNpmSource = result?.sourceType === 'npm';

  const handleAnalyze = async (input?: string) => {
    const target = input || repoUrl;
    if (!target.trim()) return;
    if (input) setRepoUrl(input);
    try {
      const data = await analysisMutation.mutateAsync({
        repoUrl: target.trim(),
        branch: branch.trim() || undefined,
      });
      setResult(data);
    } catch {
      setResult(null);
    }
  };

  const updatesWithChanges = result?.updates.filter((u: RemoteUpdateInfo) => u.hasUpdate) || [];

  const generateUpdateCommand = (pm: 'npm' | 'yarn' | 'pnpm') => {
    if (updatesWithChanges.length === 0) return '';
    const packages = updatesWithChanges.map((u: RemoteUpdateInfo) => `${u.name}@${u.latestVersion}`).join(' ');
    switch (pm) {
      case 'npm': return `npm install ${packages}`;
      case 'yarn': return `yarn add ${packages}`;
      case 'pnpm': return `pnpm add ${packages}`;
    }
  };

  const handleCopyCommand = async (pm: 'npm' | 'yarn' | 'pnpm') => {
    const cmd = generateUpdateCommand(pm);
    if (!cmd) return;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedPm(pm);
      setTimeout(() => setCopiedPm(null), 2000);
      addToast({
        type: 'success',
        title: t('remote.copySuccess'),
        message: `${pm} ${t('remote.commandCopied')}`,
        duration: 2000,
      });
    } catch {
      addToast({
        type: 'error',
        title: t('remote.copyFailed'),
        duration: 3000,
      });
    }
  };

  const vulnSummary = result?.vulnerabilities.reduce(
    (acc: { critical: number; high: number; moderate: number; low: number; total: number }, v: VulnerabilityInfo) => {
      acc[v.severity]++;
      acc.total++;
      return acc;
    },
    { critical: 0, high: 0, moderate: 0, low: 0, total: 0 }
  );

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
        {t('remote.title')}
      </h2>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                placeholder={t('remote.urlPlaceholder')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          {!isNpmSource && (
            <div className="w-full sm:w-32">
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder={t('remote.branchPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          )}
          <button
            onClick={() => handleAnalyze()}
            disabled={analysisMutation.isPending || !repoUrl.trim()}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analysisMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('remote.analyzing')}
              </>
            ) : (
              <>
                <Search size={18} />
                {t('remote.analyze')}
              </>
            )}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {QUICK_PACKAGES.map((pkg) => (
            <button
              key={pkg}
              onClick={() => handleAnalyze(pkg)}
              disabled={analysisMutation.isPending}
              className="px-3 py-1 text-xs rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-primary-50 hover:text-primary-600 hover:border-primary-300 dark:hover:bg-primary-900/20 dark:hover:text-primary-400 dark:hover:border-primary-700 transition-colors disabled:opacity-50"
            >
              {pkg}
            </button>
          ))}
        </div>

        {analysisMutation.isError && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {analysisMutation.error?.message || t('remote.error')}
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-4">
          {/* npm 包元信息 */}
          {isNpmSource && result.packageMeta && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Package size={18} className="text-primary-500" />
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                  {result.packageMeta.name}
                  <span className="ml-2 text-sm font-normal text-gray-500">v{result.packageMeta.version}</span>
                </h3>
              </div>
              {result.packageMeta.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{result.packageMeta.description}</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                {result.packageMeta.author && (
                  <span>{t('remote.npmAuthor')}: {result.packageMeta.author}</span>
                )}
                {result.packageMeta.license && (
                  <span>{t('remote.npmLicense')}: {result.packageMeta.license}</span>
                )}
                {result.packageMeta.homepage && (
                  <a
                    href={result.packageMeta.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-500 hover:underline inline-flex items-center gap-1"
                  >
                    Homepage <ExternalLink size={10} />
                  </a>
                )}
              </div>
              {result.packageMeta.keywords && result.packageMeta.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {result.packageMeta.keywords.slice(0, 10).map((kw) => (
                    <span key={kw} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 包列表 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package size={18} className="text-primary-500" />
              <h3 className="font-medium text-gray-800 dark:text-gray-100">
                {t('remote.packages')} ({result.packages.length})
              </h3>
              {!isNpmSource && result.lockFileType && (
                <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                  {result.lockFileType}
                </span>
              )}
            </div>
            <div className="max-h-[300px] overflow-y-auto scrollbar-thin space-y-1">
              {result.packages.map((pkg: RemotePackageInfo) => (
                <div
                  key={pkg.name}
                  className="flex items-center justify-between py-1.5 px-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                      {pkg.name}
                    </span>
                    {pkg.isDev && (
                      <span className="text-xs px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
                        dev
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 font-mono">{pkg.version}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 依赖树 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch size={18} className="text-primary-500" />
              <h3 className="font-medium text-gray-800 dark:text-gray-100">
                {t('remote.dependencyTree')}
              </h3>
            </div>
            <div className="max-h-[300px] overflow-y-auto scrollbar-thin">
              {result.dependencyTree ? (
                <TreeNode node={result.dependencyTree} />
              ) : (
                <div className="text-sm text-gray-500 text-center py-4">
                  {t('remote.noLockFile')}
                </div>
              )}
            </div>
          </div>

          {/* 安全漏洞 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={18} className="text-primary-500" />
              <h3 className="font-medium text-gray-800 dark:text-gray-100">
                {t('remote.vulnerabilities')}
              </h3>
            </div>
            {vulnSummary && vulnSummary.total > 0 ? (
              <>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {(['critical', 'high', 'moderate', 'low'] as const).map((severity) => {
                    const config = severityConfig[severity];
                    const count = vulnSummary[severity];
                    return (
                      <div
                        key={severity}
                        className={clsx(
                          'p-2 rounded text-center',
                          count > 0 ? config.bg : 'bg-gray-50 dark:bg-gray-700'
                        )}
                      >
                        <div className={clsx('text-lg font-bold', count > 0 ? config.color : 'text-gray-400')}>
                          {count}
                        </div>
                        <div className="text-xs text-gray-500">{t(`security.${severity}`)}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="max-h-[200px] overflow-y-auto scrollbar-thin space-y-2">
                  {result.vulnerabilities.map((vuln: VulnerabilityInfo) => (
                    <VulnerabilityCard key={vuln.id} vuln={vuln} />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <Shield size={32} className="mx-auto text-green-500 mb-2" />
                <div className="text-sm text-green-600 dark:text-green-400">
                  {t('security.noVulnerabilities')}
                </div>
              </div>
            )}
          </div>

          {/* 可更新 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw size={18} className="text-primary-500" />
              <h3 className="font-medium text-gray-800 dark:text-gray-100">
                {t('remote.updates')} ({updatesWithChanges.length})
              </h3>
            </div>
            {updatesWithChanges.length > 0 ? (
              <>
                <div className="max-h-[200px] overflow-y-auto scrollbar-thin space-y-1 mb-3">
                  {updatesWithChanges.map((update: RemoteUpdateInfo) => (
                    <div
                      key={update.name}
                      className="flex items-center justify-between py-1.5 px-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                    >
                      <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                        {update.name}
                      </span>
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-gray-500">{update.currentVersion}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-green-600 dark:text-green-400">{update.latestVersion}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <div className="text-xs text-gray-500 mb-2">{t('remote.copyCommand')}</div>
                  <div className="flex flex-wrap gap-2">
                    {(['npm', 'yarn', 'pnpm'] as const).map((pm) => (
                      <button
                        key={pm}
                        onClick={() => handleCopyCommand(pm)}
                        className={clsx(
                          'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors',
                          copiedPm === pm
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-600 dark:text-green-400'
                            : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                        )}
                      >
                        {copiedPm === pm ? <Check size={12} /> : <Copy size={12} />}
                        {pm}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-6 text-sm text-gray-500">
                {t('remote.noUpdates')}
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {!result && !analysisMutation.isPending && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center border border-gray-200 dark:border-gray-700">
          <Globe size={48} className="mx-auto text-gray-400 mb-4" />
          <div className="text-gray-600 dark:text-gray-400">
            {t('remote.hint')}
          </div>
        </div>
      )}
    </div>
  );
}
