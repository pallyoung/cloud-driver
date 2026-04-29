import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import clsx from 'clsx';
import { useI18n } from '../../hooks/use-i18n';

type MenuAction = {
  kind?: 'action';
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: () => void;
};

type MenuSeparator = {
  kind: 'separator';
  id: string;
};

export type FileActionsMenuEntry = MenuAction | MenuSeparator;

type FileActionsMenuProps = {
  anchor: {
    x: number;
    y: number;
  };
  entries: FileActionsMenuEntry[];
  itemName: string;
  onClose: () => void;
};

const MENU_WIDTH = 236;
const VIEWPORT_PADDING = 12;
const MENU_HEADER_HEIGHT = 56;
const MENU_ACTION_HEIGHT = 44;
const MENU_SEPARATOR_HEIGHT = 10;

function estimateMenuHeight(entries: FileActionsMenuEntry[]): number {
  return entries.reduce((total, entry) => {
    if (entry.kind === 'separator') {
      return total + MENU_SEPARATOR_HEIGHT;
    }

    return total + MENU_ACTION_HEIGHT;
  }, MENU_HEADER_HEIGHT + VIEWPORT_PADDING);
}

export function FileActionsMenu({
  anchor,
  entries,
  itemName,
  onClose,
}: FileActionsMenuProps) {
  const { pick } = useI18n();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;

    if (!menu) {
      return;
    }

    const { innerHeight, innerWidth } = window;
    const menuHeight = menu.getBoundingClientRect().height;
    const effectiveMenuHeight = Math.max(menuHeight, estimateMenuHeight(entries));
    const nextX = Math.min(
      Math.max(anchor.x, VIEWPORT_PADDING),
      innerWidth - MENU_WIDTH - VIEWPORT_PADDING,
    );
    const nextY = Math.min(
      Math.max(anchor.y, VIEWPORT_PADDING),
      innerHeight - effectiveMenuHeight - VIEWPORT_PADDING,
    );

    setPosition({ x: nextX, y: nextY });
  }, [anchor]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    const handleWindowChange = () => {
      onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, [onClose]);

  useEffect(() => {
    const firstButton = menuRef.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]');
    firstButton?.focus();
  }, []);

  const actionEntries = useMemo(
    () => entries.filter((entry): entry is MenuAction => entry.kind !== 'separator'),
    [entries],
  );

  if (actionEntries.length === 0) {
    return null;
  }

  function handleBackdropContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    onClose();
  }

  // 菜单首次渲染时使用 anchor 位置，然后通过 useLayoutEffect 调整
  // 这样避免了位置跳动
  const effectivePosition = position ?? anchor;

  return (
    <div
      className="fixed inset-0 z-50"
      onMouseDown={onClose}
      onContextMenu={handleBackdropContextMenu}
    >
      <div
        ref={menuRef}
        role="menu"
        aria-label={`Actions for ${itemName}`}
        data-testid="explorer-context-menu"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
        className="absolute max-h-[calc(100vh-24px)] w-[236px] overflow-auto rounded-[16px] border border-line-strong/80 bg-surface-alt shadow-floating backdrop-blur"
        style={{
          left: `${effectivePosition.x}px`,
          top: `${effectivePosition.y}px`,
          // 使用 opacity 和 transform 防止首次渲染时可见跳动
          opacity: position ? 1 : 0,
          transform: position ? 'none' : 'scale(0.95)',
          transition: 'opacity 150ms ease-out, transform 150ms ease-out',
        }}
      >
        <div className="border-b border-border bg-canvas/90 px-3 py-3">
          <p className="eyebrow">{pick('操作', 'Actions')}</p>
          <p className="mt-1 truncate text-sm font-semibold text-ink-strong">{itemName}</p>
        </div>

        <div className="p-1.5">
          {entries.map((entry) => {
            if (entry.kind === 'separator') {
              return <div key={entry.id} className="my-1.5 border-t border-border/80" />;
            }

            return (
              <button
                key={entry.id}
                type="button"
                role="menuitem"
                data-testid={`context-action-${entry.id}`}
                disabled={entry.disabled}
                onClick={() => {
                  if (entry.disabled) {
                    return;
                  }

                  entry.onSelect();
                }}
                className={clsx(
                  'flex w-full items-center rounded-[10px] border px-3 py-2 text-left text-sm font-medium transition duration-150 ease-out focus:outline-none focus:ring-4 focus:ring-accent/10',
                  entry.disabled
                    ? 'cursor-not-allowed border-transparent opacity-45'
                    : entry.destructive
                      ? 'border-transparent text-danger hover:border-danger/20 hover:bg-danger/5'
                      : 'border-transparent text-ink hover:border-border hover:bg-canvas',
                )}
              >
                <span className="truncate">{entry.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
