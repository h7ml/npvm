import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Package,
  GitBranch,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  Globe,
  BookOpen,
} from 'lucide-react';
import { useAppStore } from '../../stores/app';
import { clsx } from 'clsx';

export function Sidebar() {
  const { t } = useTranslation();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/packages', icon: Package, label: t('nav.packages') },
    { path: '/dependencies', icon: GitBranch, label: t('nav.dependencies') },
    { path: '/security', icon: Shield, label: t('nav.security') },
    { path: '/remote', icon: Globe, label: t('nav.remote') },
    { path: '/docs', icon: BookOpen, label: t('nav.docs') },
    { path: '/settings', icon: Settings, label: t('nav.settings') },
  ];

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 z-40',
        sidebarCollapsed ? 'w-16' : 'w-56'
      )}
    >
      <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 dark:border-gray-700">
        {!sidebarCollapsed && (
          <span className="font-bold text-lg text-primary-600">NPVM</span>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="p-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              )
            }
          >
            <item.icon size={20} />
            {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
