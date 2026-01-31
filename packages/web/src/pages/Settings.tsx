import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../stores/app';
import { REGISTRIES } from '@dext7r/npvm-shared';
import { fetchApi, getApiBase, setApiBase } from '../lib/api';
import {
  Check,
  AlertCircle,
  Server,
  Languages,
  FolderOpen,
  Globe,
  Sun,
  Moon,
  Monitor,
  Trash2,
  Info,
  ExternalLink,
  Star,
  GitFork,
  CircleDot,
  Clock,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Card, Button, Badge, Spinner } from '../components/ui';
import { FolderPicker } from '../components/ui/FolderPicker';
import { useToast } from '../components/ui/Toast';
import { clsx } from 'clsx';

const GITHUB_OWNER = 'h7ml';
const GITHUB_REPO = 'npvm';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;
const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;

interface RepoInfo {
  description: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  license: { spdx_id: string } | null;
  owner: { login: string; avatar_url: string };
  updated_at: string;
  topics: string[];
}

interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
}

export function Settings() {
  const { t, i18n } = useTranslation();
  const { addToast } = useToast();
  const {
    projectPath,
    setProjectPath,
    projectPathHistory,
    removeProjectPathFromHistory,
    clearProjectPathHistory,
    currentRegistry,
    setCurrentRegistry,
    themeMode,
    setThemeMode,
    currentPm,
  } = useAppStore();
  const [activeSection, setActiveSection] = useState('connection');
  const [localPath, setLocalPath] = useState(projectPath);
  const [registryStatuses, setRegistryStatuses] = useState<Record<string, boolean>>({});
  const [apiBaseUrl, setApiBaseUrl] = useState(getApiBase());
  const [apiStatus, setApiStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [cacheStatus, setCacheStatus] = useState<'idle' | 'clearing' | 'success' | 'error'>('idle');
  const [cacheSize, setCacheSize] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [repoLoading, setRepoLoading] = useState(true);
  const [repoError, setRepoError] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);

  const navItems: NavItem[] = [
    { key: 'connection', label: t('settings.apiBase'), icon: Server },
    { key: 'theme', label: t('settings.theme'), icon: Sun },
    { key: 'language', label: t('settings.language'), icon: Languages },
    { key: 'project', label: t('settings.projectPath'), icon: FolderOpen },
    { key: 'registry', label: t('settings.registry'), icon: Globe },
    { key: 'cache', label: t('settings.cache'), icon: Trash2 },
    { key: 'about', label: t('settings.about'), icon: Info },
  ];

  useEffect(() => {
    fetchApi<{ name: string; url: string; connected: boolean }[]>('/registry/list').then(
      (res) => {
        if (res.data) {
          const statuses: Record<string, boolean> = {};
          res.data.forEach((r) => { statuses[r.url] = r.connected; });
          setRegistryStatuses(statuses);
        }
      }
    );
  }, []);

  const handleSavePath = async () => {
    setProjectPath(localPath);
    await fetchApi('/project/path', {
      method: 'PUT',
      body: JSON.stringify({ path: localPath }),
    });
  };

  const handleSetRegistry = async (url: string) => {
    setCurrentRegistry(url);
    await fetchApi('/registry/current', {
      method: 'PUT',
      body: JSON.stringify({ url }),
    });
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const handleTestApiBase = async () => {
    setApiStatus('testing');
    try {
      const testUrl = apiBaseUrl.replace(/\/$/, '') + '/pm/detect';
      const response = await fetch(testUrl, { method: 'GET' });
      if (response.ok) {
        setApiStatus('success');
        setApiBase(apiBaseUrl);
        setTimeout(() => window.location.reload(), 500);
      } else {
        setApiStatus('error');
      }
    } catch {
      setApiStatus('error');
    }
  };

  const handleResetApiBase = () => {
    setApiBase('');
    setApiBaseUrl('/api');
    setApiStatus('idle');
    window.location.reload();
  };

  const handleClearCache = async () => {
    setCacheStatus('clearing');
    try {
      const res = await fetchApi('/cache/clear', { method: 'POST' });
      if (res.error) {
        setCacheStatus('error');
        addToast({ type: 'error', title: t('settings.cacheClearFailed') });
      } else {
        setCacheStatus('success');
        setCacheSize(null);
        addToast({ type: 'success', title: t('settings.cacheCleared') });
      }
    } catch {
      setCacheStatus('error');
      addToast({ type: 'error', title: t('settings.cacheClearFailed') });
    }
  };

  useEffect(() => {
    fetchApi<{ size: string }>('/cache/size').then((res) => {
      if (res.data?.size) {
        setCacheSize(res.data.size);
      }
    });
  }, [cacheStatus]);

  useEffect(() => {
    fetch(GITHUB_API)
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data: RepoInfo) => {
        setRepoInfo(data);
        setRepoError(false);
      })
      .catch(() => setRepoError(true))
      .finally(() => setRepoLoading(false));
  }, []);

  const themeOptions = [
    { value: 'light' as const, label: t('settings.themeLight'), icon: Sun },
    { value: 'dark' as const, label: t('settings.themeDark'), icon: Moon },
    { value: 'system' as const, label: t('settings.themeSystem'), icon: Monitor },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'connection':
        return (
          <Card>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
              {t('settings.apiBase')}
            </h3>
            <p className="text-sm text-gray-500 mb-4">{t('settings.apiBaseHint')}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={apiBaseUrl}
                onChange={(e) => { setApiBaseUrl(e.target.value); setApiStatus('idle'); }}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent text-gray-800 dark:text-gray-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                placeholder="https://npvm.zeabur.app/api"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleTestApiBase}
                  loading={apiStatus === 'testing'}
                  leftIcon={apiStatus === 'success' ? <Check size={16} /> : apiStatus === 'error' ? <AlertCircle size={16} /> : undefined}
                >
                  {t('settings.testConnection')}
                </Button>
                {apiBaseUrl !== '/api' && (
                  <Button variant="outline" onClick={handleResetApiBase}>
                    {t('settings.reset')}
                  </Button>
                )}
              </div>
            </div>
            {apiStatus === 'error' && (
              <p className="mt-2 text-sm text-red-500">{t('settings.connectionFailed')}</p>
            )}
            {apiStatus === 'success' && (
              <p className="mt-2 text-sm text-green-500">{t('settings.connectionSuccess')}</p>
            )}
          </Card>
        );

      case 'theme':
        return (
          <Card>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
              {t('settings.theme')}
            </h3>
            <p className="text-sm text-gray-500 mb-4">{t('settings.themeHint')}</p>
            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isActive = themeMode === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setThemeMode(option.value)}
                    className={clsx(
                      'flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-200',
                      isActive
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    )}
                  >
                    <div className={clsx(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      isActive ? 'bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                    )}>
                      <Icon size={20} />
                    </div>
                    <span className={clsx(
                      'text-sm font-medium',
                      isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'
                    )}>
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        );

      case 'language':
        return (
          <Card>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">
              {t('settings.language')}
            </h3>
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              {[
                { code: 'en', label: 'English', flag: '🇺🇸' },
                { code: 'zh', label: '中文', flag: '🇨🇳' },
              ].map((lang) => {
                const isActive = i18n.language === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={clsx(
                      'flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200',
                      isActive
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    )}
                  >
                    <span className="text-2xl">{lang.flag}</span>
                    <span className={clsx(
                      'font-medium',
                      isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'
                    )}>
                      {lang.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        );

      case 'project':
        return (
          <Card>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
              {t('settings.projectPath')}
            </h3>
            <p className="text-sm text-gray-500 mb-4">{t('settings.projectPathHint')}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                placeholder="/path/to/project"
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setFolderPickerOpen(true)}>
                  {t('settings.browse')}
                </Button>
                <Button onClick={handleSavePath}>
                  {t('common.save')}
                </Button>
              </div>
            </div>

            {/* 项目路径历史记录 */}
            {projectPathHistory.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Clock size={16} />
                    {t('common.recentProjects')}
                  </h4>
                  <button
                    onClick={clearProjectPathHistory}
                    className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 size={12} />
                    {t('common.clear')}
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {projectPathHistory.map((item) => (
                    <div
                      key={item.path}
                      className={clsx(
                        'group flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer',
                        projectPath === item.path
                          ? 'border-primary-300 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      )}
                      onClick={() => {
                        setLocalPath(item.path);
                        setProjectPath(item.path);
                      }}
                    >
                      <FolderOpen size={16} className="text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-gray-700 dark:text-gray-200 truncate" title={item.path}>
                          {item.path}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                      </div>
                      {projectPath === item.path && (
                        <Badge variant="success" size="sm">
                          <Check size={10} className="mr-1" />
                          {t('common.active')}
                        </Badge>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeProjectPathFromHistory(item.path);
                        }}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <FolderPicker
              isOpen={folderPickerOpen}
              onClose={() => setFolderPickerOpen(false)}
              onSelect={(path) => setLocalPath(path)}
              initialPath={localPath}
            />
          </Card>
        );

      case 'registry':
        return (
          <Card>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">
              {t('settings.registry')}
            </h3>
            <div className="space-y-3">
              {REGISTRIES.map((reg) => (
                <div
                  key={reg.url}
                  onClick={() => handleSetRegistry(reg.url)}
                  className={clsx(
                    'flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-200',
                    currentRegistry === reg.url
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                  )}
                >
                  <div>
                    <div className="font-medium text-gray-800 dark:text-gray-200">{reg.name}</div>
                    <div className="text-sm text-gray-500 font-mono">{reg.url}</div>
                    <div className="text-xs text-gray-400 mt-1">{reg.description}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      'w-2.5 h-2.5 rounded-full transition-colors',
                      registryStatuses[reg.url] ? 'bg-green-500' : 'bg-gray-400'
                    )} />
                    {currentRegistry === reg.url && (
                      <Badge variant="success">
                        <Check size={10} className="mr-1" />
                        {t('common.active')}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );

      case 'cache':
        return (
          <Card>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
              {t('settings.cache')}
            </h3>
            <p className="text-sm text-gray-500 mb-4">{t('settings.cacheHint')}</p>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <div className="text-sm text-gray-600 dark:text-gray-400">{t('settings.cacheSize')}</div>
                <div className="text-lg font-medium text-gray-800 dark:text-gray-200">
                  {cacheSize ?? t('settings.calculating')}
                </div>
              </div>
              <Badge variant="outline">{currentPm}</Badge>
            </div>
            <Button
              variant="destructive"
              onClick={handleClearCache}
              loading={cacheStatus === 'clearing'}
              leftIcon={<Trash2 size={16} />}
            >
              {cacheStatus === 'clearing' ? t('settings.clearingCache') : t('settings.clearCache')}
            </Button>
          </Card>
        );

      case 'about':
        return (
          <Card>
            {repoLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="lg" />
              </div>
            ) : repoError && !repoInfo ? (
              <p className="text-center text-gray-500 py-8">{t('settings.loadFailed')}</p>
            ) : (
              <>
                <div className="flex items-start gap-4">
                  {repoInfo?.owner.avatar_url ? (
                    <img
                      src={repoInfo.owner.avatar_url}
                      alt={repoInfo.owner.login}
                      className="w-16 h-16 rounded-2xl shadow-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                      N
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">NPVM</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {repoInfo?.description || t('settings.description')}
                    </p>
                    {repoInfo?.topics && repoInfo.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {repoInfo.topics.map((topic) => (
                          <Badge key={topic} variant="outline">{topic}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                    <Star size={18} className="text-yellow-500" />
                    <div>
                      <div className="text-lg font-bold text-gray-800 dark:text-gray-100">
                        {repoInfo?.stargazers_count ?? '-'}
                      </div>
                      <div className="text-xs text-gray-500">{t('settings.stars')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                    <GitFork size={18} className="text-blue-500" />
                    <div>
                      <div className="text-lg font-bold text-gray-800 dark:text-gray-100">
                        {repoInfo?.forks_count ?? '-'}
                      </div>
                      <div className="text-xs text-gray-500">{t('settings.forks')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                    <CircleDot size={18} className="text-green-500" />
                    <div>
                      <div className="text-lg font-bold text-gray-800 dark:text-gray-100">
                        {repoInfo?.open_issues_count ?? '-'}
                      </div>
                      <div className="text-xs text-gray-500">{t('settings.openIssues')}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">{t('settings.license')}</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium">
                      {repoInfo?.license?.spdx_id || 'MIT'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">{t('settings.author')}</span>
                    <a
                      href={`https://github.com/${repoInfo?.owner.login || GITHUB_OWNER}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
                    >
                      @{repoInfo?.owner.login || GITHUB_OWNER}
                    </a>
                  </div>
                  {repoInfo?.updated_at && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-400">{t('settings.lastUpdate')}</span>
                      <span className="text-gray-800 dark:text-gray-200 font-medium">
                        {new Date(repoInfo.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-600 dark:text-gray-400">{t('settings.repository')}</span>
                    <a
                      href={GITHUB_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                    >
                      {t('settings.viewOnGitHub')}
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              </>
            )}
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
        {t('settings.title')}
      </h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* 侧边导航 */}
        <nav className="lg:w-56 shrink-0">
          {/* 移动端：横向滚动 */}
          <div className="flex lg:hidden gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveSection(item.key)}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* 桌面端：垂直列表 */}
          <div className="hidden lg:flex flex-col gap-1 bg-white dark:bg-gray-800/50 rounded-xl p-2 border border-gray-200 dark:border-gray-700">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveSection(item.key)}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left w-full',
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                  )}
                >
                  <Icon size={18} className={isActive ? 'text-primary-500' : ''} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* 内容区 */}
        <div className="flex-1 min-w-0">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
