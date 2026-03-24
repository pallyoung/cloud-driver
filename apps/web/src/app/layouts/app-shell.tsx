import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AppHeader } from '../../components/navigation/app-header';
import {
  authStatusState,
  loadRootsAction,
  loadSessionAction,
  loadSettingsAction,
  managedRootsState,
  settingsState,
} from '../../state/app-state';
import { useI18n } from '../../hooks/use-i18n';
import { useActions, useRelaxValue } from '../../state/relax';

export function AppShell() {
  const authStatus = useRelaxValue(authStatusState);
  const roots = useRelaxValue(managedRootsState);
  const settings = useRelaxValue(settingsState);
  const { pick } = useI18n();
  const [loadSession, loadRoots, loadSettings] = useActions(
    [loadSessionAction, loadRootsAction, loadSettingsAction] as const,
  );

  useEffect(() => {
    if (authStatus === 'unknown') {
      void loadSession();
    }
  }, [authStatus, loadSession]);

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      return;
    }

    if (roots.length === 0) {
      void loadRoots();
    }

    if (!settings) {
      void loadSettings();
    }
  }, [authStatus, loadRoots, loadSettings, roots.length, settings]);

  if (authStatus === 'unknown') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="panel-elevated px-6 py-5 text-sm text-muted">
          {pick('正在检查会话...', 'Checking session...')}
        </div>
      </div>
    );
  }

  if (authStatus !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen sm:px-3 sm:py-3 xl:px-5 xl:py-5">
      <div className="mx-auto max-w-[1600px]">
        <div className="overflow-hidden bg-canvas/92 sm:rounded-[24px] sm:border sm:border-line-strong/70 sm:shadow-shell sm:backdrop-blur">
          <AppHeader />

          <main className="p-2.5 sm:p-4 xl:p-5">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
