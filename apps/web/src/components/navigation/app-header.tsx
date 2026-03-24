import clsx from 'clsx';
import { FolderTree, Languages, LogOut, Settings2, SquareKanban } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { setLanguageAction, logoutAction, type AuthStatus } from '../../state/app-state';
import { useActions } from '../../state/relax';
import { type AppLanguage } from '../../lib/i18n';
import { useI18n } from '../../hooks/use-i18n';

type AppHeaderProps = {
  authStatus: AuthStatus;
  rootsCount: number;
  runtimeReady: boolean;
};

export function AppHeader({ authStatus, rootsCount, runtimeReady }: AppHeaderProps) {
  const { language, pick } = useI18n();
  const [setLanguage, logout] = useActions([setLanguageAction, logoutAction] as const);

  const navItems = [
    { to: '/explorer', label: pick('文件管理', 'File Manager'), icon: FolderTree, testId: 'nav-explorer' },
    { to: '/jobs', label: pick('任务中心', 'Task Center'), icon: SquareKanban, testId: 'nav-jobs' },
    { to: '/settings', label: pick('设置', 'Settings'), icon: Settings2, testId: 'nav-settings' },
  ] as const;

  const languageItems: Array<{ label: string; value: AppLanguage; testId: string }> = [
    { label: '中', value: 'zh-CN', testId: 'language-switch-zh' },
    { label: 'EN', value: 'en-US', testId: 'language-switch-en' },
  ];

  return (
    <header className="border-b border-border bg-canvas/95 px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-border bg-surface text-ink-strong">
            <FolderTree className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              {pick('单用户文件控制台', 'Single-User File Console')}
            </p>
            <p className="truncate text-sm font-semibold text-ink-strong">Cloud Driver</p>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <span className="chip chip-neutral">
              {rootsCount > 0
                ? pick(`${rootsCount} 个挂载目录`, `${rootsCount} managed roots`)
                : pick('等待目录加载', 'Waiting for roots')}
            </span>
            <span className={runtimeReady ? 'chip chip-success' : 'chip chip-warning'}>
              {runtimeReady ? pick('运行环境已就绪', 'Runtime ready') : pick('运行环境加载中', 'Loading runtime')}
            </span>
            <span className="chip chip-neutral">
              {authStatus === 'authenticated'
                ? pick('已登录', 'Signed in')
                : pick('会话检查中', 'Checking session')}
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
          {navItems.map(({ icon: Icon, label, testId, to }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={testId}
              className={({ isActive }) =>
                clsx(
                  'inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition duration-150 ease-out',
                  isActive
                    ? 'bg-ink-strong text-white'
                    : 'text-ink hover:bg-surface-alt',
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
            <span className="flex h-9 w-9 items-center justify-center text-muted">
              <Languages className="h-4 w-4" />
            </span>
            {languageItems.map((item) => (
              <button
                key={item.value}
                type="button"
                data-testid={item.testId}
                onClick={() => setLanguage(item.value)}
                className={clsx(
                  'inline-flex min-h-9 min-w-11 items-center justify-center rounded-lg px-2 text-xs font-semibold transition duration-150 ease-out',
                  language === item.value
                    ? 'bg-ink-strong text-white'
                    : 'text-ink hover:bg-surface-alt',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            data-testid="nav-signout"
            onClick={() => void logout()}
            className="action-button"
            aria-label={pick('退出登录', 'Sign out')}
            title={pick('退出登录', 'Sign out')}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{pick('退出', 'Sign out')}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
