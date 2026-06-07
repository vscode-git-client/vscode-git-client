import {
  CommitFileTreeItem,
  CommitFolderTreeItem,
  CommitRangeFileTreeItem,
  CommitSelectableFileTreeItem,
  WorkingTreeCompareFileTreeItem
} from '../../providers/commitFilesTreeProvider';
import { GraphCommitFileTreeItem } from '../../providers/graphTreeProvider';
import type { CommitActionContext } from '../../providers/commitFilesTreeProvider';
import type { CommandControllerShape } from './shape';
import { toSelectedItems } from './selectedItems';

export async function openCommitActionContextDiffs(
  this: CommandControllerShape,
  context: CommitActionContext
): Promise<void> {
  const orderedPaths = [...new Set(context.filePaths)].sort((a, b) => a.localeCompare(b));
  if (context.kind === 'commit') {
    for (const filePath of orderedPaths) {
      await this.editor.openCommitFileDiffWithStatus(context.sha, filePath, context.fileStatuses?.[filePath]);
    }
    return;
  }

  if (context.kind === 'range') {
    for (const filePath of orderedPaths) {
      await this.editor.openCommitRangeFileDiff(context.fromRef, context.toRef, filePath, {
        fromLabel: context.fromLabel,
        toLabel: context.toLabel
      });
    }
    return;
  }

  for (const filePath of orderedPaths) {
    await this.editor.openWorkingTreeFileDiff(filePath, context.ref, context.refLabel, {
      preview: true,
      status: context.fileStatuses?.[filePath]
    });
  }
}

export async function openSelectedFileDiffs(
  this: CommandControllerShape,
  arg: unknown,
  selectedArg: unknown
): Promise<boolean> {
  const selectedItems = toSelectedItems(arg, selectedArg);
  const commitSelectableItems = selectedItems.filter(
    (item): item is CommitSelectableFileTreeItem =>
      item instanceof CommitFileTreeItem ||
      item instanceof CommitRangeFileTreeItem ||
      item instanceof WorkingTreeCompareFileTreeItem ||
      item instanceof CommitFolderTreeItem
  );
  if (commitSelectableItems.some((item) => item instanceof CommitFolderTreeItem)) {
    const context = this.commitFilesView.getCommitActionContext(commitSelectableItems);
    if (context && context.filePaths.length > 0) {
      await openCommitActionContextDiffs.call(this, context);
      return true;
    }
  }

  const commitViewItems = selectedItems.filter((item): item is CommitFileTreeItem => item instanceof CommitFileTreeItem);
  if (commitViewItems.length > 0) {
    const ordered = [...new Map(
      commitViewItems.map((item) => [`${item.sha}:${item.filePath}:${item.status}`, item] as const)
    ).values()].sort((a, b) => a.filePath.localeCompare(b.filePath));
    for (const item of ordered) {
      await this.editor.openCommitFileDiffWithStatus(item.sha, item.filePath, item.status, { oldPath: item.oldPath });
    }
    return true;
  }

  const rangeItems = selectedItems.filter((item): item is CommitRangeFileTreeItem => item instanceof CommitRangeFileTreeItem);
  if (rangeItems.length > 0) {
    const ordered = [...new Map(
      rangeItems.map((item) => [`${item.fromRef}:${item.toRef}:${item.filePath}:${item.status}`, item] as const)
    ).values()].sort((a, b) => a.filePath.localeCompare(b.filePath));
    for (const item of ordered) {
      await this.editor.openCommitRangeFileDiff(
        item.fromRef,
        item.toRef,
        item.filePath,
        { fromLabel: item.fromLabel, toLabel: item.toLabel }
      );
    }
    return true;
  }

  const workingTreeCompareItems = selectedItems.filter(
    (item): item is WorkingTreeCompareFileTreeItem => item instanceof WorkingTreeCompareFileTreeItem
  );
  if (workingTreeCompareItems.length > 0) {
    const ordered = [...new Map(
      workingTreeCompareItems.map((item) => [`${item.ref}:${item.filePath}:${item.status}`, item] as const)
    ).values()].sort((a, b) => a.filePath.localeCompare(b.filePath));
    for (const item of ordered) {
      await this.editor.openWorkingTreeFileDiff(item.filePath, item.ref, item.refLabel, {
        preview: true,
        status: item.status
      });
    }
    return true;
  }

  const graphItems = selectedItems.filter((item): item is GraphCommitFileTreeItem => item instanceof GraphCommitFileTreeItem);
  if (graphItems.length > 0) {
    const ordered = [...new Map(
      graphItems.map((item) => [`${item.commit.sha}:${item.filePath}`, item] as const)
    ).values()].sort((a, b) => a.filePath.localeCompare(b.filePath));
    for (const item of ordered) {
      await this.editor.openCommitFileDiff(item.commit.sha, item.filePath);
    }
    return true;
  }

  return false;
}
