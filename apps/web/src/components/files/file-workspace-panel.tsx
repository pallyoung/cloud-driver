import { useEffect, useState, type ReactNode } from "react";
import type { FileItem } from "@cloud-driver/shared";
import clsx from "clsx";
import { Sparkles, WrapText } from "lucide-react";
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  ArrowsIn,
  ArrowsOut,
  DownloadSimple,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
} from "@phosphor-icons/react";
import {
  CodeEditor,
  canFormatInBrowser,
  formatContentInBrowser,
  getDefaultWrapMode,
  getEditorFormatLabel,
  getEditorLanguageLabel,
} from "./code-editor";
import { getDownloadUrl, getPreviewUrl } from "../../lib/api/client";
import { useI18n } from "../../hooks/use-i18n";

export type DetailMode = "details" | "preview" | "edit";

type FileWorkspacePanelProps = {
  activeRootId: string | null;
  detailMode: DetailMode;
  editorContent: string;
  editorDirty: boolean;
  editorError: string | null;
  editorLineEnding: "lf" | "crlf" | null;
  editorLoading: boolean;
  editorModifiedAt: string | null;
  editorSaving: boolean;
  onEditorContentChange: (content: string) => void;
  selectedItem?: FileItem;
};

type ImagePresentation = "fit" | "actual";

type ToolbarIconButtonProps = {
  active?: boolean;
  ariaLabel: string;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  pressed?: boolean;
  testId: string;
  title: string;
};

function ToolbarIconButton({
  active = false,
  ariaLabel,
  children,
  disabled = false,
  onClick,
  pressed,
  testId,
  title,
}: ToolbarIconButtonProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={ariaLabel}
      title={title}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border transition duration-150 ease-out",
        active
          ? "border-accent/35 bg-accent-soft text-accent"
          : "border-border bg-canvas text-ink hover:border-line-strong hover:bg-surface-alt",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {children}
    </button>
  );
}

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

function isInlineMediaPreviewable(item: FileItem): boolean {
  return [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "application/pdf",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ].includes(item.mimeType ?? "");
}

function isImagePreviewable(item: FileItem): boolean {
  return (
    item.mimeType?.startsWith("image/") === true &&
    isInlineMediaPreviewable(item)
  );
}

function isPdfPreviewable(item: FileItem): boolean {
  return item.mimeType === "application/pdf" && isInlineMediaPreviewable(item);
}

function isVideoPreviewable(item: FileItem): boolean {
  return (
    item.mimeType?.startsWith("video/") === true &&
    isInlineMediaPreviewable(item)
  );
}

function canShowPreview(item: FileItem | undefined): boolean {
  if (!item || item.type !== "file") {
    return false;
  }

  return item.editable || isInlineMediaPreviewable(item) || item.previewable;
}

function getPreviewPanelLabel(item: FileItem, isChinese: boolean): string {
  if (item.editable) {
    return isChinese ? "文本预览" : "Text Preview";
  }

  if (item.mimeType?.startsWith("image/")) {
    return isChinese ? "图片预览" : "Image Preview";
  }

  if (item.mimeType === "application/pdf") {
    return isChinese ? "PDF 预览" : "PDF Preview";
  }

  if (item.mimeType?.startsWith("video/")) {
    return isChinese ? "视频预览" : "Video Preview";
  }

  return isChinese ? "预览" : "Preview";
}

function getEditBlockedMessage(item: FileItem, isChinese: boolean): string {
  if (item.editBlockedReason === "size-limit") {
    return isChinese
      ? "这个文本文件超过了浏览器可编辑上限。请先下载到本地编辑，或拆分为更小的文件后再在这里修改。"
      : "This text file exceeds the browser editing limit. Download it for local editing, or split it into smaller files before updating it here.";
  }

  if (item.previewable) {
    return isChinese
      ? "该文件支持浏览器预览，但当前文件类型不支持直接编辑。"
      : "This file can be previewed in the browser, but editing is disabled for its file type.";
  }

  return isChinese
    ? "该文件类型暂不支持浏览器编辑。"
    : "This file type is not available for browser editing.";
}

function getEditCapabilityLabel(item: FileItem, isChinese: boolean): string {
  if (item.editable) {
    return isChinese ? "可在浏览器编辑" : "Browser editable";
  }

  if (item.editBlockedReason === "size-limit") {
    return isChinese ? "只读：体积超限" : "Read-only: size limit";
  }

  return isChinese ? "浏览器只读" : "Read-only in browser";
}

function getDefaultEditorWrap(item?: FileItem): boolean {
  if (!item || item.type !== "file") {
    return true;
  }

  return getDefaultWrapMode(item.name);
}

export function FileWorkspacePanel({
  activeRootId,
  detailMode,
  editorContent,
  editorDirty,
  editorError,
  editorLineEnding,
  editorLoading,
  editorModifiedAt,
  editorSaving,
  onEditorContentChange,
  selectedItem,
}: FileWorkspacePanelProps) {
  const { formatDate, isChinese, pick } = useI18n();
  const [editorWrap, setEditorWrap] = useState(true);
  const [formatting, setFormatting] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [imagePresentation, setImagePresentation] =
    useState<ImagePresentation>("fit");
  const [imageScale, setImageScale] = useState(100);
  const [formatError, setFormatError] = useState<string | null>(null);

  useEffect(() => {
    setEditorWrap(getDefaultEditorWrap(selectedItem));
    setFormatting(false);
    setPreviewExpanded(false);
    setImagePresentation("fit");
    setImageScale(100);
    setFormatError(null);
  }, [selectedItem?.path]);

  const lineCount =
    editorContent.length > 0 ? editorContent.split(/\r?\n/).length : 1;
  const canPreview = canShowPreview(selectedItem);
  const canEdit = Boolean(
    selectedItem?.type === "file" && selectedItem.editable,
  );
  const languageLabel =
    selectedItem?.type === "file"
      ? getEditorLanguageLabel(selectedItem.name)
      : pick("纯文本", "Plain Text");
  const lineEndingLabel =
    editorLineEnding === "crlf"
      ? "CRLF"
      : editorLineEnding === "lf"
        ? "LF"
        : "--";
  const downloadUrl =
    activeRootId && selectedItem?.type === "file"
      ? getDownloadUrl(activeRootId, selectedItem.path)
      : null;
  const previewUrl =
    activeRootId &&
    selectedItem?.type === "file" &&
    isInlineMediaPreviewable(selectedItem)
      ? getPreviewUrl(activeRootId, selectedItem.path)
      : null;
  const previewHeight = previewExpanded ? "68vh" : "460px";
  const editorHeight = previewExpanded ? "68vh" : "420px";
  const canFormat = Boolean(
    selectedItem?.type === "file" &&
    canEdit &&
    canFormatInBrowser(selectedItem.name),
  );
  const activeEditorError = formatError ?? editorError;
  const wrapLabel = editorWrap
    ? pick("自动换行已开启", "Wrap On")
    : pick("自动换行已关闭", "Wrap Off");
  const formatLabel =
    selectedItem?.type === "file"
      ? formatting
        ? pick("格式化中...", "Formatting...")
        : isChinese
          ? `格式化 ${getEditorLanguageLabel(selectedItem.name)}`
          : getEditorFormatLabel(selectedItem.name)
      : pick("格式化", "Format");

  function handleImageZoomIn() {
    setImagePresentation("actual");
    setImageScale((current) => Math.min(current + 25, 300));
  }

  function handleImageZoomOut() {
    setImagePresentation("actual");
    setImageScale((current) => Math.max(current - 25, 50));
  }

  function handleImageReset() {
    setImagePresentation("fit");
    setImageScale(100);
  }

  function handleEditorChange(content: string) {
    if (formatError) {
      setFormatError(null);
    }

    onEditorContentChange(content);
  }

  async function handleFormatEditor() {
    if (!selectedItem || selectedItem.type !== "file" || !canFormat) {
      return;
    }

    setFormatting(true);

    try {
      const formatted = await formatContentInBrowser({
        fileName: selectedItem.name,
        content: editorContent,
        lineEnding: editorLineEnding,
      });
      setFormatError(null);

      if (formatted !== editorContent) {
        onEditorContentChange(formatted);
      }
    } catch (error) {
      setFormatError(
        error instanceof Error
          ? error.message
          : "Unable to format the current draft.",
      );
    } finally {
      setFormatting(false);
    }
  }

  function renderPreviewActions() {
    if (!selectedItem || selectedItem.type !== "file") {
      return null;
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        {(isImagePreviewable(selectedItem) ||
          isPdfPreviewable(selectedItem) ||
          isVideoPreviewable(selectedItem)) &&
        previewUrl ? (
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            data-testid="preview-open-raw"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-canvas px-3 py-2 text-xs font-medium text-ink transition hover:border-accent"
          >
            <ArrowSquareOut className="h-4 w-4" weight="bold" />
            {pick("新标签打开", "Open In New Tab")}
          </a>
        ) : null}
        <button
          type="button"
          data-testid="preview-expand-toggle"
          onClick={() => setPreviewExpanded((current) => !current)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-canvas px-3 py-2 text-xs font-medium text-ink transition hover:border-accent"
        >
          {previewExpanded ? (
            <ArrowsIn className="h-4 w-4" weight="bold" />
          ) : (
            <ArrowsOut className="h-4 w-4" weight="bold" />
          )}
          {previewExpanded ? pick("紧凑视图", "Compact View") : pick("专注视图", "Focus View")}
        </button>
      </div>
    );
  }

  function renderPreviewContent() {
    if (!selectedItem) {
      return null;
    }

    if (selectedItem.type !== "file") {
      return (
        <div className="rounded-[16px] border border-dashed border-border bg-surface p-5 text-sm leading-6 text-muted">
          {pick(
            "文件夹不会在这里内联预览。请打开该目录查看内容，或通过导出打包下载。",
            "Folder preview is not rendered inline. Open the folder to inspect its contents, or use export for packaging and download.",
          )}
        </div>
      );
    }

    if (selectedItem.editable) {
      if (editorLoading) {
        return (
          <div className="rounded-[16px] border border-border bg-surface px-4 py-6 text-sm text-muted">
            {pick("加载文本预览中...", "Loading text preview...")}
          </div>
        );
      }

      return (
        <div className="overflow-hidden rounded-[16px] border border-border bg-canvas">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted">
                {getPreviewPanelLabel(selectedItem, isChinese)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="rounded-full bg-canvas px-3 py-1 font-medium text-ink">
                {languageLabel}
              </span>
              <span className="rounded-full bg-canvas px-3 py-1 font-medium text-ink">
                {pick(`${lineCount} 行`, `${lineCount} lines`)}
              </span>
            </div>
          </div>
          <div className="overflow-hidden" style={{ minHeight: previewHeight }}>
            <CodeEditor
              ariaLabel={`Previewing ${selectedItem.name}`}
              fileName={selectedItem.name}
              maxHeight={previewHeight}
              minHeight={previewHeight}
              readOnly
              testId="preview-text-viewer"
              value={editorContent}
              wrap
            />
          </div>
        </div>
      );
    }

    if (!previewUrl) {
      if (selectedItem.editBlockedReason === "size-limit") {
        return (
          <div className="rounded-[16px] border border-dashed border-warning/30 bg-warning/5 p-5 text-sm leading-6 text-warning">
            {pick(
              "这个文本文件超过了浏览器预览上限，因此不会提供内联预览。请下载后本地查看，或拆分为更小文件后再通过浏览器处理。",
              "This text file is over the browser preview limit, so inline preview is intentionally disabled. Download it for local review or split it into smaller files if it needs browser-based editing.",
            )}
          </div>
        );
      }

      return (
        <div className="rounded-[16px] border border-dashed border-border bg-surface p-5 text-sm leading-6 text-muted">
          {pick(
            "该文件类型暂不支持内联预览，请下载后在本地查看。",
            "Inline preview is unavailable for this file type. Download the file to inspect it locally.",
          )}
        </div>
      );
    }

    if (isImagePreviewable(selectedItem)) {
      return (
        <div className="overflow-hidden rounded-[16px] border border-border bg-canvas">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted">
                {getPreviewPanelLabel(selectedItem, isChinese)}
              </p>
              <p className="mt-1 text-sm text-muted">
                {pick(
                  "下载原始文件前，先在这里快速检查视觉内容。",
                  "Inspect visuals inline before downloading the original asset.",
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="preview-image-fit"
                onClick={() => setImagePresentation("fit")}
                className={clsx(
                  "rounded-full border px-3 py-2 text-xs font-medium transition",
                  imagePresentation === "fit"
                    ? "border-ink bg-ink text-white"
                    : "border-border bg-canvas text-ink hover:border-accent",
                )}
              >
                {pick("适应", "Fit")}
              </button>
              <button
                type="button"
                data-testid="preview-image-zoom-out"
                onClick={handleImageZoomOut}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-canvas px-3 py-2 text-xs font-medium text-ink transition hover:border-accent"
              >
                <MagnifyingGlassMinus className="h-4 w-4" weight="bold" />
                {pick("缩小", "Zoom Out")}
              </button>
              <button
                type="button"
                data-testid="preview-image-reset"
                onClick={handleImageReset}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-canvas px-3 py-2 text-xs font-medium text-ink transition hover:border-accent"
              >
                <ArrowCounterClockwise className="h-4 w-4" weight="bold" />
                {pick("重置", "Reset")}
              </button>
              <button
                type="button"
                data-testid="preview-image-zoom-in"
                onClick={handleImageZoomIn}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-canvas px-3 py-2 text-xs font-medium text-ink transition hover:border-accent"
              >
                <MagnifyingGlassPlus className="h-4 w-4" weight="bold" />
                {pick("放大", "Zoom In")}
              </button>
            </div>
          </div>
          <div
            className="overflow-auto bg-[#EEE6D8] p-5"
            style={{ height: previewHeight }}
          >
            <div
              className={clsx(
                "flex min-h-full rounded-[28px] border border-border/80 bg-surface p-4 shadow-card",
                imagePresentation === "fit"
                  ? "items-center justify-center"
                  : "items-start justify-start",
              )}
            >
              <img
                src={previewUrl}
                alt={selectedItem.name}
                data-testid="preview-image"
                className={clsx(
                  "rounded-2xl shadow-card transition duration-200 ease-out",
                  imagePresentation === "fit"
                    ? "max-h-full w-full object-contain"
                    : "max-w-none",
                )}
                style={
                  imagePresentation === "actual"
                    ? { width: `${imageScale}%` }
                    : undefined
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface px-4 py-3 text-xs text-muted">
            <span className="rounded-full bg-canvas px-3 py-1 font-medium text-ink">
              {formatSize(selectedItem.size)}
            </span>
            <span className="rounded-full bg-canvas px-3 py-1 font-medium text-ink">
              {selectedItem.mimeType}
            </span>
              <span className="rounded-full bg-canvas px-3 py-1 font-medium text-ink">
                {pick(
                  `缩放 ${imagePresentation === "fit" ? "自动" : `${imageScale}%`}`,
                  `Scale ${imagePresentation === "fit" ? "Auto" : `${imageScale}%`}`,
                )}
              </span>
          </div>
        </div>
      );
    }

    if (isPdfPreviewable(selectedItem)) {
      return (
        <div className="overflow-hidden rounded-[16px] border border-border bg-canvas">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted">
                {getPreviewPanelLabel(selectedItem, isChinese)}
              </p>
              <p className="mt-1 text-sm text-muted">
                {pick(
                  "PDF 会直接内联展示，必要时也可以跳转到浏览器标签页查看。",
                  "PDF stays inline for quick review, with a direct handoff to the browser tab when needed.",
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="rounded-full bg-canvas px-3 py-1 font-medium text-ink">
                {formatSize(selectedItem.size)}
              </span>
              <span className="rounded-full bg-canvas px-3 py-1 font-medium text-ink">
                {selectedItem.mimeType}
              </span>
            </div>
          </div>
          <iframe
            src={`${previewUrl}#toolbar=1&navpanes=0`}
            title={selectedItem.name}
            data-testid="preview-frame"
            className="w-full"
            style={{ height: previewHeight }}
          />
        </div>
      );
    }

    if (isVideoPreviewable(selectedItem)) {
      return (
        <div className="overflow-hidden rounded-[16px] border border-border bg-canvas">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted">
                {getPreviewPanelLabel(selectedItem, isChinese)}
              </p>
              <p className="mt-1 text-sm text-muted">
                {pick(
                  "视频可直接在这里播放，不需要离开当前目录上下文。",
                  "Playback is embedded for fast inspection without interrupting the current directory context.",
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="rounded-full bg-canvas px-3 py-1 font-medium text-ink">
                {formatSize(selectedItem.size)}
              </span>
              <span className="rounded-full bg-canvas px-3 py-1 font-medium text-ink">
                {selectedItem.mimeType}
              </span>
            </div>
          </div>
          <div className="bg-[#111111] p-3">
            <video
              controls
              preload="metadata"
              src={previewUrl}
              data-testid="preview-video"
              className="w-full rounded-2xl bg-black"
              style={{ maxHeight: previewHeight }}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-[16px] border border-dashed border-border bg-surface p-5 text-sm leading-6 text-muted">
        {pick(
          "该文件类型暂不支持内联预览，请下载后在本地查看。",
          "Inline preview is unavailable for this file type. Download the file to inspect it locally.",
        )}
      </div>
    );
  }

  if (!selectedItem) {
    return (
      <section className="flex h-full items-center justify-center px-5 py-6">
        <div className="rounded-[16px] border border-dashed border-border bg-surface px-5 py-6 text-sm leading-6 text-muted">
          <p className="font-medium text-ink-strong">{pick("当前未选中文件", "No active file")}</p>
          <p className="mt-2">
            {pick(
              "从目录列表里打开文件后，这里会显示文件内容。",
              "Open a file from the directory list and its content will appear here.",
            )}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {detailMode === "details" ? (
          <div className="space-y-4">
            <div className="panel-section p-4 text-sm leading-6 text-muted">
              <p className="font-medium text-ink-strong">
                {selectedItem.type === "directory"
                  ? pick("已选中文件夹", "Folder selected")
                  : pick("文件摘要", "File summary")}
              </p>
              <p className="mt-3">
                {selectedItem.type === "directory"
                  ? pick(
                      "目录结构以左侧树和当前列表为主，这里只保留当前对象的必要信息。",
                      "Directory structure is handled from the tree and list. This surface only keeps the essential details for the current selection.",
                    )
                  : selectedItem.editable
                    ? pick(
                        "该文件可直接编辑，可在当前区域切换预览和编辑。",
                        "This file can be edited directly here. Switch between Preview and Edit in the current workspace.",
                      )
                    : selectedItem.editBlockedReason === "size-limit"
                      ? pick(
                          "该文本文件体积过大，浏览器中只提供只读提示与下载能力。",
                          "This text file is too large for browser editing, so this area stays read-only and provides download guidance only.",
                        )
                      : selectedItem.previewable
                        ? pick(
                            "该文件支持浏览器预览，但不支持直接编辑。",
                            "This file can be previewed in the browser, but direct editing is disabled.",
                          )
                        : pick(
                            "该文件当前仅支持下载查看。",
                            "This file currently supports download only.",
                          )}
              </p>
              {selectedItem.type === "file" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={
                      selectedItem.previewable
                        ? "chip chip-accent"
                        : "chip chip-neutral"
                    }
                  >
                    {selectedItem.previewable ? pick("可预览", "Preview ready") : pick("不可预览", "No preview")}
                  </span>
                  <span
                    className={
                      selectedItem.editable
                        ? "chip chip-success"
                        : selectedItem.editBlockedReason === "size-limit"
                          ? "chip chip-warning"
                          : "chip chip-neutral"
                    }
                    >
                      {getEditCapabilityLabel(selectedItem, isChinese)}
                    </span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {detailMode === "preview" ? (
          <div className="space-y-4" data-testid="preview-surface">
            <div className="panel-section px-4 py-4 text-sm text-muted">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{pick("预览", "Preview")}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {pick(
                        "可以切到专注视图查看更多细节。图片还支持适应和缩放。",
                        "Use focus mode for larger inspection. Images also support fit and zoom controls.",
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {renderPreviewActions()}
                    {downloadUrl ? (
                      <a
                        href={downloadUrl}
                        data-testid="detail-download"
                        className="action-button"
                      >
                        <DownloadSimple className="h-4 w-4" weight="bold" />
                        {pick("下载原文件", "Download Original")}
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            {renderPreviewContent()}
          </div>
        ) : null}

        {detailMode === "edit" ? (
          <div className="space-y-4">
            {canEdit ? (
              <>
                {activeEditorError ? (
                  <div className="rounded-[16px] border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger">
                    {activeEditorError}
                  </div>
                ) : null}

                {editorLoading ? (
                  <div className="panel-section px-4 py-6 text-sm text-muted">
                    {pick("加载可编辑内容中...", "Loading editable content...")}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-[16px] border border-border bg-canvas">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          data-testid="editor-language"
                          className="chip chip-neutral"
                        >
                          {languageLabel}
                        </span>
                        <span
                          data-testid="editor-line-ending"
                          className="chip chip-neutral"
                        >
                          {lineEndingLabel}
                        </span>
                        <ToolbarIconButton
                          active={editorWrap}
                          ariaLabel={wrapLabel}
                          onClick={() => setEditorWrap((current) => !current)}
                          pressed={editorWrap}
                          testId="editor-wrap-toggle"
                          title={wrapLabel}
                        >
                          <WrapText className="h-4 w-4" />
                        </ToolbarIconButton>
                        {canFormat ? (
                          <ToolbarIconButton
                            ariaLabel={formatLabel}
                            disabled={formatting || editorSaving}
                            onClick={() => void handleFormatEditor()}
                            testId="editor-format"
                            title={formatLabel}
                          >
                            <Sparkles
                              className={clsx("h-4 w-4", formatting && "animate-pulse")}
                            />
                          </ToolbarIconButton>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span
                          className={
                            editorDirty
                              ? "chip chip-warning"
                              : "chip chip-success"
                          }
                        >
                          {editorDirty ? pick("有未保存修改", "Unsaved changes") : pick("已同步", "In sync")}
                        </span>
                        {editorModifiedAt ? (
                          <span>{pick(`上次保存 ${formatDate(editorModifiedAt)}`, `Last saved ${formatDate(editorModifiedAt)}`)}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-b-3xl">
                      <CodeEditor
                        ariaLabel={`Editing ${selectedItem.name}`}
                        fileName={selectedItem.name}
                        minHeight={editorHeight}
                        onChange={handleEditorChange}
                        placeholder={pick("开始编辑当前文件", "Start editing the selected file")}
                        testId="editor-textarea"
                        value={editorContent}
                        wrap={editorWrap}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div
                data-testid="editor-readonly-message"
                className={clsx(
                  "rounded-[16px] border border-dashed p-5 text-sm leading-6",
                  selectedItem.editBlockedReason === "size-limit"
                    ? "border-warning/30 bg-warning/5 text-warning"
                    : "border-border bg-surface text-muted",
                )}
              >
                {getEditBlockedMessage(selectedItem, isChinese)}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
