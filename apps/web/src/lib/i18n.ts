export type AppLanguage = 'zh-CN' | 'en-US';

const LANGUAGE_STORAGE_KEY = 'cloud-driver.language';

export function normalizeLanguage(value?: string | null): AppLanguage {
  if (!value) {
    return 'zh-CN';
  }

  return value.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}

export function getInitialLanguage(): AppLanguage {
  if (typeof window === 'undefined') {
    return 'zh-CN';
  }

  try {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (storedLanguage) {
      return normalizeLanguage(storedLanguage);
    }
  } catch {
    // Ignore storage access failures and fall back to the browser locale.
  }

  return normalizeLanguage(window.navigator.language);
}

export function persistLanguage(language: AppLanguage) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore storage access failures and keep the in-memory state only.
  }
}

export function formatDateTime(
  value: string | null,
  language: AppLanguage,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) {
    return '--';
  }

  return new Intl.DateTimeFormat(
    language,
    options ?? {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(new Date(value));
}
