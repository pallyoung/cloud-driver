import type { FileItem } from '@cloud-driver/shared';

export function sortFileItems(items: FileItem[]): FileItem[] {
  return [...items].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'directory' ? -1 : 1;
    }

    return left.name.localeCompare(right.name, 'zh-CN', {
      numeric: true,
      sensitivity: 'base',
    });
  });
}
