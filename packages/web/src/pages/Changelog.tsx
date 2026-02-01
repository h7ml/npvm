import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Tag, Calendar, Sparkles, Bug, Wrench, AlertTriangle } from 'lucide-react';
import { Card, Badge } from '../components/ui';
import { clsx } from 'clsx';
import changelogData from '../data/changelog.json';

type ChangeType = 'feature' | 'fix' | 'improvement' | 'breaking';

interface ChangeItem {
  type: ChangeType;
  text: string;
}

interface VersionEntry {
  version: string;
  date: string;
  changes: ChangeItem[];
}

const changeTypeConfig: Record<ChangeType, { icon: typeof Sparkles; color: string }> = {
  feature: { icon: Sparkles, color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
  fix: { icon: Bug, color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
  improvement: { icon: Wrench, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
  breaking: { icon: AlertTriangle, color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30' },
};

export function Changelog() {
  const { t, i18n } = useTranslation();

  const entries: VersionEntry[] = useMemo(() => {
    const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
    return (changelogData as Record<string, VersionEntry[]>)[lang] || changelogData.en;
  }, [i18n.language]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
          <History size={24} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          {t('changelog.title')}
        </h1>
      </div>

      <div className="relative">
        <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

        <div className="space-y-6">
          {entries.map((entry, idx) => (
            <div key={entry.version} className="relative pl-12">
              <div
                className={clsx(
                  'absolute left-0 w-10 h-10 rounded-full flex items-center justify-center',
                  idx === 0
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                )}
              >
                <Tag size={18} />
              </div>

              <Card>
                <div className="flex items-center gap-3 mb-4">
                  <Badge variant={idx === 0 ? 'success' : 'default'} size="sm">
                    v{entry.version}
                  </Badge>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Calendar size={14} />
                    {entry.date}
                  </div>
                  {idx === 0 && (
                    <Badge variant="info" size="sm">
                      {t('changelog.latest')}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  {entry.changes.map((change, i) => {
                    const config = changeTypeConfig[change.type];
                    const Icon = config.icon;
                    return (
                      <div key={i} className="flex items-start gap-3 py-1.5">
                        <span
                          className={clsx(
                            'inline-flex items-center justify-center w-6 h-6 rounded',
                            config.color
                          )}
                        >
                          <Icon size={14} />
                        </span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {change.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
