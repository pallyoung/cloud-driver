import clsx from 'clsx';
import {
  FileText,
  FolderTree,
  Languages,
  LogOut,
  PanelLeft,
  Settings2,
  SquareKanban,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  explorerSurfaceState,
  logoutAction,
  setExplorerSurfaceAction,
  setLanguageAction,
} from '../../state/app-state';
import { useI18n } from '../../hooks/use-i18n';
import { useActions, useRelaxValue } from '../../state/relax';

export function AppHeader() {
  const location = useLocation();
  const { language, pick } = useI18n();
  const explorerSurface = useRelaxValue(explorerSurfaceState);
  const [setExplorerSurface, setLanguage, logout] = useActions(
    [setExplorerSurfaceAction, setLanguageAction, logoutAction] as const,
  );

  const isExplorerRoute = location.pathname.startsWith('/explorer');
  const nextLanguage = language === 'zh-CN' ? 'en-US' : 'zh-CN';
  const languageButtonLabel = language === 'zh-CN' ? 'EN' : '中';
  const languageButtonTitle =
    language === 'zh-CN' ? 'Switch to English' : '切换到中文';

  const navItems = [
    {
      to: '/explorer',
      label: pick('文件管理', 'File Manager'),
      icon: FolderTree,
      testId: 'nav-explorer',
    },
    {
      to: '/jobs',
      label: pick('任务中心', 'Task Center'),
      icon: SquareKanban,
      testId: 'nav-jobs',
    },
    {
      to: '/settings',
      label: pick('设置', 'Settings'),
      icon: Settings2,
      testId: 'nav-settings',
    },
  ] as const;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-canvas/95 backdrop-blur">
      <div className="flex items-center gap-2 px-2.5 py-2 sm:px-4 sm:py-3">
        <nav className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
          {navItems.map(({ icon: Icon, label, testId, to }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={testId}
              aria-label={label}
              title={label}
              className={({ isActive }) =>
                clsx(
                  'inline-flex size-8 items-center justify-center rounded-lg transition duration-150 ease-out sm:size-9 sm:rounded-xl',
                  isActive
                    ? 'bg-ink-strong text-white'
                    : 'text-ink hover:bg-surface-alt',
                )
              }
            >
              <Icon className="h-4 w-4" />
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {isExplorerRoute ? (
            <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1 xl:hidden">
              <button
                type="button"
                data-testid="header-surface-tree"
                aria-label={pick('显示目录', 'Show tree')}
                title={pick('显示目录', 'Show tree')}
                onClick={() => setExplorerSurface('tree')}
                className={clsx(
                  'inline-flex size-8 items-center justify-center rounded-lg transition duration-150 ease-out',
                  explorerSurface === 'tree'
                    ? 'bg-ink-strong text-white'
                    : 'text-ink hover:bg-surface-alt',
                )}
              >
                <PanelLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                data-testid="header-surface-content"
                aria-label={pick('显示内容', 'Show content')}
                title={pick('显示内容', 'Show content')}
                onClick={() => setExplorerSurface('content')}
                className={clsx(
                  'inline-flex size-8 items-center justify-center rounded-lg transition duration-150 ease-out',
                  explorerSurface === 'content'
                    ? 'bg-ink-strong text-white'
                    : 'text-ink hover:bg-surface-alt',
                )}
              >
                <FileText className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <button
            type="button"
            data-testid="language-switch-toggle"
            aria-label={languageButtonTitle}
            title={languageButtonTitle}
            onClick={() => setLanguage(nextLanguage)}
            className="inline-flex min-w-0 items-center gap-1 rounded-xl border border-border bg-surface px-2 py-1.5 text-[11px] font-semibold text-ink transition duration-150 ease-out hover:border-line-strong hover:bg-surface-alt sm:px-2.5 sm:text-xs"
          >
            <Languages className="h-4 w-4" />
            <span>{languageButtonLabel}</span>
          </button>

          <button
            type="button"
            data-testid="nav-signout"
            aria-label={pick('退出登录', 'Sign out')}
            title={pick('退出登录', 'Sign out')}
            onClick={() => void logout()}
            className="inline-flex size-8 items-center justify-center rounded-xl border border-border bg-surface text-ink transition duration-150 ease-out hover:border-line-strong hover:bg-surface-alt sm:size-9"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
