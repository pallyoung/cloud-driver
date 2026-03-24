import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import type { FileItem } from "@cloud-driver/shared";
import clsx from "clsx";
import {
  CaretRight,
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
  MagnifyingGlass,
  type Icon,
} from "@phosphor-icons/react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FileWorkspacePanel,
  type DetailMode,
} from "../../components/files/file-workspace-panel";
import {
  ExplorerDialogs,
  type ExplorerDialogState,
} from "../../components/files/explorer-dialogs";
import {
  FileActionsMenu,
  type FileActionsMenuEntry,
} from "../../components/files/file-actions-menu";
import { FolderTree } from "../../components/files/folder-tree";
import { getDownloadUrl } from "../../lib/api/client";
import { useI18n } from "../../hooks/use-i18n";
import { sortFileItems } from "../../lib/file-items";
import {
  activeRootIdState,
  authStatusState,
  createExportForSelectedAction,
  createFolderAction,
  currentPathState,
  discardEditorChangesAction,
  editorContentState,
  editorErrorState,
  editorLineEndingState,
  editorLoadingState,
  editorModifiedAtState,
  editorOriginalContentState,
  editorSavingState,
  fileItemsState,
  fileMutationErrorState,
  fileMutationPendingState,
  filesErrorState,
  filesLoadingState,
  loadFilesAction,
  loadSelectedFileContentAction,
  managedRootsState,
  moveSelectedItemAction,
  renameSelectedItemAction,
  saveSelectedFileContentAction,
  searchKeywordState,
  selectItemAction,
  selectedItemPathState,
  selectedItemState,
  setActiveRootAction,
  setCurrentPathAction,
  setEditorContentAction,
  setSearchKeywordAction,
  settingsState,
  setJobsFocusTargetAction,
  deleteSelectedItemAction,
  uploadFileAction,
} from "../../state/app-state";
import { useActions, useRelaxState, useRelaxValue } from "../../state/relax";

function formatSize(size: number | null): string {
  if (size == null) {
    return "--";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getItemLabel(item: FileItem, isChinese: boolean): string {
  if (item.type === "directory") {
    return isChinese ? "文件夹" : "Folder";
  }

  if (
    item.mimeType?.startsWith("text/") ||
    item.editable ||
    item.editBlockedReason === "size-limit"
  ) {
    return isChinese ? "文本文件" : "Text File";
  }

  if (item.mimeType?.startsWith("image/")) {
    return isChinese ? "图片" : "Image";
  }

  if (item.mimeType?.startsWith("video/")) {
    return isChinese ? "视频" : "Video";
  }

  if (item.mimeType === "application/pdf") {
    return isChinese ? "PDF" : "PDF";
  }

  return isChinese ? "文件" : "File";
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

function getItemIconTone(item: FileItem): string {
  if (item.type === "directory") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-700";
  }

  if (item.mimeType?.startsWith("image/")) {
    return "border-sky-500/20 bg-sky-500/10 text-sky-700";
  }

  if (item.mimeType?.startsWith("video/")) {
    return "border-violet-500/20 bg-violet-500/10 text-violet-700";
  }

  if (item.editable) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
  }

  if (item.previewable) {
    return "border-blue-500/20 bg-blue-500/10 text-blue-700";
  }

  return "border-border bg-canvas text-muted";
}

function canPreviewFile(item?: FileItem): boolean {
  if (!item || item.type !== "file") {
    return false;
  }

  return (
    item.editable ||
    item.previewable ||
    item.mimeType?.startsWith("image/") === true ||
    item.mimeType === "application/pdf" ||
    item.mimeType?.startsWith("video/") === true
  );
}

function getParentPath(currentPath: string): string {
  if (!currentPath) {
    return "";
  }

  const parts = currentPath.split("/").filter(Boolean);
  return parts.slice(0, -1).join("/");
}

function buildBreadcrumbs(currentPath: string) {
  const parts = currentPath.split("/").filter(Boolean);
  return parts.map((part, index) => ({
    label: part,
    path: parts.slice(0, index + 1).join("/"),
  }));
}

function normalizeTargetDirectoryPath(value: string): string {
  const trimmed = value.trim();
  return trimmed === "/" ? "" : trimmed;
}

function sanitizeTestId(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "root"
  );
}

function getDefaultDetailMode(item?: FileItem): DetailMode {
  if (!item) {
    return "details";
  }

  if (item.type === "file" && item.editable) {
    return "edit";
  }

  if (item.type === "file" && item.previewable) {
    return "preview";
  }

  return "details";
}

type NonUnsavedDialog = Exclude<ExplorerDialogState, { type: "unsaved" }>;

type PendingIntent =
  | { kind: "root"; rootId: string }
  | { kind: "navigate"; nextPath: string }
  | { kind: "select"; item: FileItem | null }
  | { kind: "dialog"; dialog: NonUnsavedDialog };

type ContextMenuState = {
  anchor: {
    x: number;
    y: number;
  };
  item: FileItem;
};

type ExplorerRouteIntent = {
  rootId: string;
  path: string;
  selectPath: string | null;
};

export function ExplorerPage() {
  const { formatDate, isChinese, pick } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const suppressNextRowClickPathRef = useRef<string | null>(null);
  const authStatus = useRelaxValue(authStatusState);
  const roots = useRelaxValue(managedRootsState);
  const activeRootId = useRelaxValue(activeRootIdState);
  const currentPath = useRelaxValue(currentPathState);
  const fileItems = useRelaxValue(fileItemsState);
  const selectedItemPath = useRelaxValue(selectedItemPathState);
  const selectedItem = useRelaxValue(selectedItemState) ?? undefined;
  const isLoading = useRelaxValue(filesLoadingState);
  const filesError = useRelaxValue(filesErrorState);
  const fileMutationError = useRelaxValue(fileMutationErrorState);
  const fileMutationPending = useRelaxValue(fileMutationPendingState);
  const editorContent = useRelaxValue(editorContentState);
  const editorOriginalContent = useRelaxValue(editorOriginalContentState);
  const editorError = useRelaxValue(editorErrorState);
  const editorLineEnding = useRelaxValue(editorLineEndingState);
  const editorLoading = useRelaxValue(editorLoadingState);
  const editorSaving = useRelaxValue(editorSavingState);
  const editorModifiedAt = useRelaxValue(editorModifiedAtState);
  const settings = useRelaxValue(settingsState);
  const [searchKeyword] = useRelaxState(searchKeywordState);
  const [detailMode, setDetailMode] = useState<DetailMode>("details");
  const [dialog, setDialog] = useState<ExplorerDialogState | null>(null);
  const [pendingIntent, setPendingIntent] = useState<PendingIntent | null>(
    null,
  );
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [routeIntent, setRouteIntent] = useState<ExplorerRouteIntent | null>(
    null,
  );
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);
  const [
    setActiveRoot,
    setSearchKeyword,
    loadFiles,
    setCurrentPath,
    selectItem,
    loadSelectedFileContent,
    setEditorContent,
    discardEditorChanges,
    saveSelectedFileContent,
    createFolder,
    renameSelectedItem,
    deleteSelectedItem,
    moveSelectedItem,
    uploadFile,
    createExportForSelected,
    setJobsFocusTarget,
  ] = useActions([
    setActiveRootAction,
    setSearchKeywordAction,
    loadFilesAction,
    setCurrentPathAction,
    selectItemAction,
    loadSelectedFileContentAction,
    setEditorContentAction,
    discardEditorChangesAction,
    saveSelectedFileContentAction,
    createFolderAction,
    renameSelectedItemAction,
    deleteSelectedItemAction,
    moveSelectedItemAction,
    uploadFileAction,
    createExportForSelectedAction,
    setJobsFocusTargetAction,
  ] as const);

  const activeRoot = useMemo(
    () => roots.find((root) => root.id === activeRootId),
    [activeRootId, roots],
  );
  const items = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    const source = !keyword
      ? fileItems
      : fileItems.filter((item) => {
          const typeLabel = item.type === "directory" ? "folder" : "file";
          return (
            item.name.toLowerCase().includes(keyword) ||
            typeLabel.includes(keyword) ||
            (item.mimeType ?? "").toLowerCase().includes(keyword)
          );
        });

    return sortFileItems(source);
  }, [fileItems, searchKeyword]);
  const editorDirty = editorContent !== editorOriginalContent;
  const breadcrumbs = buildBreadcrumbs(currentPath);
  const activeFile = selectedItem?.type === "file" ? selectedItem : undefined;
  const canActiveFilePreview = canPreviewFile(activeFile);
  const canActiveFileEdit = Boolean(activeFile?.editable);
  const isSelectedItemEditable = Boolean(activeFile?.editable && activeRootId);
  const canMutate = Boolean(activeRootId) && !activeRoot?.readOnly;
  const directoryCount = items.filter(
    (item) => item.type === "directory",
  ).length;
  const fileCount = items.length - directoryCount;
  const currentDirectoryLabel = breadcrumbs.at(-1)?.label ?? "Root";

  useEffect(() => {
    if (authStatus !== "authenticated" || !activeRootId) {
      return;
    }

    void loadFiles({
      rootId: activeRootId,
      path: currentPath,
    });
  }, [activeRootId, authStatus, currentPath, loadFiles]);

  useEffect(() => {
    if (!isSelectedItemEditable) {
      return;
    }

    void loadSelectedFileContent();
  }, [isSelectedItemEditable, loadSelectedFileContent, selectedItem?.path]);

  useEffect(() => {
    if (!editorDirty) {
      return;
    }

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editorDirty]);

  useEffect(() => {
    setDetailMode(getDefaultDetailMode(selectedItem));
  }, [
    selectedItem?.editable,
    selectedItem?.path,
    selectedItem?.previewable,
    selectedItem?.type,
  ]);

  useEffect(() => {
    setContextMenu(null);
  }, [activeRootId, currentPath]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetRootId = params.get("root");

    if (!targetRootId) {
      return;
    }

    setRouteIntent({
      rootId: targetRootId,
      path: params.get("path") ?? "",
      selectPath: params.get("select"),
    });
    navigate("/explorer", { replace: true });
  }, [location.search, navigate]);

  useEffect(() => {
    if (!routeIntent || authStatus !== "authenticated" || roots.length === 0) {
      return;
    }

    const rootExists = roots.some((root) => root.id === routeIntent.rootId);

    if (!rootExists) {
      setRouteIntent(null);
      return;
    }

    if (activeRootId !== routeIntent.rootId) {
      setActiveRoot(routeIntent.rootId);
      return;
    }

    if (currentPath !== routeIntent.path) {
      setCurrentPath(routeIntent.path);
      return;
    }

    if (!routeIntent.selectPath) {
      setRouteIntent(null);
      return;
    }

    if (selectedItem?.path === routeIntent.selectPath) {
      setRouteIntent(null);
      return;
    }

    const nextSelectedItem = fileItems.find(
      (item) => item.path === routeIntent.selectPath,
    );

    if (!nextSelectedItem) {
      if (!isLoading) {
        setRouteIntent(null);
      }
      return;
    }

    selectItem({
      path: nextSelectedItem.path,
      item: nextSelectedItem,
    });
    setRouteIntent(null);
  }, [
    activeRootId,
    authStatus,
    currentPath,
    fileItems,
    isLoading,
    roots,
    routeIntent,
    selectItem,
    selectedItem?.path,
    setActiveRoot,
    setCurrentPath,
  ]);

  const handleSaveEditor = useCallback(async () => {
    await saveSelectedFileContent();
  }, [saveSelectedFileContent]);

  useEffect(() => {
    if (!isSelectedItemEditable) {
      return;
    }

    const handler = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) {
        return;
      }

      if (event.key.toLowerCase() !== "s") {
        return;
      }

      event.preventDefault();

      if (editorDirty && !editorSaving) {
        void handleSaveEditor();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editorDirty, editorSaving, handleSaveEditor, isSelectedItemEditable]);

  function closeDialog() {
    setDialog(null);
    setPendingIntent(null);
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  function executeIntent(intent: PendingIntent) {
    closeContextMenu();

    switch (intent.kind) {
      case "root":
        setActiveRoot(intent.rootId);
        return;
      case "navigate":
        setCurrentPath(intent.nextPath);
        return;
      case "select":
        selectItem({
          path: intent.item?.path ?? null,
          item: intent.item,
        });
        return;
      case "dialog":
        setDialog(intent.dialog);
        return;
    }
  }

  function runWithUnsavedGuard(intent: PendingIntent) {
    closeContextMenu();

    if (!editorDirty) {
      executeIntent(intent);
      return;
    }

    setPendingIntent(intent);
    setDialog({ type: "unsaved" });
  }

  function openDialog(nextDialog: NonUnsavedDialog) {
    runWithUnsavedGuard({
      kind: "dialog",
      dialog: nextDialog,
    });
  }

  function handleRootChange(rootId: string) {
    if (rootId === activeRootId) {
      return;
    }

    runWithUnsavedGuard({ kind: "root", rootId });
  }

  function handleNavigate(nextPath: string) {
    if (nextPath === currentPath) {
      if (selectedItem) {
        runWithUnsavedGuard({ kind: "select", item: null });
      }

      return;
    }

    runWithUnsavedGuard({ kind: "navigate", nextPath });
  }

  function handleSelect(item: FileItem | null) {
    if (item?.path === selectedItem?.path) {
      return;
    }

    runWithUnsavedGuard({ kind: "select", item });
  }

  function handleShowDirectory() {
    if (!selectedItem) {
      return;
    }

    runWithUnsavedGuard({ kind: "select", item: null });
  }

  function handleCreateFolder() {
    closeContextMenu();
    setDialog({
      type: "create-folder",
      name: "",
    });
  }

  function prepareItemAction(item: FileItem) {
    if (selectedItem?.path !== item.path) {
      selectItem({
        path: item.path,
        item,
      });
    }
  }

  function handleRenameItem(item: FileItem) {
    prepareItemAction(item);
    openDialog({
      type: "rename",
      newName: item.name,
    });
  }

  function handleMoveItem(item: FileItem) {
    prepareItemAction(item);
    openDialog({
      type: "move",
      targetDirPath: getParentPath(item.path) || "/",
    });
  }

  function handleDeleteItem(item: FileItem) {
    prepareItemAction(item);
    openDialog({ type: "delete" });
  }

  function handleExportItem(item: FileItem) {
    prepareItemAction(item);
    openDialog({ type: "export" });
  }

  function handleOpenItemMode(item: FileItem, mode: DetailMode) {
    closeContextMenu();
    prepareItemAction(item);
    setDetailMode(mode);
  }

  function triggerDownload(item: FileItem) {
    if (!activeRootId || item.type !== "file") {
      return;
    }

    closeContextMenu();
    window.location.assign(getDownloadUrl(activeRootId, item.path));
  }

  function handleOpenContextMenu(
    item: FileItem,
    anchor: { x: number; y: number },
  ) {
    suppressNextRowClickPathRef.current = item.path;
    requestAnimationFrame(() => {
      if (suppressNextRowClickPathRef.current === item.path) {
        suppressNextRowClickPathRef.current = null;
      }
    });

    if (selectedItem?.path !== item.path) {
      if (editorDirty) {
        runWithUnsavedGuard({ kind: "select", item });
        return;
      }

      selectItem({
        path: item.path,
        item,
      });
    }

    setContextMenu({ anchor, item });
  }

  async function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const success = await uploadFile({ file });

    if (success) {
      setTreeRefreshKey((current) => current + 1);
    }
  }

  async function handleConfirmUnsaved() {
    const nextIntent = pendingIntent;
    setDialog(null);
    setPendingIntent(null);
    discardEditorChanges();

    if (nextIntent) {
      executeIntent(nextIntent);
    }
  }

  async function handleConfirmCreateFolder(name: string) {
    const success = await createFolder({ name: name.trim() });

    if (success) {
      setTreeRefreshKey((current) => current + 1);
      closeDialog();
    }
  }

  async function handleConfirmRename(newName: string) {
    const success = await renameSelectedItem({ newName: newName.trim() });

    if (success) {
      setTreeRefreshKey((current) => current + 1);
      closeDialog();
    }
  }

  async function handleConfirmMove(targetDirPath: string) {
    const success = await moveSelectedItem({
      targetDirPath: normalizeTargetDirectoryPath(targetDirPath),
    });

    if (success) {
      setTreeRefreshKey((current) => current + 1);
      closeDialog();
    }
  }

  async function handleConfirmDelete() {
    const success = await deleteSelectedItem();

    if (success) {
      setTreeRefreshKey((current) => current + 1);
      closeDialog();
    }
  }

  async function handleConfirmExport() {
    const result = await createExportForSelected();

    if (!result) {
      return;
    }

    closeDialog();

    if (result.kind === "file") {
      window.location.assign(getDownloadUrl(result.rootId, result.path));
      return;
    }

    setJobsFocusTarget({ kind: "Export", id: result.id });
    navigate("/jobs");
  }

  const contextMenuEntries = useMemo<FileActionsMenuEntry[]>(() => {
    const item = contextMenu?.item;

    if (!item) {
      return [];
    }

    const readOnly = Boolean(activeRoot?.readOnly);
    const entries: FileActionsMenuEntry[] = [];

    if (item.type === "directory") {
      entries.push({
        id: "open-folder",
        label: pick("打开文件夹", "Open folder"),
        description: pick(
          "切换当前目录，并在主内容区查看该文件夹内容。",
          "Switch to this directory and inspect its contents in the main workspace.",
        ),
        onSelect: () => handleNavigate(item.path),
      });
      entries.push({
        id: "export",
        label: pick("导出文件夹", "Export folder"),
        description: pick(
          "先打包为 zip，再转入任务中心下载。",
          "Package the folder as a zip first, then download it from Task Center.",
        ),
        onSelect: () => handleExportItem(item),
      });
      entries.push({ kind: "separator", id: "folder-divider" });
      entries.push({
        id: "rename",
        label: pick("重命名", "Rename"),
        description: pick(
          "更新文件夹名称，目录结构保持同步。",
          "Update the folder name while keeping the structure in sync.",
        ),
        disabled: readOnly,
        onSelect: () => handleRenameItem(item),
      });
      entries.push({
        id: "move",
        label: pick("移动", "Move"),
        description: pick(
          "移动到同一挂载根目录下的其他目录。",
          "Move the folder to another directory inside the same managed root.",
        ),
        disabled: readOnly,
        onSelect: () => handleMoveItem(item),
      });
      entries.push({
        id: "delete",
        label: pick("删除", "Delete"),
        description: pick(
          "立即删除该文件夹及其内容。",
          "Delete this folder and its contents immediately.",
        ),
        destructive: true,
        disabled: readOnly,
        onSelect: () => handleDeleteItem(item),
      });
      return entries;
    }

    if (item.editable) {
      entries.push({
        id: "open-editor",
        label: pick("打开编辑", "Open in editor"),
        description: pick(
          "在右侧主内容区直接编辑并保存。",
          "Edit and save the file directly in the main workspace.",
        ),
        onSelect: () => handleOpenItemMode(item, "edit"),
      });
    } else if (item.previewable) {
      entries.push({
        id: "open-preview",
        label: pick("打开预览", "Open preview"),
        description: pick(
          "在右侧主内容区内联预览当前文件。",
          "Preview the current file inline in the main workspace.",
        ),
        onSelect: () => handleOpenItemMode(item, "preview"),
      });
    }

    entries.push({
      id: "download",
      label: pick("下载文件", "Download file"),
      description: pick("浏览器直接下载原始文件。", "Download the original file directly in the browser."),
      onSelect: () => triggerDownload(item),
    });
    entries.push({ kind: "separator", id: "file-divider" });
    entries.push({
      id: "rename",
      label: pick("重命名", "Rename"),
      description: pick(
        "修改文件名，不改变所在目录。",
        "Change the file name without moving it to another directory.",
      ),
      disabled: readOnly,
      onSelect: () => handleRenameItem(item),
    });
    entries.push({
      id: "move",
      label: pick("移动", "Move"),
      description: pick(
        "移动到同一挂载根目录下的其他目录。",
        "Move the file to another directory inside the same managed root.",
      ),
      disabled: readOnly,
      onSelect: () => handleMoveItem(item),
    });
    entries.push({
      id: "delete",
      label: pick("删除", "Delete"),
      description: pick(
        "从服务器目录中永久删除。",
        "Permanently delete the file from the server directory.",
      ),
      destructive: true,
      disabled: readOnly,
      onSelect: () => handleDeleteItem(item),
    });

    return entries;
  }, [
    activeRoot?.readOnly,
    contextMenu?.item,
    handleDeleteItem,
    handleExportItem,
    handleMoveItem,
    handleNavigate,
    handleOpenItemMode,
    handleRenameItem,
    pick,
    triggerDownload,
  ]);

  return (
    <>
      <div className="grid min-h-[calc(100vh-9rem)] gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
        <FolderTree
          activeRootId={activeRootId}
          canCreateInCurrentRoot={canMutate}
          currentItems={fileItems}
          currentPath={currentPath}
          isRefreshing={isLoading}
          isMutating={fileMutationPending}
          onCreateFolder={handleCreateFolder}
          onRefresh={() =>
            void loadFiles({
              rootId: activeRootId ?? "",
              path: currentPath,
            })
          }
          selectedItemPath={activeFile?.path ?? null}
          onNavigate={handleNavigate}
          onOpenItemMenu={handleOpenContextMenu}
          onRootChange={handleRootChange}
          onSelectFile={handleSelect}
          onTriggerUpload={() => uploadInputRef.current?.click()}
          refreshKey={treeRefreshKey}
          roots={roots}
        />

        <section className="panel-elevated overflow-hidden p-0">
          <div className="border-b border-border bg-canvas/80 px-4 py-3 sm:px-5">
            <input
              ref={uploadInputRef}
              type="file"
              className="hidden"
              onChange={(event) => void handleUploadChange(event)}
            />

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 flex flex-wrap items-center gap-2 text-xs text-muted">
                {activeRoot ? (
                  <span
                    className={
                      activeRoot.readOnly
                        ? "chip chip-warning"
                        : "chip chip-success"
                    }
                  >
                    {activeRoot.readOnly ? pick("只读根目录", "Read-only root") : pick("可写根目录", "Writable root")}
                  </span>
                ) : null}
                <button
                  type="button"
                  data-testid="explorer-breadcrumb-root"
                  onClick={() => {
                    if (currentPath === "" && selectedItem) {
                      handleShowDirectory();
                      return;
                    }

                    handleNavigate("");
                  }}
                  className={clsx(
                    "rounded-full border px-3 py-1.5 font-medium transition duration-200 ease-out",
                    currentPath === ""
                      ? "border-ink-strong bg-ink-strong text-white"
                      : "border-border bg-surface text-ink hover:border-line-strong hover:bg-surface-alt",
                  )}
                >
                  {pick("根目录", "root")}
                </button>
                {breadcrumbs.map((crumb) => (
                  <div key={crumb.path} className="flex items-center gap-2">
                    <CaretRight
                      className="h-3.5 w-3.5 text-muted"
                      weight="bold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (crumb.path === currentPath && selectedItem) {
                          handleShowDirectory();
                          return;
                        }

                        handleNavigate(crumb.path);
                      }}
                      className={clsx(
                        "rounded-full border px-3 py-1.5 font-medium transition duration-200 ease-out",
                        crumb.path === currentPath
                          ? "border-ink-strong bg-ink-strong text-white"
                          : "border-border bg-surface text-ink hover:border-line-strong hover:bg-surface-alt",
                      )}
                    >
                      {crumb.label}
                    </button>
                  </div>
                ))}
                  <span className="truncate text-base font-semibold text-ink-strong">
                  {activeFile?.name ?? currentDirectoryLabel}
                </span>
              </div>

              {activeFile ? (
                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  <button
                    type="button"
                    data-testid="detail-mode-preview"
                    disabled={!canActiveFilePreview}
                    onClick={() => setDetailMode("preview")}
                    className={clsx(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition duration-200 ease-out",
                      detailMode === "preview"
                        ? "border-ink-strong bg-ink-strong text-white"
                        : "border-border bg-surface text-ink hover:border-line-strong hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40",
                    )}
                  >
                    {pick("预览", "Preview")}
                  </button>
                  <button
                    type="button"
                    data-testid="detail-mode-edit"
                    disabled={!canActiveFileEdit}
                    onClick={() => setDetailMode("edit")}
                    className={clsx(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition duration-200 ease-out",
                      detailMode === "edit"
                        ? "border-ink-strong bg-ink-strong text-white"
                        : "border-border bg-surface text-ink hover:border-line-strong hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40",
                    )}
                  >
                    {pick("编辑", "Edit")}
                    {detailMode !== "edit" && editorDirty ? (
                      <span className="h-2 w-2 rounded-full bg-warning" />
                    ) : null}
                  </button>
                  {canActiveFileEdit ? (
                    <button
                      type="button"
                      data-testid="editor-save"
                      onClick={() => void handleSaveEditor()}
                      disabled={!editorDirty || editorSaving}
                      className="action-button action-button-primary"
                    >
                      {editorSaving ? pick("保存中...", "Saving...") : pick("保存", "Save")}
                    </button>
                  ) : null}
                  {canActiveFileEdit ? (
                    <button
                      type="button"
                      data-testid="editor-discard"
                      onClick={() => discardEditorChanges()}
                      disabled={!editorDirty || editorSaving}
                      className="action-button"
                    >
                      {pick("放弃修改", "Discard")}
                    </button>
                  ) : null}
                  <span className="chip chip-neutral">
                    {getItemLabel(activeFile, isChinese)}
                  </span>
                  <span className="chip chip-neutral">
                    {formatSize(activeFile.size)}
                  </span>
                  <span
                    className={
                      activeFile.editable
                        ? "chip chip-success"
                        : "chip chip-neutral"
                    }
                  >
                    {activeFile.editable
                      ? pick("可编辑", "Editable")
                      : activeFile.previewable
                        ? pick("仅预览", "Preview only")
                        : pick("仅下载", "Download only")}
                  </span>
                  <span className="chip chip-neutral">
                    {pick(`修改于 ${formatDate(activeFile.modifiedAt)}`, `Modified ${formatDate(activeFile.modifiedAt)}`)}
                  </span>
                </div>
              ) : (
                <div className="flex min-w-0 flex-col gap-3 xl:min-w-[520px] xl:flex-row xl:items-center xl:justify-end">
                  <label className="relative block xl:min-w-[280px] xl:flex-1">
                    <MagnifyingGlass className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      data-testid="explorer-search"
                      value={searchKeyword}
                      onChange={(event) => setSearchKeyword(event.target.value)}
                      placeholder={pick("搜索当前目录", "Search current directory")}
                      className="input-soft pl-11"
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    <span className="chip chip-neutral">
                      {pick(`${items.length} 项`, `${items.length} items`)}
                    </span>
                    <span className="chip chip-neutral">
                      {pick(`${directoryCount} 个文件夹`, `${directoryCount} folders`)}
                    </span>
                    <span className="chip chip-neutral">{pick(`${fileCount} 个文件`, `${fileCount} files`)}</span>
                  </div>
                </div>
              )}
            </div>

            {filesError ? (
              <div className="mt-4 rounded-[22px] border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                {filesError}
              </div>
            ) : null}

            {fileMutationError ? (
              <div className="mt-4 rounded-[22px] border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
                {fileMutationError}
              </div>
            ) : null}
          </div>

          <div className="min-h-[calc(100vh-18rem)]">
            {activeFile ? (
              <div className="min-h-full overflow-hidden bg-canvas/40">
                <FileWorkspacePanel
                  activeRootId={activeRootId}
                  detailMode={detailMode}
                  editorContent={editorContent}
                  editorDirty={editorDirty}
                  editorError={editorError}
                  editorLineEnding={editorLineEnding}
                  editorLoading={editorLoading}
                  editorModifiedAt={editorModifiedAt}
                  editorSaving={editorSaving}
                  onEditorContentChange={setEditorContent}
                  selectedItem={activeFile}
                />
              </div>
            ) : (
              <div className="flex min-h-full flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
                  <div className="space-y-2">
                    {searchKeyword.trim() ? (
                      <div className="flex justify-end pb-1">
                        <div className="chip chip-neutral">
                          {pick(`筛选中：“${searchKeyword.trim()}”`, `Filtering by “${searchKeyword.trim()}”`)}
                        </div>
                      </div>
                    ) : null}

                    <div className="hidden items-center gap-3 rounded-[16px] border border-border bg-canvas/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted lg:grid lg:grid-cols-[minmax(0,1fr)_148px_88px]">
                      <span>{pick("名称", "Name")}</span>
                      <span>{pick("修改时间", "Modified")}</span>
                      <span>{pick("大小", "Size")}</span>
                    </div>

                    {isLoading ? (
                      <div className="rounded-[16px] border border-border bg-surface px-4 py-8 text-sm text-muted">
                        {pick("文件加载中...", "Loading files...")}
                      </div>
                    ) : items.length > 0 ? (
                      items.map((item) => {
                        const isSelected = selectedItemPath === item.path;
                        const Icon = getItemIcon(item);

                        return (
                          <article
                            key={item.path}
                            data-path={item.path}
                            data-testid={`explorer-row-${sanitizeTestId(item.path)}`}
                            onClick={() => {
                              if (
                                suppressNextRowClickPathRef.current ===
                                item.path
                              ) {
                                suppressNextRowClickPathRef.current = null;
                                return;
                              }

                              if (item.type === "directory") {
                                handleNavigate(item.path);
                                return;
                              }

                              handleSelect(item);
                            }}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              handleOpenContextMenu(item, {
                                x: event.clientX,
                                y: event.clientY,
                              });
                            }}
                            className={clsx(
                              "group grid cursor-pointer gap-3 rounded-[16px] border px-3 py-3 transition duration-150 ease-out lg:grid-cols-[minmax(0,1fr)_148px_88px] lg:items-center",
                              isSelected
                                ? "border-accent/25 bg-accent-soft shadow-panel"
                                : "border-border bg-surface hover:border-line-strong hover:bg-surface-alt",
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                className={clsx(
                                  "flex h-10 w-10 flex-none items-center justify-center rounded-[14px] border",
                                  getItemIconTone(item),
                                )}
                              >
                                <Icon
                                  className="h-5 w-5"
                                  weight={
                                    item.type === "directory"
                                      ? "fill"
                                      : "regular"
                                  }
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-ink-strong">
                                    {item.name}
                                  </p>
                                  {item.type === "directory" ? (
                                    <CaretRight
                                      className="h-3.5 w-3.5 flex-none text-muted transition group-hover:text-accent"
                                      weight="bold"
                                    />
                                  ) : null}
                                </div>
                                <p className="mt-1 truncate text-xs text-muted">
                                  {getItemLabel(item, isChinese)}
                                  {item.type === "file" && item.mimeType
                                    ? ` · ${item.mimeType}`
                                    : ""}
                                </p>
                              </div>
                            </div>

                            <div className="pointer-events-none flex items-center justify-between gap-3 lg:block">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted lg:hidden">
                                {pick("修改时间", "Modified")}
                              </p>
                              <p className="text-sm text-muted">
                                {formatDate(item.modifiedAt)}
                              </p>
                            </div>

                            <div className="pointer-events-none flex items-center justify-between gap-3 lg:block">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted lg:hidden">
                                {pick("大小", "Size")}
                              </p>
                              <p className="font-mono text-xs text-muted">
                                {formatSize(item.size)}
                              </p>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <div className="rounded-[16px] border border-dashed border-border bg-surface px-4 py-10">
                        <p className="font-medium text-ink-strong">
                          {pick("当前目录为空", "No items in this directory")}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted">
                          {searchKeyword.trim()
                            ? pick("试试其他关键词，或者清除当前筛选。", "Try a different keyword, or clear the current filter.")
                            : pick("可以上传文件、新建文件夹，或切换到其他根目录。", "Upload a file, create a folder, or switch to another root.")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {contextMenu ? (
        <FileActionsMenu
          anchor={contextMenu.anchor}
          entries={contextMenuEntries}
          itemName={contextMenu.item.name}
          onClose={closeContextMenu}
        />
      ) : null}

      <ExplorerDialogs
        dialog={dialog}
        isBusy={fileMutationPending}
        selectedItem={selectedItem}
        exportTtlMinutes={settings?.exportTtlMinutes ?? null}
        onClose={closeDialog}
        onConfirmUnsaved={() => void handleConfirmUnsaved()}
        onConfirmCreateFolder={handleConfirmCreateFolder}
        onConfirmRename={handleConfirmRename}
        onConfirmMove={handleConfirmMove}
        onConfirmDelete={handleConfirmDelete}
        onConfirmExport={handleConfirmExport}
      />
    </>
  );
}
