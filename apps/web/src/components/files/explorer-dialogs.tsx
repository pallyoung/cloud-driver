import { useEffect, useState } from 'react';
import type { FileItem } from '@cloud-driver/shared';
import { useI18n } from '../../hooks/use-i18n';
import { OverlayPanel } from '../ui/overlay-panel';

export type ExplorerDialogState =
  | { type: 'unsaved' }
  | { type: 'create-folder'; name: string }
  | { type: 'rename'; newName: string }
  | { type: 'move'; targetDirPath: string }
  | { type: 'delete' }
  | { type: 'export' };

type ExplorerDialogsProps = {
  dialog: ExplorerDialogState | null;
  exportTtlMinutes?: number | null;
  isBusy: boolean;
  selectedItem?: FileItem;
  onClose: () => void;
  onConfirmUnsaved: () => void;
  onConfirmCreateFolder: (name: string) => Promise<void> | void;
  onConfirmRename: (newName: string) => Promise<void> | void;
  onConfirmMove: (targetDirPath: string) => Promise<void> | void;
  onConfirmDelete: () => Promise<void> | void;
  onConfirmExport: () => Promise<void> | void;
};

export function ExplorerDialogs({
  dialog,
  exportTtlMinutes,
  isBusy,
  onClose,
  onConfirmCreateFolder,
  onConfirmDelete,
  onConfirmExport,
  onConfirmMove,
  onConfirmRename,
  onConfirmUnsaved,
  selectedItem,
}: ExplorerDialogsProps) {
  const { pick } = useI18n();
  const [nameValue, setNameValue] = useState('');
  const [moveTargetValue, setMoveTargetValue] = useState('');

  useEffect(() => {
    if (!dialog) {
      return;
    }

    if (dialog.type === 'create-folder') {
      setNameValue(dialog.name);
    }

    if (dialog.type === 'rename') {
      setNameValue(dialog.newName);
    }

    if (dialog.type === 'move') {
      setMoveTargetValue(dialog.targetDirPath);
    }
  }, [dialog]);

  if (!dialog) {
    return null;
  }

  if (dialog.type === 'unsaved') {
    return (
      <OverlayPanel
        title={pick('放弃未保存修改？', 'Discard Unsaved Changes?')}
        description={pick(
          '当前编辑器里还有未保存内容。继续操作会先恢复到上一次保存的版本。',
          'The current editor has changes that have not been saved. Continuing will restore the last saved version before proceeding.',
        )}
        onClose={onClose}
        testId="dialog-unsaved"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              data-testid="dialog-unsaved-cancel"
              onClick={onClose}
              className="action-button"
            >
              {pick('继续编辑', 'Keep Editing')}
            </button>
            <button
              type="button"
              data-testid="dialog-unsaved-confirm"
              onClick={onConfirmUnsaved}
              className="action-button action-button-danger"
            >
              {pick('不保存继续', 'Continue Without Saving')}
            </button>
          </div>
        }
      >
        <div className="rounded-[16px] border border-danger/20 bg-danger/5 p-4 text-sm leading-6 text-muted">
          <p className="font-medium text-ink">{pick('未保存草稿', 'Unsaved draft')}</p>
          <p className="mt-2">
            {pick(
              '切换根目录、选中其他行、移动、重命名、删除时都会触发这个保护，避免误丢修改。',
              'This guard applies to root switching, row selection, move, rename, and delete actions so the operator does not lose edits accidentally.',
            )}
          </p>
        </div>
      </OverlayPanel>
    );
  }

  if (dialog.type === 'create-folder') {
    return (
      <OverlayPanel
        title={pick('新建文件夹', 'Create Folder')}
        description={pick(
          '在当前位置创建一个新的目录，名称需要在当前文件夹内唯一。',
          'Add a new directory at the current location. The name must be unique within this folder.',
        )}
        onClose={onClose}
        testId="dialog-create-folder"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="action-button"
            >
              {pick('取消', 'Cancel')}
            </button>
            <button
              type="button"
              data-testid="dialog-create-folder-submit"
              disabled={!nameValue.trim() || isBusy}
              onClick={() => void onConfirmCreateFolder(nameValue)}
              className="action-button action-button-primary"
            >
              {isBusy ? pick('创建中...', 'Creating...') : pick('创建文件夹', 'Create Folder')}
            </button>
          </div>
        }
      >
        <label className="block text-sm font-medium text-ink" htmlFor="create-folder-name">
          {pick('文件夹名称', 'Folder name')}
        </label>
        <input
          id="create-folder-name"
          data-autofocus="true"
          data-testid="dialog-create-folder-name"
          value={nameValue}
          onChange={(event) => setNameValue(event.target.value)}
          placeholder="contracts"
          className="input-soft mt-3"
        />
      </OverlayPanel>
    );
  }

  if (dialog.type === 'rename') {
    return (
      <OverlayPanel
        title={pick('重命名', 'Rename Item')}
        description={pick(
          '只修改当前文件或文件夹名称，不改变父级目录。',
          'Update the current file or folder name without changing its parent directory.',
        )}
        onClose={onClose}
        testId="dialog-rename"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="action-button"
            >
              {pick('取消', 'Cancel')}
            </button>
            <button
              type="button"
              data-testid="dialog-rename-submit"
              disabled={!nameValue.trim() || isBusy}
              onClick={() => void onConfirmRename(nameValue)}
              className="action-button action-button-primary"
            >
              {isBusy ? pick('重命名中...', 'Renaming...') : pick('确认重命名', 'Rename')}
            </button>
          </div>
        }
      >
        <div className="rounded-[14px] border border-border bg-canvas p-4 text-sm text-muted">
          <p className="font-medium text-ink">{pick('当前名称', 'Current name')}</p>
          <p className="mt-2 font-mono text-xs text-ink">{selectedItem?.name}</p>
        </div>

        <label className="mt-5 block text-sm font-medium text-ink" htmlFor="rename-name">
          {pick('新名称', 'New name')}
        </label>
        <input
          id="rename-name"
          data-autofocus="true"
          data-testid="dialog-rename-name"
          value={nameValue}
          onChange={(event) => setNameValue(event.target.value)}
          className="input-soft mt-3"
        />
      </OverlayPanel>
    );
  }

  if (dialog.type === 'move') {
    return (
      <OverlayPanel
        title={pick('移动', 'Move Item')}
        description={pick(
          '把当前文件或文件夹移动到同一挂载根目录下的其他目录，根目录用 / 表示。',
          'Move the selected file or folder to another directory within the same managed root. Use / for the root directory.',
        )}
        onClose={onClose}
        testId="dialog-move"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="action-button"
            >
              {pick('取消', 'Cancel')}
            </button>
            <button
              type="button"
              data-testid="dialog-move-submit"
              disabled={isBusy}
              onClick={() => void onConfirmMove(moveTargetValue)}
              className="action-button action-button-primary"
            >
              {isBusy ? pick('移动中...', 'Moving...') : pick('确认移动', 'Move Item')}
            </button>
          </div>
        }
      >
        <div className="rounded-[14px] border border-border bg-canvas p-4 text-sm text-muted">
          <p className="font-medium text-ink">{pick('源路径', 'Source path')}</p>
          <p className="mt-2 font-mono text-xs text-ink">{selectedItem?.path}</p>
        </div>

        <label className="mt-5 block text-sm font-medium text-ink" htmlFor="move-target-path">
          {pick('目标目录路径', 'Destination directory path')}
        </label>
        <input
          id="move-target-path"
          data-autofocus="true"
          data-testid="dialog-move-target"
          value={moveTargetValue}
          onChange={(event) => setMoveTargetValue(event.target.value)}
          placeholder="/"
          className="input-soft mt-3"
        />
      </OverlayPanel>
    );
  }

  if (dialog.type === 'delete') {
    return (
      <OverlayPanel
        title={pick('删除', 'Delete Item')}
        description={pick(
          '该操作会立即从挂载根目录中删除当前选中项。',
          'This operation removes the selected item from the managed root immediately.',
        )}
        onClose={onClose}
        testId="dialog-delete"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="action-button"
            >
              {pick('取消', 'Cancel')}
            </button>
            <button
              type="button"
              data-testid="dialog-delete-submit"
              disabled={isBusy}
              onClick={() => void onConfirmDelete()}
              className="action-button action-button-danger"
            >
              {isBusy ? pick('删除中...', 'Deleting...') : pick('永久删除', 'Delete Permanently')}
            </button>
          </div>
        }
      >
        <div className="rounded-[16px] border border-danger/20 bg-danger/5 p-4 text-sm leading-6 text-muted">
          <p className="font-medium text-ink">{pick('当前对象', 'Selected item')}</p>
          <p className="mt-2 font-mono text-xs text-ink">{selectedItem?.path}</p>
          <p className="mt-4">
            {pick(
              'V1 中删除不可恢复。如需保留，请先导出。',
              'Deletion is irreversible in V1. Use export first if the item needs to be preserved.',
            )}
          </p>
        </div>
      </OverlayPanel>
    );
  }

  if (dialog.type === 'export') {
    return (
      <OverlayPanel
        mode="drawer"
        title={pick('导出', 'Export Selection')}
        description={pick(
          '为当前选中项创建浏览器导出。文件会直接下载，文件夹会先打包为 zip 任务。',
          'Create a browser-facing export for the selected item. Direct files download immediately. Folders are packaged into a zip job first.',
        )}
        onClose={onClose}
        testId="dialog-export"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="action-button"
            >
              {pick('取消', 'Cancel')}
            </button>
            <button
              type="button"
              data-testid="dialog-export-submit"
              disabled={isBusy}
              onClick={() => void onConfirmExport()}
              className="action-button action-button-primary"
            >
              {isBusy
                ? pick('创建中...', 'Creating...')
                : selectedItem?.type === 'directory'
                  ? pick('创建导出任务', 'Create Export Job')
                  : pick('下载文件', 'Download File')}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-[14px] border border-border bg-canvas p-4 text-sm text-muted">
            <p className="font-medium text-ink">{pick('源路径', 'Source path')}</p>
            <p className="mt-2 font-mono text-xs text-ink">{selectedItem?.path}</p>
          </div>
          <div className="rounded-[14px] border border-border bg-canvas p-4 text-sm text-muted">
            <p className="font-medium text-ink">{pick('交付方式', 'Delivery mode')}</p>
            <p className="mt-2 leading-6">
              {selectedItem?.type === 'directory'
                ? pick(
                    '文件夹导出会先生成临时 zip，再进入任务中心下载。',
                    'Folder export creates a temporary zip archive and hands it off through Task Center.',
                  )
                : pick(
                    '单文件不走打包流程，直接通过浏览器下载。',
                    'Single files bypass archive packaging and stream directly through the browser download flow.',
                  )}
            </p>
          </div>
          <div className="rounded-[14px] border border-border bg-surface p-4 text-sm leading-6 text-muted">
            {selectedItem?.type === 'directory'
              ? pick(
                  `系统会把该目录打包成 zip，生成任务，并在下载完成或过期后自动清理临时文件${exportTtlMinutes ? `（TTL ${exportTtlMinutes} 分钟）` : ''}。`,
                  `The system will package this folder as a zip archive, surface a task in Task Center, and remove the temp archive after download or expiry${exportTtlMinutes ? ` (${exportTtlMinutes} min TTL)` : ''}.`,
                )
              : pick(
                  '当前文件会直接通过浏览器下载，不会额外创建临时压缩任务。',
                  'The file will be streamed directly through the browser without creating a temporary archive job.',
                )}
          </div>
        </div>
      </OverlayPanel>
    );
  }
}
