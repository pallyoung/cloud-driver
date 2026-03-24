import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileItem, ManagedRoot } from "@cloud-driver/shared";
import clsx from "clsx";
import {
  ArrowClockwise,
  CaretDown,
  CaretRight,
  DotsThree,
  File as FileIcon,
  FileCode,
  FileCss,
  FileHtml,
  FileImage,
  FileJs,
  FileMd,
  FilePdf,
  FileText,
  FileTs,
  FileVideo,
  FileZip,
  Folder,
  FolderPlus,
  FolderOpen,
  HardDrive,
  UploadSimple,
  type Icon,
  TreeStructure,
} from "@phosphor-icons/react";
import { ApiError, getFilesList } from "../../lib/api/client";
import { useI18n } from "../../hooks/use-i18n";
import { sortFileItems } from "../../lib/file-items";

type FolderTreeProps = {
  activeRootId: string | null;
  canCreateInCurrentRoot: boolean;
  currentItems: FileItem[];
  currentPath: string;
  isRefreshing: boolean;
  isMutating: boolean;
  onCreateFolder: () => void;
  onRefresh: () => void;
  selectedItemPath: string | null;
  refreshKey: number;
  roots: ManagedRoot[];
  onNavigate: (path: string) => void;
  onOpenItemMenu: (item: FileItem, anchor: { x: number; y: number }) => void;
  onRootChange: (rootId: string) => void;
  onSelectFile: (item: FileItem) => void;
  onTriggerUpload: () => void;
};

const ROOT_CACHE_KEY = "__root__";

function getCacheKey(path: string): string {
  return path || ROOT_CACHE_KEY;
}

function getAncestorPaths(path: string): string[] {
  const parts = path.split("/").filter(Boolean);
  const result = [""];

  for (let index = 0; index < parts.length; index += 1) {
    result.push(parts.slice(0, index + 1).join("/"));
  }

  return result;
}

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths));
}

function sanitizeTestId(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "root"
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load items.";
}

function getItemIcon(item: FileItem): Icon {
  if (item.type === "directory") {
    return Folder;
  }

  if (item.mimeType?.startsWith("image/")) {
    return FileImage;
  }

  if (item.mimeType?.startsWith("video/")) {
    return FileVideo;
  }

  if (item.mimeType === "application/pdf") {
    return FilePdf;
  }

  if (
    item.mimeType?.includes("typescript") ||
    item.name.endsWith(".ts") ||
    item.name.endsWith(".tsx")
  ) {
    return FileTs;
  }

  if (
    item.mimeType?.includes("javascript") ||
    item.mimeType?.includes("json")
  ) {
    return FileJs;
  }

  if (item.name.endsWith(".css")) {
    return FileCss;
  }

  if (item.name.endsWith(".html") || item.name.endsWith(".htm")) {
    return FileHtml;
  }

  if (item.name.endsWith(".md") || item.name.endsWith(".markdown")) {
    return FileMd;
  }

  if (
    item.name.endsWith(".zip") ||
    item.name.endsWith(".tar") ||
    item.name.endsWith(".gz")
  ) {
    return FileZip;
  }

  if (
    item.mimeType?.startsWith("text/") ||
    item.editable ||
    item.editBlockedReason === "size-limit"
  ) {
    return FileText;
  }

  if (
    item.mimeType?.includes("xml") ||
    item.mimeType?.includes("yaml") ||
    item.name.endsWith(".yml") ||
    item.name.endsWith(".yaml")
  ) {
    return FileCode;
  }

  return FileIcon;
}

function getItemTone(item: FileItem): string {
  if (item.type === "directory") {
    return "text-amber-700";
  }

  if (item.mimeType?.startsWith("image/")) {
    return "text-sky-700";
  }

  if (item.mimeType?.startsWith("video/")) {
    return "text-violet-700";
  }

  if (item.editable) {
    return "text-emerald-700";
  }

  if (item.previewable) {
    return "text-blue-700";
  }

  return "text-muted";
}

type TreeActionButtonProps = {
  disabled?: boolean;
  icon: Icon;
  label: string;
  onClick: () => void;
  spinning?: boolean;
  testId: string;
};

function TreeActionButton({
  disabled = false,
  icon: IconComponent,
  label,
  onClick,
  spinning = false,
  testId,
}: TreeActionButtonProps) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={label}
        data-testid={testId}
        title={label}
        disabled={disabled}
        onClick={onClick}
        className={clsx(
          "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition duration-200 ease-out",
          disabled
            ? "cursor-not-allowed border-border bg-surface text-muted/50"
            : "border-border bg-surface text-ink hover:border-line-strong hover:bg-surface-alt",
        )}
      >
        <IconComponent
          className={clsx("h-4 w-4", spinning && "animate-spin")}
          weight="bold"
        />
      </button>
      <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 translate-y-1 rounded-lg bg-ink-strong px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-panel transition duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100">
        {label}
      </div>
    </div>
  );
}

export function FolderTree({
  activeRootId,
  canCreateInCurrentRoot,
  currentItems,
  currentPath,
  isRefreshing,
  isMutating,
  onCreateFolder,
  onRefresh,
  selectedItemPath,
  refreshKey,
  roots,
  onNavigate,
  onOpenItemMenu,
  onRootChange,
  onSelectFile,
  onTriggerUpload,
}: FolderTreeProps) {
  const { pick } = useI18n();
  const [itemCache, setItemCache] = useState<Record<string, FileItem[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<string[]>([""]);
  const [loadingKeys, setLoadingKeys] = useState<string[]>([]);
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const activeRootIdRef = useRef<string | null>(activeRootId);
  const cacheRef = useRef<Record<string, FileItem[]>>(itemCache);
  const loadingRef = useRef<string[]>(loadingKeys);

  useEffect(() => {
    activeRootIdRef.current = activeRootId;
  }, [activeRootId]);

  useEffect(() => {
    cacheRef.current = itemCache;
  }, [itemCache]);

  useEffect(() => {
    loadingRef.current = loadingKeys;
  }, [loadingKeys]);

  useEffect(() => {
    setItemCache({});
    setExpandedPaths([""]);
    setLoadingKeys([]);
    setLoadErrors({});
  }, [activeRootId, refreshKey]);

  const ensurePathLoaded = useCallback(async (path: string) => {
    const rootId = activeRootIdRef.current;
    const cacheKey = getCacheKey(path);

    if (!rootId) {
      return;
    }

    if (cacheRef.current[cacheKey] || loadingRef.current.includes(cacheKey)) {
      return;
    }

    setLoadingKeys((current) => uniquePaths([...current, cacheKey]));
    setLoadErrors((current) => {
      if (!current[cacheKey]) {
        return current;
      }

      const next = { ...current };
      delete next[cacheKey];
      return next;
    });

    try {
      const response = await getFilesList(rootId, path);

      if (activeRootIdRef.current !== rootId) {
        return;
      }

      setItemCache((current) => ({
        ...current,
        [cacheKey]: sortFileItems(response.items),
      }));
    } catch (error) {
      if (activeRootIdRef.current !== rootId) {
        return;
      }

      setLoadErrors((current) => ({
        ...current,
        [cacheKey]: getErrorMessage(error),
      }));
    } finally {
      if (activeRootIdRef.current !== rootId) {
        return;
      }

      setLoadingKeys((current) => current.filter((item) => item !== cacheKey));
    }
  }, []);

  useEffect(() => {
    if (!activeRootId) {
      return;
    }

    void ensurePathLoaded("");
  }, [activeRootId, ensurePathLoaded]);

  useEffect(() => {
    if (!activeRootId) {
      return;
    }

    const ancestorPaths = getAncestorPaths(currentPath);

    setItemCache((current) => ({
      ...current,
      [getCacheKey(currentPath)]: sortFileItems(currentItems),
    }));
    setExpandedPaths((current) => uniquePaths([...current, ...ancestorPaths]));

    ancestorPaths.forEach((path) => {
      if (path !== currentPath) {
        void ensurePathLoaded(path);
      }
    });
  }, [activeRootId, currentItems, currentPath, ensurePathLoaded]);

  const handleToggleExpanded = useCallback(
    (path: string) => {
      const cacheKey = getCacheKey(path);

      setExpandedPaths((current) => {
        if (current.includes(path)) {
          return current.filter((item) => item !== path);
        }

        return uniquePaths([...current, path]);
      });

      if (!cacheRef.current[cacheKey]) {
        void ensurePathLoaded(path);
      }
    },
    [ensurePathLoaded],
  );

  function ensureExpanded(path: string) {
    if (!expandedPaths.includes(path)) {
      handleToggleExpanded(path);
    }
  }

  function renderNode(item: FileItem, depth: number) {
    const isDirectory = item.type === "directory";
    const cacheKey = getCacheKey(item.path);
    const expanded = isDirectory ? expandedPaths.includes(item.path) : false;
    const isCurrentFolder = isDirectory && currentPath === item.path;
    const isAncestor = isDirectory && currentPath.startsWith(`${item.path}/`);
    const isSelectedFile = !isDirectory && selectedItemPath === item.path;
    const isLoading = isDirectory && loadingKeys.includes(cacheKey);
    const loadError = loadErrors[cacheKey];
    const children = itemCache[cacheKey] ?? [];
    const Icon =
      isDirectory && (expanded || isCurrentFolder)
        ? FolderOpen
        : getItemIcon(item);
    const indent = Math.max(depth, 0) * 14;
    const active = isCurrentFolder || isSelectedFile;

    return (
      <div
        key={item.path}
        data-testid={`tree-node-${sanitizeTestId(item.path)}`}
        className="space-y-1"
      >
        <div
          className="flex items-center gap-1"
          style={{ paddingLeft: `${indent}px` }}
        >
          {isDirectory ? (
            <button
              type="button"
              aria-label={expanded ? "Collapse folder" : "Expand folder"}
              onClick={() => handleToggleExpanded(item.path)}
              className={clsx(
                "inline-flex h-8 w-8 flex-none items-center justify-center rounded-xl transition duration-200 ease-out",
                active || isAncestor
                  ? "text-ink-strong hover:bg-white/60"
                  : "text-muted hover:bg-surface",
              )}
            >
              {expanded ? (
                <CaretDown className="h-4 w-4" weight="bold" />
              ) : (
                <CaretRight className="h-4 w-4" weight="bold" />
              )}
            </button>
          ) : (
            <span className="inline-flex h-8 w-8 flex-none" />
          )}

          <button
            type="button"
            onClick={() => {
              if (isDirectory) {
                ensureExpanded(item.path);
                onNavigate(item.path);
                return;
              }

              onSelectFile(item);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              onOpenItemMenu(item, { x: event.clientX, y: event.clientY });
            }}
            className={clsx(
              "group flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left transition duration-200 ease-out",
              active
                ? "bg-ink-strong text-white shadow-panel"
                : isAncestor
                  ? "bg-accent-soft text-ink-strong"
                  : "text-ink hover:bg-surface",
            )}
          >
            <Icon
              className={clsx(
                "h-4 w-4 flex-none",
                active ? "text-white" : getItemTone(item),
              )}
              weight={isDirectory ? "fill" : "regular"}
            />
            <span className="truncate text-sm font-medium">{item.name}</span>
          </button>

          <button
            type="button"
            data-testid={`tree-menu-${sanitizeTestId(item.path)}`}
            aria-label={`Open actions for ${item.name}`}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              onOpenItemMenu(item, {
                x: rect.right - 280,
                y: rect.bottom + 8,
              });
            }}
            className={clsx(
              "inline-flex h-8 w-8 flex-none items-center justify-center rounded-xl transition duration-200 ease-out",
              active
                ? "text-white/80 hover:bg-white/10 hover:text-white"
                : "text-muted hover:bg-surface hover:text-ink",
            )}
          >
            <DotsThree className="h-4 w-4" weight="bold" />
          </button>
        </div>

        {isDirectory && expanded ? (
          <div className="space-y-1">
            {isLoading ? (
              <div
                className="px-4 py-1 text-xs text-muted"
                style={{ paddingLeft: `${indent + 42}px` }}
              >
                Loading items...
              </div>
            ) : null}

            {loadError ? (
              <div
                className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning"
                style={{ marginLeft: `${indent + 42}px` }}
              >
                {loadError}
              </div>
            ) : null}

            {children.map((child) => renderNode(child, depth + 1))}

            {!isLoading && !loadError && children.length === 0 ? (
              <div
                className="px-4 py-1 text-xs text-muted"
                style={{ paddingLeft: `${indent + 42}px` }}
              >
                Empty folder
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  function renderRootNode(root: ManagedRoot) {
    const isActiveRoot = activeRootId === root.id;
    const isCurrentRoot = isActiveRoot && currentPath === "";
    const isRootContext =
      isActiveRoot && (currentPath !== "" || selectedItemPath !== null);
    const expanded = isActiveRoot && expandedPaths.includes("");
    const rootCacheKey = getCacheKey("");
    const rootItems = isActiveRoot ? (itemCache[rootCacheKey] ?? []) : [];
    const loadingRoot = isActiveRoot && loadingKeys.includes(rootCacheKey);
    const rootError = isActiveRoot ? loadErrors[rootCacheKey] : undefined;

    return (
      <div
        key={root.id}
        data-testid={`tree-root-${sanitizeTestId(root.id)}`}
        className="space-y-1"
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={
              expanded ? "Collapse mounted root" : "Expand mounted root"
            }
            onClick={() => {
              if (!isActiveRoot) {
                onRootChange(root.id);
                return;
              }

              handleToggleExpanded("");
            }}
            className={clsx(
              "inline-flex h-8 w-8 flex-none items-center justify-center rounded-xl transition duration-200 ease-out",
              isActiveRoot
                ? "text-ink-strong hover:bg-white/60"
                : "text-muted hover:bg-surface",
            )}
          >
            {expanded ? (
              <CaretDown className="h-4 w-4" weight="bold" />
            ) : (
              <CaretRight className="h-4 w-4" weight="bold" />
            )}
          </button>

          <button
            type="button"
            data-testid={`explorer-root-${sanitizeTestId(root.id)}`}
            onClick={() => {
              if (!isActiveRoot) {
                onRootChange(root.id);
                return;
              }

              ensureExpanded("");
              onNavigate("");
            }}
            className={clsx(
              "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition duration-200 ease-out",
              isCurrentRoot
                ? "bg-ink-strong text-white shadow-panel"
                : isRootContext
                  ? "bg-accent-soft text-ink-strong"
                  : "text-ink hover:bg-surface",
            )}
          >
            <HardDrive
              className={clsx(
                "h-4 w-4 flex-none",
                isCurrentRoot ? "text-white" : "text-accent",
              )}
              weight="fill"
            />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-medium">{root.label}</p>
                <span
                  className={clsx(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                    isCurrentRoot
                      ? "bg-white/12 text-white/78"
                      : root.readOnly
                        ? "bg-warning/10 text-warning"
                        : "bg-success/10 text-success",
                  )}
                >
                  {root.readOnly ? "RO" : "RW"}
                </span>
              </div>
              <p
                className={clsx(
                  "mt-1 truncate text-[11px]",
                  isCurrentRoot ? "text-white/70" : "text-muted",
                )}
              >
                {root.path ?? `/${root.id}`}
              </p>
            </div>
          </button>
        </div>

        {expanded ? (
          <div className="space-y-1">
            {loadingRoot ? (
              <div
                className="px-4 py-1 text-xs text-muted"
                style={{ paddingLeft: "42px" }}
              >
                {pick("加载中...", "Loading items...")}
              </div>
            ) : null}

            {rootError ? (
              <div
                className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning"
                style={{ marginLeft: "42px" }}
              >
                {rootError}
              </div>
            ) : null}

            {rootItems.map((item) => renderNode(item, 1))}

            {!loadingRoot && !rootError && rootItems.length === 0 ? (
              <div
                className="rounded-[18px] border border-dashed border-border bg-surface px-4 py-4 text-sm text-muted"
                style={{ marginLeft: "42px" }}
              >
                {pick("当前挂载目录还没有文件。", "No files in this managed root yet.")}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <aside className="panel-elevated flex min-h-[calc(100vh-9rem)] flex-col overflow-hidden p-0">
      <div className="border-b border-border bg-canvas/80 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              <TreeStructure className="h-4 w-4" weight="bold" />
              {pick("文件树", "File Tree")}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TreeActionButton
              disabled={!activeRootId}
              icon={ArrowClockwise}
              label={
                activeRootId
                  ? pick("刷新当前根目录", "Refresh current root")
                  : pick("请先选择根目录", "Select a root first")
              }
              onClick={onRefresh}
              spinning={isRefreshing}
              testId="explorer-refresh"
            />
            <TreeActionButton
              disabled={!canCreateInCurrentRoot || isMutating}
              icon={UploadSimple}
              label={
                canCreateInCurrentRoot
                  ? pick("上传文件", "Upload file")
                  : activeRootId
                    ? pick("当前根目录只读", "Current root is read-only")
                    : pick("请先选择根目录", "Select a root first")
              }
              onClick={onTriggerUpload}
              testId="tree-action-upload"
            />
            <TreeActionButton
              disabled={!canCreateInCurrentRoot || isMutating}
              icon={FolderPlus}
              label={
                canCreateInCurrentRoot
                  ? pick("新建文件夹", "New folder")
                  : activeRootId
                    ? pick("当前根目录只读", "Current root is read-only")
                    : pick("请先选择根目录", "Select a root first")
              }
              onClick={onCreateFolder}
              testId="tree-action-new-folder"
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {roots.length > 0 ? (
          <div className="space-y-2">
            {roots.map((root) => renderRootNode(root))}
          </div>
        ) : (
          <div className="rounded-[18px] border border-dashed border-border bg-surface px-4 py-6 text-sm text-muted">
            {pick("当前没有可用的挂载目录。", "No managed roots available.")}
          </div>
        )}
      </div>
    </aside>
  );
}
