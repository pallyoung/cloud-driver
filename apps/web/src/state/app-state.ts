import type {
  BackupConflictPolicy,
  BackupJobSummary,
  ExportJobSummary,
  FileItem,
  ManagedRoot,
  SettingsResponse,
} from '@cloud-driver/shared';
import {
  ApiError,
  createBackupJob,
  createExportJob,
  createFolder,
  deletePath,
  getFileContent,
  getFilesList,
  getJobs,
  getRoots,
  getSession,
  getSettings,
  login,
  logout,
  movePath,
  renamePath,
  retryBackupJob,
  saveFileContent,
  uploadFile,
} from '../lib/api/client';
import { getInitialLanguage, persistLanguage, type AppLanguage } from '../lib/i18n';
import { action, computed, state, type Store } from './relax';

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';
export type TaskFilter = 'All' | 'Export' | 'Backup' | 'Processing' | 'Failed' | 'Ready';

export const authStatusState = state<AuthStatus>('unknown', 'authStatus');
export const authSubmittingState = state<boolean>(false, 'authSubmitting');
export const authErrorState = state<string | null>(null, 'authError');
export const languageState = state<AppLanguage>(getInitialLanguage(), 'language');

export const managedRootsState = state<ManagedRoot[]>([], 'managedRoots');
export const rootsLoadingState = state<boolean>(false, 'rootsLoading');
export const rootsErrorState = state<string | null>(null, 'rootsError');

export const activeRootIdState = state<string | null>(null, 'activeRootId');
export const currentPathState = state<string>('', 'currentPath');
export const fileItemsState = state<FileItem[]>([], 'fileItems');
export const filesLoadingState = state<boolean>(false, 'filesLoading');
export const filesErrorState = state<string | null>(null, 'filesError');
export const searchKeywordState = state<string>('', 'searchKeyword');
export const explorerSurfaceState = state<'tree' | 'content'>('content', 'explorerSurface');

export const selectedItemPathState = state<string | null>(null, 'selectedItemPath');
export const selectedItemState = state<FileItem | null>(null, 'selectedItem');
export const editorContentState = state<string>('', 'editorContent');
export const editorOriginalContentState = state<string>('', 'editorOriginalContent');
export const editorEtagState = state<string | null>(null, 'editorEtag');
export const editorModifiedAtState = state<string | null>(null, 'editorModifiedAt');
export const editorLineEndingState = state<'lf' | 'crlf' | null>(null, 'editorLineEnding');
export const editorLoadingState = state<boolean>(false, 'editorLoading');
export const editorSavingState = state<boolean>(false, 'editorSaving');
export const editorErrorState = state<string | null>(null, 'editorError');

export const fileMutationPendingState = state<boolean>(false, 'fileMutationPending');
export const fileMutationErrorState = state<string | null>(null, 'fileMutationError');

export const detailPanelOpenState = state<boolean>(true, 'detailPanelOpen');
export const settingsState = state<SettingsResponse | null>(null, 'settings');
export const settingsLoadingState = state<boolean>(false, 'settingsLoading');
export const settingsErrorState = state<string | null>(null, 'settingsError');

export const taskFilterState = state<TaskFilter>('All', 'taskFilter');
export const exportJobsState = state<ExportJobSummary[]>([], 'exportJobs');
export const backupJobsState = state<BackupJobSummary[]>([], 'backupJobs');
export const jobsLoadingState = state<boolean>(false, 'jobsLoading');
export const jobsErrorState = state<string | null>(null, 'jobsError');
export const jobsFocusTargetState = state<{ kind: 'Export' | 'Backup'; id: string } | null>(
  null,
  'jobsFocusTarget',
);

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function upsertById<T extends { id: string }>(items: T[], nextItem: T): T[] {
  return [nextItem, ...items.filter((item) => item.id !== nextItem.id)];
}

function resetEditorState(store: Store) {
  store.set(editorContentState, '');
  store.set(editorOriginalContentState, '');
  store.set(editorEtagState, null);
  store.set(editorModifiedAtState, null);
  store.set(editorLineEndingState, null);
  store.set(editorErrorState, null);
}

function resetSelectionState(store: Store) {
  store.set(selectedItemPathState, null);
  store.set(selectedItemState, null);
  resetEditorState(store);
}

function getSelectedItemFromStore(store: Store): FileItem | undefined {
  return store.get(selectedItemState) ?? undefined;
}

function getParentPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts.slice(0, -1).join('/');
}

async function refreshFiles(store: Store) {
  const rootId = store.get(activeRootIdState);

  if (!rootId) {
    store.set(fileItemsState, []);
    return;
  }

  store.set(filesLoadingState, true);
  store.set(filesErrorState, null);

  try {
    const response = await getFilesList(rootId, store.get(currentPathState));
    store.set(fileItemsState, response.items);
    store.set(currentPathState, response.path);

    const selectedItemPath = store.get(selectedItemPathState);
    if (selectedItemPath) {
      const nextSelectedItem = response.items.find((item) => item.path === selectedItemPath);

      if (nextSelectedItem) {
        store.set(selectedItemState, nextSelectedItem);
      } else {
        const selectedItem = store.get(selectedItemState);
        const selectedItemParentPath = selectedItem ? getParentPath(selectedItem.path) : '';

        if (selectedItemParentPath === response.path) {
          resetSelectionState(store);
        }
      }
    }
  } catch (error) {
    store.set(fileItemsState, []);
    store.set(filesErrorState, getErrorMessage(error, 'Unable to load files.'));
  } finally {
    store.set(filesLoadingState, false);
  }
}

export const rootCountState = computed<number>({
  name: 'rootCount',
  get: (get) => get(managedRootsState).length,
});

export const activeRootState = computed<ManagedRoot | undefined>({
  name: 'activeRoot',
  get: (get) => {
    const activeRootId = get(activeRootIdState);
    return get(managedRootsState).find((root) => root.id === activeRootId);
  },
});

export const editorDirtyState = computed<boolean>({
  name: 'editorDirty',
  get: (get) => get(editorContentState) !== get(editorOriginalContentState),
});

export const filteredFileItemsState = computed<FileItem[]>({
  name: 'filteredFileItems',
  get: (get) => {
    const keyword = get(searchKeywordState).trim().toLowerCase();
    const items = get(fileItemsState);

    if (!keyword) {
      return items;
    }

    return items.filter((item) => {
      const typeLabel = item.type === 'directory' ? 'folder' : 'file';
      return (
        item.name.toLowerCase().includes(keyword) ||
        typeLabel.includes(keyword) ||
        (item.mimeType ?? '').toLowerCase().includes(keyword)
      );
    });
  },
});

export const loadSessionAction = action(async (store: Store) => {
  try {
    const session = await getSession();
    store.set(authStatusState, session.authenticated ? 'authenticated' : 'anonymous');
    store.set(authErrorState, null);
  } catch (error) {
    store.set(authStatusState, 'anonymous');
    store.set(authErrorState, getErrorMessage(error, 'Unable to verify session.'));
  }
});

export const loginAction = action<{ password: string }, Promise<boolean>>(
  async (store: Store, payload) => {
    store.set(authSubmittingState, true);
    store.set(authErrorState, null);

    try {
      await login(payload.password);
      store.set(authStatusState, 'authenticated');
      return true;
    } catch (error) {
      store.set(authStatusState, 'anonymous');
      store.set(authErrorState, getErrorMessage(error, 'Unable to sign in.'));
      return false;
    } finally {
      store.set(authSubmittingState, false);
    }
  },
);

export const setLanguageAction = action<AppLanguage, void>((store: Store, language: AppLanguage) => {
  store.set(languageState, language);
  persistLanguage(language);
});

export const setExplorerSurfaceAction = action<'tree' | 'content', void>(
  (store: Store, surface) => {
    store.set(explorerSurfaceState, surface);
  },
);

export const logoutAction = action(async (store: Store) => {
  await logout();
  store.set(authStatusState, 'anonymous');
  store.set(authErrorState, null);
  store.set(managedRootsState, []);
  store.set(activeRootIdState, null);
  store.set(currentPathState, '');
  store.set(fileItemsState, []);
  store.set(settingsState, null);
  store.set(settingsErrorState, null);
  store.set(exportJobsState, []);
  store.set(backupJobsState, []);
  store.set(jobsErrorState, null);
  resetSelectionState(store);
});

export const loadRootsAction = action(async (store: Store) => {
  store.set(rootsLoadingState, true);
  store.set(rootsErrorState, null);

  try {
    const response = await getRoots();
    store.set(managedRootsState, response.roots);

    const currentActiveRootId = store.get(activeRootIdState);
    const hasCurrentRoot = response.roots.some((root) => root.id === currentActiveRootId);

    if (!hasCurrentRoot) {
      store.set(activeRootIdState, response.roots[0]?.id ?? null);
      store.set(currentPathState, '');
      resetSelectionState(store);
    }
  } catch (error) {
    store.set(rootsErrorState, getErrorMessage(error, 'Unable to load roots.'));
  } finally {
    store.set(rootsLoadingState, false);
  }
});

export const loadFilesAction = action<{ rootId: string; path?: string }, Promise<void>>(
  async (store: Store, payload) => {
    store.set(activeRootIdState, payload.rootId);
    store.set(currentPathState, payload.path ?? '');
    await refreshFiles(store);
  },
);

export const loadSettingsAction = action(async (store: Store) => {
  store.set(settingsLoadingState, true);
  store.set(settingsErrorState, null);

  try {
    const settings = await getSettings();
    store.set(settingsState, settings);
  } catch (error) {
    store.set(settingsErrorState, getErrorMessage(error, 'Unable to load settings.'));
  } finally {
    store.set(settingsLoadingState, false);
  }
});

export const loadJobsAction = action(async (store: Store) => {
  store.set(jobsLoadingState, true);
  store.set(jobsErrorState, null);

  try {
    const response = await getJobs();
    store.set(exportJobsState, response.exports);
    store.set(backupJobsState, response.backups);
  } catch (error) {
    store.set(jobsErrorState, getErrorMessage(error, 'Unable to load jobs.'));
  } finally {
    store.set(jobsLoadingState, false);
  }
});

export const setActiveRootAction = action<string, void>((store: Store, rootId: string) => {
  store.set(activeRootIdState, rootId);
  store.set(currentPathState, '');
  store.set(fileItemsState, []);
  store.set(fileMutationErrorState, null);
  resetSelectionState(store);
});

export const setCurrentPathAction = action<string, void>((store: Store, relativePath: string) => {
  store.set(currentPathState, relativePath);
  store.set(fileItemsState, []);
  store.set(fileMutationErrorState, null);
  resetSelectionState(store);
});

export const selectItemAction = action<
  { path: string | null; item?: FileItem | null } | string | null,
  void
>((store: Store, payload) => {
  const nextPath = typeof payload === 'object' && payload !== null ? payload.path : payload;
  const nextItem =
    typeof payload === 'object' && payload !== null && 'item' in payload
      ? payload.item ?? null
      : nextPath === null
        ? null
        : store.get(fileItemsState).find((item) => item.path === nextPath) ?? null;

  store.set(selectedItemPathState, nextPath);
  store.set(selectedItemState, nextItem);
  store.set(editorErrorState, null);

  if (nextPath === null) {
    resetEditorState(store);
  }
});

export const setSearchKeywordAction = action<string, void>((store: Store, keyword: string) => {
  store.set(searchKeywordState, keyword);
});

export const toggleDetailPanelAction = action((store: Store) => {
  store.set(detailPanelOpenState, !store.get(detailPanelOpenState));
});

export const setTaskFilterAction = action<TaskFilter, void>((store: Store, filter: TaskFilter) => {
  store.set(taskFilterState, filter);
});

export const setJobsFocusTargetAction = action<{ kind: 'Export' | 'Backup'; id: string } | null, void>(
  (store: Store, target) => {
    store.set(jobsFocusTargetState, target);
  },
);

export const loadSelectedFileContentAction = action(async (store: Store) => {
  const selectedItem = getSelectedItemFromStore(store);
  const rootId = store.get(activeRootIdState);

  if (!selectedItem || selectedItem.type !== 'file' || !selectedItem.editable || !rootId) {
    resetEditorState(store);
    return;
  }

  store.set(editorLoadingState, true);
  store.set(editorErrorState, null);

  try {
    const response = await getFileContent(rootId, selectedItem.path);
    store.set(editorContentState, response.content);
    store.set(editorOriginalContentState, response.content);
    store.set(editorEtagState, response.etag);
    store.set(editorModifiedAtState, response.modifiedAt);
    store.set(editorLineEndingState, response.lineEnding);
  } catch (error) {
    resetEditorState(store);
    store.set(editorErrorState, getErrorMessage(error, 'Unable to load file content.'));
  } finally {
    store.set(editorLoadingState, false);
  }
});

export const setEditorContentAction = action<string, void>((store: Store, content: string) => {
  store.set(editorContentState, content);
});

export const discardEditorChangesAction = action((store: Store) => {
  store.set(editorContentState, store.get(editorOriginalContentState));
  store.set(editorErrorState, null);
});

export const saveSelectedFileContentAction = action(async (store: Store) => {
  const selectedItem = getSelectedItemFromStore(store);
  const rootId = store.get(activeRootIdState);
  const etag = store.get(editorEtagState);

  if (!selectedItem || !rootId || !etag || selectedItem.type !== 'file' || !selectedItem.editable) {
    return false;
  }

  store.set(editorSavingState, true);
  store.set(editorErrorState, null);

  try {
    const response = await saveFileContent({
      rootId,
      path: selectedItem.path,
      content: store.get(editorContentState),
      etag,
    });

    const savedContent = store.get(editorContentState);
    store.set(editorOriginalContentState, savedContent);
    store.set(editorEtagState, response.etag);
    store.set(editorModifiedAtState, response.modifiedAt);
    store.set(editorLineEndingState, response.lineEnding);
    await refreshFiles(store);
    return true;
  } catch (error) {
    store.set(editorErrorState, getErrorMessage(error, 'Unable to save file.'));
    return false;
  } finally {
    store.set(editorSavingState, false);
  }
});

export const createFolderAction = action<{ name: string }, Promise<boolean>>(
  async (store: Store, payload) => {
    const rootId = store.get(activeRootIdState);

    if (!rootId) {
      return false;
    }

    store.set(fileMutationPendingState, true);
    store.set(fileMutationErrorState, null);

    try {
      await createFolder({
        rootId,
        parentPath: store.get(currentPathState),
        name: payload.name,
      });
      await refreshFiles(store);
      return true;
    } catch (error) {
      store.set(fileMutationErrorState, getErrorMessage(error, 'Unable to create folder.'));
      return false;
    } finally {
      store.set(fileMutationPendingState, false);
    }
  },
);

export const renameSelectedItemAction = action<{ newName: string }, Promise<boolean>>(
  async (store: Store, payload) => {
    const rootId = store.get(activeRootIdState);
    const selectedItem = getSelectedItemFromStore(store);

    if (!rootId || !selectedItem) {
      return false;
    }

    store.set(fileMutationPendingState, true);
    store.set(fileMutationErrorState, null);

    try {
      const response = await renamePath({
        rootId,
        path: selectedItem.path,
        newName: payload.newName,
      });
      store.set(selectedItemPathState, response.path);
      store.set(selectedItemState, {
        ...selectedItem,
        name: payload.newName,
        path: response.path,
      });
      await refreshFiles(store);
      return true;
    } catch (error) {
      store.set(fileMutationErrorState, getErrorMessage(error, 'Unable to rename item.'));
      return false;
    } finally {
      store.set(fileMutationPendingState, false);
    }
  },
);

export const deleteSelectedItemAction = action(async (store: Store) => {
  const rootId = store.get(activeRootIdState);
  const selectedItem = getSelectedItemFromStore(store);

  if (!rootId || !selectedItem) {
    return false;
  }

  store.set(fileMutationPendingState, true);
  store.set(fileMutationErrorState, null);

  try {
    await deletePath({
      rootId,
      path: selectedItem.path,
    });
    resetSelectionState(store);
    await refreshFiles(store);
    return true;
  } catch (error) {
    store.set(fileMutationErrorState, getErrorMessage(error, 'Unable to delete item.'));
    return false;
  } finally {
    store.set(fileMutationPendingState, false);
  }
});

export const moveSelectedItemAction = action<{ targetDirPath: string }, Promise<boolean>>(
  async (store: Store, payload) => {
    const rootId = store.get(activeRootIdState);
    const selectedItem = getSelectedItemFromStore(store);

    if (!rootId || !selectedItem) {
      return false;
    }

    store.set(fileMutationPendingState, true);
    store.set(fileMutationErrorState, null);

    try {
      const response = await movePath({
        rootId,
        sourcePath: selectedItem.path,
        targetDirPath: payload.targetDirPath,
      });
      store.set(selectedItemPathState, response.path);
      store.set(selectedItemState, {
        ...selectedItem,
        path: response.path,
      });
      await refreshFiles(store);
      return true;
    } catch (error) {
      store.set(fileMutationErrorState, getErrorMessage(error, 'Unable to move item.'));
      return false;
    } finally {
      store.set(fileMutationPendingState, false);
    }
  },
);

export const uploadFileAction = action<{ file: File }, Promise<boolean>>(
  async (store: Store, payload) => {
    const rootId = store.get(activeRootIdState);

    if (!rootId) {
      return false;
    }

    store.set(fileMutationPendingState, true);
    store.set(fileMutationErrorState, null);

    try {
      await uploadFile({
        rootId,
        targetPath: store.get(currentPathState),
        file: payload.file,
      });
      await refreshFiles(store);
      return true;
    } catch (error) {
      store.set(fileMutationErrorState, getErrorMessage(error, 'Unable to upload file.'));
      return false;
    } finally {
      store.set(fileMutationPendingState, false);
    }
  },
);

export const createExportForSelectedAction = action(async (store: Store) => {
  const rootId = store.get(activeRootIdState);
  const selectedItem = getSelectedItemFromStore(store);

  if (!rootId || !selectedItem) {
    return null;
  }

  if (selectedItem.type === 'file') {
    return {
      kind: 'file' as const,
      rootId,
      path: selectedItem.path,
    };
  }

  store.set(fileMutationPendingState, true);
  store.set(fileMutationErrorState, null);

  try {
    const job = await createExportJob({
      rootId,
      path: selectedItem.path,
    });
    store.set(exportJobsState, upsertById(store.get(exportJobsState), job));
    return {
      kind: 'job' as const,
      id: job.id,
    };
  } catch (error) {
    store.set(fileMutationErrorState, getErrorMessage(error, 'Unable to create export job.'));
    return null;
  } finally {
    store.set(fileMutationPendingState, false);
  }
});

export const createBackupForSelectedAction = action<
  { targetPath: string; conflictPolicy: BackupConflictPolicy },
  Promise<BackupJobSummary | null>
>(async (store: Store, payload) => {
  const rootId = store.get(activeRootIdState);
  const selectedItem = getSelectedItemFromStore(store);

  if (!rootId || !selectedItem) {
    return null;
  }

  store.set(fileMutationPendingState, true);
  store.set(fileMutationErrorState, null);

  try {
    const job = await createBackupJob({
      rootId,
      path: selectedItem.path,
      targetPath: payload.targetPath,
      conflictPolicy: payload.conflictPolicy,
    });
    store.set(backupJobsState, upsertById(store.get(backupJobsState), job));
    return job;
  } catch (error) {
    store.set(fileMutationErrorState, getErrorMessage(error, 'Unable to create backup job.'));
    return null;
  } finally {
    store.set(fileMutationPendingState, false);
  }
});

export const retryBackupJobAction = action<{ id: string }, Promise<BackupJobSummary | null>>(
  async (store: Store, payload) => {
    store.set(fileMutationPendingState, true);
    store.set(fileMutationErrorState, null);

    try {
      const job = await retryBackupJob(payload.id);
      store.set(backupJobsState, upsertById(store.get(backupJobsState), job));
      return job;
    } catch (error) {
      store.set(fileMutationErrorState, getErrorMessage(error, 'Unable to retry backup job.'));
      return null;
    } finally {
      store.set(fileMutationPendingState, false);
    }
  },
);
