import { useEffect, useId, useRef, type MouseEvent, type PropsWithChildren, type ReactNode } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '../../hooks/use-i18n';

type OverlayPanelProps = PropsWithChildren<{
  title: string;
  description?: string;
  mode?: 'dialog' | 'drawer';
  onClose: () => void;
  footer?: ReactNode;
  testId?: string;
}>;

export function OverlayPanel({
  children,
  description,
  footer,
  mode = 'dialog',
  onClose,
  testId,
  title,
}: OverlayPanelProps) {
  const { pick } = useI18n();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const autofocusTarget = panelRef.current?.querySelector<HTMLElement>('[data-autofocus="true"]');
    autofocusTarget?.focus();
  }, []);

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-strong/38 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        data-testid={testId}
        className={clsx(
          'relative w-full overflow-hidden rounded-[20px] border border-line-strong/80 bg-surface-alt shadow-floating',
          mode === 'drawer'
            ? 'ml-auto max-h-[calc(100vh-2rem)] max-w-2xl'
            : 'max-w-xl',
        )}
      >
        <div className="border-b border-border bg-canvas/92 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">{pick('操作', 'Action')}</p>
              <h2 id={titleId} className="mt-2 text-xl font-semibold text-ink-strong">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={pick('关闭弹窗', 'Close dialog')}
              className="rounded-xl border border-border bg-surface p-2 text-muted transition duration-150 ease-out hover:border-line-strong hover:bg-surface-alt hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(100vh-15rem)] overflow-y-auto px-5 py-4">{children}</div>

        {footer ? <div className="border-t border-border bg-canvas/82 px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
