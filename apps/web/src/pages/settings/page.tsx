import { FolderCog, HardDrive, TimerReset } from 'lucide-react';
import { managedRootsState, settingsErrorState, settingsLoadingState, settingsState } from '../../state/app-state';
import { useI18n } from '../../hooks/use-i18n';
import { useRelaxValue } from '../../state/relax';

export function SettingsPage() {
  const roots = useRelaxValue(managedRootsState);
  const settings = useRelaxValue(settingsState);
  const settingsLoading = useRelaxValue(settingsLoadingState);
  const settingsError = useRelaxValue(settingsErrorState);
  const { pick } = useI18n();

  const summaryCards = [
    {
      label: pick('挂载目录', 'Managed Roots'),
      value: String(roots.length),
      hint: pick('服务端配置的根目录数量', 'Configured server-side root count'),
      icon: FolderCog,
    },
    {
      label: pick('导出清理', 'Export Cleanup'),
      value: settingsLoading ? '--' : `${settings?.exportTtlMinutes ?? '--'}m`,
      hint: pick('临时压缩包保留时间', 'Temporary archive retention'),
      icon: TimerReset,
    },
    {
      label: pick('运行模式', 'Runtime Mode'),
      value: pick('单用户', 'Single user'),
      hint: pick('当前版本不启用多用户权限', 'Multi-user permission is not enabled in this version'),
      icon: HardDrive,
    },
  ] as const;

  return (
    <div className="space-y-4">
      <section className="panel-elevated p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">{pick('设置', 'Settings')}</p>
            <h1 className="mt-2 text-[24px] font-semibold leading-tight text-ink-strong">
              {pick('系统配置', 'System Configuration')}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              {pick(
                '当前页只展示运行时信息，不在浏览器内做高风险修改。重点确认根目录、临时导出目录和 SQLite 路径。',
                'This page stays read-only in V1. Use it to confirm managed roots, temporary export paths, and SQLite storage.',
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="chip chip-neutral">{pick('单用户', 'Single user')}</span>
            <span className={settings ? 'chip chip-success' : 'chip chip-warning'}>
              {settings ? pick('运行时已加载', 'Runtime loaded') : pick('运行时加载中', 'Loading runtime')}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <article key={card.label} className="panel-section px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                      {card.label}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-ink-strong">{card.value}</p>
                    <p className="mt-1 text-sm text-muted">{card.hint}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-canvas p-2 text-muted">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {settingsError ? (
        <div className="rounded-[16px] border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {settingsError}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <article className="panel-elevated p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">{pick('挂载目录', 'Managed Roots')}</p>
              <h2 className="mt-2 text-xl font-semibold text-ink-strong">
                {pick('根目录注册表', 'Root Registry')}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {pick(
                  '根目录来自服务端配置。这里仅做只读确认，方便核对 label、id、物理路径和是否可写。',
                  'Roots are configured on the server. This view is read-only and is intended for quickly checking labels, ids, physical paths, and write access.',
                )}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-2 text-muted">
              <FolderCog className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-4 space-y-3 text-sm text-muted">
            {roots.map((root) => (
              <article key={root.id} className="panel-section p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{root.id}</p>
                    <p className="mt-1 text-base font-semibold text-ink-strong">{root.label}</p>
                  </div>
                  <span className={root.readOnly ? 'chip chip-warning' : 'chip chip-success'}>
                    {root.readOnly ? pick('只读', 'Read-only') : pick('可写', 'Writable')}
                  </span>
                </div>
                <p className="mt-3 break-all rounded-[14px] border border-border bg-canvas px-3 py-3 font-mono text-xs leading-6 text-ink">
                  {root.path}
                </p>
              </article>
            ))}
          </div>
        </article>

        <article className="panel-elevated p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">{pick('运行时', 'Runtime')}</p>
              <h2 className="mt-2 text-xl font-semibold text-ink-strong">
                {pick('存储与路径', 'Storage & Paths')}
              </h2>
            </div>
            <div className="rounded-xl border border-border bg-surface p-2 text-muted">
              <HardDrive className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-4 space-y-3 text-sm text-muted">
            <div className="panel-section px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                {pick('SQLite 路径', 'SQLite Path')}
              </p>
              <p className="mt-2 break-all font-mono text-xs leading-6 text-ink">
                {settingsLoading ? pick('加载中...', 'Loading...') : settings?.sqlitePath ?? '--'}
              </p>
            </div>

            <div className="panel-section px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                {pick('临时导出目录', 'Temp Exports')}
              </p>
              <p className="mt-2 break-all font-mono text-xs leading-6 text-ink">
                {settingsLoading ? pick('加载中...', 'Loading...') : settings?.tempExportDir ?? '--'}
              </p>
            </div>

            <div className="panel-section px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                {pick('根目录配置', 'Roots Config')}
              </p>
              <p className="mt-2 break-all font-mono text-xs leading-6 text-ink">
                {settingsLoading ? pick('加载中...', 'Loading...') : settings?.rootsConfigPath ?? '--'}
              </p>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
