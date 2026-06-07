import {
  CommitFileTreeItem,
  CommitFolderTreeItem,
  CommitRangeFileTreeItem,
  WorkingTreeCompareFileTreeItem
} from '../../providers/commitFilesTreeProvider';
import { GraphCommitFileTreeItem } from '../../providers/graphTreeProvider';
import type { SelectableChangeTreeItem } from './types';

export function extractSelectableItem(value: unknown): SelectableChangeTreeItem | undefined {
  if (value instanceof GraphCommitFileTreeItem) {
    return value;
  }
  if (value instanceof CommitFileTreeItem) {
    return value;
  }
  if (value instanceof CommitRangeFileTreeItem) {
    return value;
  }
  if (value instanceof WorkingTreeCompareFileTreeItem) {
    return value;
  }
  if (value instanceof CommitFolderTreeItem) {
    return value;
  }
  return undefined;
}

export function toSelectedItems(arg: unknown, selectedArg: unknown): SelectableChangeTreeItem[] {
  const selectedList = Array.isArray(selectedArg) ? selectedArg : [];
  const first = extractSelectableItem(arg);
  const fromSelected = selectedList
    .map((item) => extractSelectableItem(item))
    .filter((item): item is SelectableChangeTreeItem => Boolean(item));

  const all = [...fromSelected];
  if (first) {
    all.unshift(first);
  }

  return [...new Set(all)];
}
