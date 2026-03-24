import { useEffect, useMemo } from 'react';
import type { ExportJobSummary } from '@cloud-driver/shared';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Download,
  FolderArchive,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import {
  authStatusState,
  exportJobsState,
  jobsFocusTargetState,
  jobsErrorState,
  jobsLoadingState,
  loadJobsAction,
  setJobsFocusTargetAction,
  setTaskFilterAction,
  taskFilterState,
} from '../../state/app-state';
import { useI18n } from '../../hooks/use-i18n';
import { useActions, useRelaxState, useRelaxValue } from '../../state/relax';

const filters = ['All', 'Processing', 'Failed', 'Ready'] as const;

type ExportLifecycleStep = {
  label: string;
  note: string;
  tone: 'done' | 'current' | 'pending' | 'danger';
};

function getParentPath(currentPath: string): string {
  if (!currentPath) {
    return '';
  }

  const parts = currentPath.split('/').filter(Boolean);
  return parts.slice(0, -1).join('/');
}

function getStatusTone(status: string): string {
  if (status === 'ready' || status === 'completed' || status === 'cleaned') {
    return 'chip chip-success';
  }

  if (status === 'failed' || status === 'expired') {
    return 'chip chip-danger';
  }

  if (status === 'queued' || status === 'processing') {
    return 'chip chip-warning';
  }

  return 'chip chip-neutral';
}

function isProcessingTask(job: ExportJobSummary): boolean {
  return job.status === 'queued' || job.status === 'processing';
}

function isFailedTask(job: ExportJobSummary): boolean {
  return job.status === 'failed' || job.status === 'expired';
}

function isReadyTask(job: ExportJobSummary): boolean {
  return ['ready', 'completed', 'cleaned'].includes(job.status);
}

function matchesFilter(job: ExportJobSummary, filter: string): boolean {
  if (filter === 'All' || filter === 'Export') {
    return true;
  }

  if (filter === 'Processing') {
    return isProcessingTask(job);
  }

  if (filter === 'Failed') {
    return isFailedTask(job);
  }

  if (filter === 'Ready') {
    return isReadyTask(job);
  }

  return false;
}

function getSourceExplorerHref(job: Pick<ExportJobSummary, 'rootId' | 'sourcePath'>): string {
  const params = new URLSearchParams({
    root: job.rootId,
    path: getParentPath(job.sourcePath),
  });

  if (job.sourcePath) {
    params.set('select', job.sourcePath);
  }

  return `/explorer?${params.toString()}`;
}

function getFilterLabel(filter: (typeof filters)[number], isChinese: boolean): string {
  if (!isChinese) {
    return filter;
  }

  switch (filter) {
    case 'All':
      return '全部';
    case 'Processing':
      return '处理中';
    case 'Failed':
      return '失败';
    case 'Ready':
      return '可下载';
    default:
      return filter;
  }
}

function getExportStatusNote(job: ExportJobSummary, isChinese: boolean): string {
  if (job.status === 'queued' || job.status === 'processing') {
    return isChinese
      ? '目录正在打包到临时导出空间，完成后即可在浏览器下载。'
      : 'Archive is being packaged in the temporary export workspace.';
  }

  if (job.status === 'ready') {
    return isChinese
      ? '压缩包已生成，可直接下载，同时清理倒计时已经开始。'
      : 'Archive is ready for browser download and cleanup countdown has started.';
  }

  if (job.status === 'cleaned') {
    return isChinese
      ? '临时压缩包已从服务器清理完成。'
      : 'Temporary archive has already been cleaned from the server workspace.';
  }

  if (job.status === 'completed') {
    return isChinese
      ? '下载完成，服务端正在完成最后的收尾。'
      : 'Export finished and the archive handoff has completed.';
  }

  if (job.status === 'failed' || job.status === 'expired') {
    return isChinese
      ? '导出没有成功完成，请查看错误信息后重新发起。'
      : 'Packaging did not complete successfully. Inspect the runtime note and retry if needed.';
  }

  return isChinese ? '任务状态同步中。' : 'Export state is being synchronized.';
}

function getExportAvailabilityNote(job: ExportJobSummary, isChinese: boolean): string {
  if (job.status === 'ready') {
    if (!job.expiresAt) {
      return isChinese ? '压缩包已可下载。' : 'Archive is ready to download.';
    }

    const remainingMs = new Date(job.expiresAt).getTime() - Date.now();

    if (remainingMs <= 0) {
      return isChinese
        ? '清理窗口已过，请刷新任务列表确认最终状态。'
        : 'Cleanup window has elapsed. Refresh to confirm the latest status.';
    }

    const remainingMinutes = Math.ceil(remainingMs / 60_000);
    return isChinese
      ? `下载窗口剩余约 ${remainingMinutes} 分钟。`
      : `Download window: about ${remainingMinutes} min remaining before cleanup.`;
  }

  if (job.status === 'completed') {
    return isChinese
      ? '下载已经完成，服务端正在完成清理交接。'
      : 'Download finished. Cleanup handoff is being finalized on the server.';
  }

  if (job.status === 'cleaned') {
    return isChinese
      ? '临时 zip 已删除，如需再次获取请重新导出。'
      : 'Temporary zip already removed. Re-export from Explorer if you need another copy.';
  }

  if (job.status === 'expired') {
    return isChinese
      ? '压缩包在下载前已过期，临时文件已经不可用。'
      : 'This archive expired before download and the temp file is no longer available.';
  }

  if (job.status === 'failed') {
    return isChinese
      ? '打包失败，请查看错误说明并重新创建导出任务。'
      : 'Packaging failed. Review the runtime note, then create a new export from the source path.';
  }

  return isChinese
    ? '打包仍在进行中，完成后这里会出现下载入口。'
    : 'Packaging is still running. Download becomes available after the archive reaches ready.';
}

function getExportLifecycleSteps(job: ExportJobSummary, isChinese: boolean): ExportLifecycleStep[] {
  const steps: ExportLifecycleStep[] = [
    {
      label: isChinese ? '排队' : 'Queued',
      note: isChinese ? '任务已进入导出队列。' : 'Task record accepted into the export queue.',
      tone: 'pending',
    },
    {
      label: isChinese ? '打包' : 'Packaging',
      note: isChinese ? '服务器正在生成 zip。' : 'Server is building the zip archive.',
      tone: 'pending',
    },
    {
      label: isChinese ? '可下载' : 'Ready',
      note: isChinese ? '浏览器可直接下载压缩包。' : 'Archive can be downloaded from the browser.',
      tone: 'pending',
    },
    {
      label: isChinese ? '清理' : 'Cleanup',
      note: isChinese
        ? '下载交接后删除服务器临时文件。'
        : 'Temporary server artifact is removed after handoff.',
      tone: 'pending',
    },
  ];

  if (job.status === 'queued') {
    steps[0].tone = 'current';
    return steps;
  }

  steps[0].tone = 'done';

  if (job.status === 'processing') {
    steps[1].tone = 'current';
    return steps;
  }

  if (job.status === 'failed') {
    steps[1].tone = 'danger';
    steps[1].note = isChinese
      ? '打包失败，未生成可下载文件。'
      : 'Packaging failed before a download artifact became available.';
    return steps;
  }

  steps[1].tone = 'done';

  if (job.status === 'ready') {
    steps[2].tone = 'current';
    return steps;
  }

  if (job.status === 'expired') {
    steps[2].tone = 'danger';
    steps[2].note = isChinese
      ? '已进入可下载状态，但在领取前过期。'
      : 'Archive reached ready, but the download window expired before pickup.';
    return steps;
  }

  steps[2].tone = 'done';

  if (job.status === 'completed') {
    steps[3].tone = 'current';
    steps[3].note = isChinese
      ? '下载完成，服务端正在清理临时文件。'
      : 'Download finished and server cleanup is being finalized.';
    return steps;
  }

  if (job.status === 'cleaned') {
    steps[3].tone = 'done';
    steps[3].note = isChinese
      ? '服务器临时压缩包已被删除。'
      : 'Temporary archive has been removed from the server workspace.';
  }

  return steps;
}

export function JobsPage() {
  const navigate = useNavigate();
  const authStatus = useRelaxValue(authStatusState);
  const exportJobs = useRelaxValue(exportJobsState);
  const jobsLoading = useRelaxValue(jobsLoadingState);
  const jobsError = useRelaxValue(jobsErrorState);
  const jobsFocusTarget = useRelaxValue(jobsFocusTargetState);
  const [activeFilter] = useRelaxState(taskFilterState);
  const { formatDate, isChinese, pick } = useI18n();
  const [setTaskFilter, loadJobs, setJobsFocusTarget] = useActions(
    [setTaskFilterAction, loadJobsAction, setJobsFocusTargetAction] as const,
  );

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      return;
    }

    void loadJobs();
    const timer = window.setInterval(() => {
      void loadJobs();
    }, 4000);

    return () => window.clearInterval(timer);
  }, [authStatus, loadJobs]);

  useEffect(() => {
    if (activeFilter === 'Backup' || activeFilter === 'Export') {
      setTaskFilter('All');
    }
  }, [activeFilter, setTaskFilter]);

  const tasks = useMemo(
    () => [...exportJobs]
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .filter((task) => matchesFilter(task, activeFilter)),
    [activeFilter, exportJobs],
  );

  const filterCounts = useMemo(
    () =>
      Object.fromEntries(
        filters.map((filter) => [filter, exportJobs.filter((task) => matchesFilter(task, filter)).length]),
      ) as Record<(typeof filters)[number], number>,
    [exportJobs],
  );

  const readyCount = filterCounts.Ready;
  const processingCount = filterCounts.Processing;
  const failedCount = filterCounts.Failed;
  const highlightedJobId = jobsFocusTarget?.kind === 'Export' ? jobsFocusTarget.id : null;

  function handleOpenSource(job: Pick<ExportJobSummary, 'rootId' | 'sourcePath'>) {
    navigate(getSourceExplorerHref(job));
  }

  useEffect(() => {
    if (!jobsFocusTarget || jobsFocusTarget.kind !== 'Export') {
      return;
    }

    const selector = `[data-testid="job-export-${jobsFocusTarget.id}"]`;
    const element = document.querySelector<HTMLElement>(selector);

    if (!element) {
      return;
    }

    element.scrollIntoView({ block: 'center', behavior: 'smooth' });

    const timer = window.setTimeout(() => {
      setJobsFocusTarget(null);
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [jobsFocusTarget, setJobsFocusTarget, tasks]);

  const summaryCards = [
    {
      label: pick('可下载', 'Ready'),
      value: String(readyCount),
      hint: pick('可直接下载的导出任务', 'Exports that are ready to download'),
      icon: CheckCircle2,
      tone: readyCount > 0 ? 'chip chip-success' : 'chip chip-neutral',
    },
    {
      label: pick('处理中', 'Processing'),
      value: String(processingCount),
      hint: pick('正在打包中的导出任务', 'Exports currently being packaged'),
      icon: Clock3,
      tone: processingCount > 0 ? 'chip chip-warning' : 'chip chip-neutral',
    },
    {
      label: pick('异常', 'Failed'),
      value: String(failedCount),
      hint: pick('需要人工跟进的导出任务', 'Exports that need operator follow-up'),
      icon: TriangleAlert,
      tone: failedCount > 0 ? 'chip chip-danger' : 'chip chip-neutral',
    },
    {
      label: pick('总量', 'Total'),
      value: String(exportJobs.length),
      hint: pick('当前导出任务总数', 'Total export jobs'),
      icon: FolderArchive,
      tone: 'chip chip-neutral',
    },
  ] as const;

  return (
    <div className="space-y-4">
      <section className="panel-elevated p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">{pick('任务中心', 'Task Center')}</p>
            <h1 className="mt-2 text-[24px] font-semibold leading-tight text-ink-strong">
              {pick('导出任务', 'Export Jobs')}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              {pick(
                '当前任务中心只展示导出任务，重点查看打包、下载和清理状态。',
                'Task Center currently shows export jobs only, focused on packaging, download, and cleanup.',
              )}
            </p>
          </div>

          <button
            type="button"
            data-testid="jobs-refresh"
            onClick={() => void loadJobs()}
            disabled={jobsLoading}
            className="action-button self-start"
          >
            <RefreshCw className={clsx('h-4 w-4', jobsLoading && 'animate-spin')} />
            {jobsLoading ? pick('刷新中...', 'Refreshing...') : pick('刷新', 'Refresh')}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <article key={card.label} className="panel-section px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                      {card.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-ink-strong">{card.value}</p>
                    <p className="mt-1 text-sm leading-5 text-muted">{card.hint}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-canvas p-2 text-muted">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className={card.tone}>{card.label}</span>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-muted">
            {pick(
              '按执行阶段过滤，避免把可下载、处理中和失败任务混在一起。',
              'Filter by stage so ready, processing, and failed exports stay separated.',
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setTaskFilter(filter)}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition duration-150 ease-out',
                  activeFilter === filter
                    ? 'border-ink-strong bg-ink-strong text-white'
                    : 'border-border bg-surface text-ink hover:border-line-strong hover:bg-surface-alt',
                )}
              >
                <span>{getFilterLabel(filter, isChinese)}</span>
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    activeFilter === filter ? 'bg-white/16 text-white' : 'bg-canvas text-muted',
                  )}
                >
                  {filterCounts[filter]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {jobsError ? (
        <div className="rounded-[16px] border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {jobsError}
        </div>
      ) : null}

      <div className="space-y-3">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <article
              key={task.id}
              data-testid={`job-export-${task.id}`}
              className={clsx(
                'panel-elevated p-4 transition duration-150 ease-out',
                highlightedJobId === task.id && 'border-accent bg-accent-soft/35 shadow-floating',
              )}
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_248px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip chip-accent">{pick('导出', 'Export')}</span>
                    <span className={getStatusTone(task.status)}>{task.status}</span>
                    {highlightedJobId === task.id ? (
                      <span className="chip chip-neutral">{pick('刚创建', 'Just created')}</span>
                    ) : null}
                  </div>

                  <h2 className="mt-3 truncate text-lg font-semibold text-ink-strong">
                    {task.sourcePath || '/'}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {getExportStatusNote(task, isChinese)}
                  </p>

                  <div className="mt-4 grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
                    {getExportLifecycleSteps(task, isChinese).map((step) => (
                      <div
                        key={`${task.id}-${step.label}`}
                        className={clsx(
                          'rounded-[16px] border px-3 py-3 text-sm leading-6',
                          step.tone === 'done' && 'border-success/20 bg-success/5 text-muted',
                          step.tone === 'current' && 'border-accent/25 bg-accent-soft/60 text-ink',
                          step.tone === 'pending' && 'border-border bg-surface text-muted',
                          step.tone === 'danger' && 'border-danger/25 bg-danger/5 text-danger',
                        )}
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                          {step.label}
                        </p>
                        <div
                          className={clsx(
                            'mt-2 h-1.5 rounded-full',
                            step.tone === 'done' && 'bg-success/80',
                            step.tone === 'current' && 'bg-accent',
                            step.tone === 'pending' && 'bg-border',
                            step.tone === 'danger' && 'bg-danger/80',
                          )}
                        />
                        <p className="mt-2 text-sm leading-5">{step.note}</p>
                      </div>
                    ))}
                  </div>

                  <dl className="mt-4 grid gap-2 text-sm text-muted md:grid-cols-2 2xl:grid-cols-4">
                    <div className="panel-section px-3 py-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                        {pick('根目录', 'Root')}
                      </dt>
                      <dd className="mt-1 font-medium text-ink-strong">{task.rootId}</dd>
                    </div>
                    <div className="panel-section px-3 py-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                        {pick('压缩包', 'Archive')}
                      </dt>
                      <dd className="mt-1 break-all font-mono text-xs text-ink">
                        {task.archiveName ?? pick('等待打包', 'Waiting for packaging')}
                      </dd>
                    </div>
                    <div className="panel-section px-3 py-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                        {pick('创建时间', 'Created')}
                      </dt>
                      <dd className="mt-1 font-medium text-ink-strong">{formatDate(task.createdAt)}</dd>
                    </div>
                    <div className="panel-section px-3 py-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                        {pick('过期时间', 'Expires')}
                      </dt>
                      <dd className="mt-1 font-medium text-ink-strong">{formatDate(task.expiresAt)}</dd>
                    </div>
                  </dl>

                  {task.errorMessage ? (
                    <div className="mt-4 rounded-[16px] border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                      {task.errorMessage}
                    </div>
                  ) : null}
                </div>

                <aside className="panel-section flex flex-col gap-3 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                    {pick('操作区', 'Actions')}
                  </p>
                  <span className={getStatusTone(task.status)}>{task.status}</span>
                  <div className="rounded-[14px] border border-border bg-canvas px-3 py-3 text-sm leading-6 text-muted">
                    {getExportAvailabilityNote(task, isChinese)}
                  </div>
                  {task.downloadUrl ? (
                    <a
                      href={task.downloadUrl}
                      data-testid={`job-download-${task.id}`}
                      className="action-button action-button-primary"
                    >
                      <Download className="h-4 w-4" />
                      {pick('下载 Zip', 'Download Zip')}
                    </a>
                  ) : (
                    <div className="rounded-[14px] border border-border bg-canvas px-3 py-3 text-sm text-muted">
                      {task.status === 'processing' || task.status === 'queued'
                        ? pick('打包中', 'Packaging in progress')
                        : pick('暂无下载文件', 'No download available')}
                    </div>
                  )}
                  <button
                    type="button"
                    data-testid={`job-open-source-export-${task.id}`}
                    onClick={() => handleOpenSource(task)}
                    className="action-button"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    {pick('打开源目录', 'Open Source')}
                  </button>
                </aside>
              </div>
            </article>
          ))
        ) : (
          <div
            data-testid="jobs-empty"
            className="rounded-[16px] border border-dashed border-border bg-canvas px-5 py-10 text-sm leading-6 text-muted"
          >
            {pick(
              '当前筛选下没有导出任务。请回到文件管理中创建导出任务。',
              'No export jobs match the current filter. Create an export from Explorer to populate this view.',
            )}
          </div>
        )}
      </div>
    </div>
  );
}
