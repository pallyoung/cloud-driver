import { useCallback } from 'react';
import { languageState } from '../state/app-state';
import { useRelaxValue } from '../state/relax';
import { formatDateTime } from '../lib/i18n';

export function useI18n() {
  const language = useRelaxValue(languageState);
  const isChinese = language === 'zh-CN';

  const pick = useCallback(
    <T,>(zhValue: T, enValue: T): T => (isChinese ? zhValue : enValue),
    [isChinese],
  );

  const formatDate = useCallback(
    (value: string | null, options?: Intl.DateTimeFormatOptions) =>
      formatDateTime(value, language, options),
    [language],
  );

  return {
    formatDate,
    isChinese,
    language,
    pick,
  };
}
