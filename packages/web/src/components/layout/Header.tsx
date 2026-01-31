import { Moon, Sun, FolderOpen, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/app';
import { usePackageManagers } from '../../hooks/usePackages';
import type { PackageManagerType } from '@dext7r/npvm-shared';

export function Header() {
  const { t, i18n } = useTranslation();
  const { isDarkMode, toggleDarkMode, currentPm, setCurrentPm, projectPath } = useAppStore();
  const { data: managers = [] } = usePackageManagers();

  const availableManagers = managers.filter((m) => m.available);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
  };

  return (
    <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <FolderOpen size={18} />
          <span className="text-sm font-mono truncate max-w-xs">{projectPath}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={currentPm}
          onChange={(e) => setCurrentPm(e.target.value as PackageManagerType)}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          {availableManagers.map((m) => (
            <option key={m.type} value={m.type}>
              {m.type} (v{m.version})
            </option>
          ))}
        </select>

        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
          title={t('settings.language')}
        >
          <Languages size={16} />
          <span>{i18n.language === 'zh' ? '中文' : 'EN'}</span>
        </button>

        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </header>
  );
}
