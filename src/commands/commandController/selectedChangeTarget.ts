import * as vscode from 'vscode';
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
import type { SelectedChangeTarget } from './types';
import { toSelectedItems } from './selectedItems';

export function toSelectedChangeTarget(context: CommitActionContext): SelectedChangeTarget {
  if (context.kind === 'commit') {
    return {
      kind: 'commit',
      sha: context.sha,
      subject: context.subject,
      filePaths: context.filePaths,
      canRevert: context.canRevertSelected,
      canCherryPick: context.canCherryPickSelected,
      canCreatePatch: context.canCreatePatchSelected,
      detailLabel: `Commit: ${context.sha}`,
      shortLabel: context.sha.slice(0, 8)
    };
  }

  if (context.kind === 'workingTreeCompare') {
    return {
      kind: 'workingTreeCompare',
      ref: context.ref,
      refLabel: context.refLabel,
      filePaths: context.filePaths,
      canRevert: context.canRevertSelected,
      canCherryPick: context.canCherryPickSelected,
      canCreatePatch: context.canCreatePatchSelected,
      detailLabel: `Compare with revision: ${context.refLabel}`,
      shortLabel: context.refLabel
    };
  }

  return {
    kind: 'range',
    fromRef: context.fromRef,
    toRef: context.toRef,
    fromLabel: context.fromLabel,
    toLabel: context.toLabel,
    filePaths: context.filePaths,
    canRevert: context.canRevertSelected,
    canCherryPick: context.canCherryPickSelected,
    canCreatePatch: context.canCreatePatchSelected,
    detailLabel: `Range: ${context.fromLabel}..${context.toLabel}`,
    shortLabel: `${context.fromLabel}..${context.toLabel}`
  };
}

export async function resolveSelectedCommitFiles(
  this: CommandControllerShape,
  arg: unknown,
  selectedArg: unknown
): Promise<SelectedChangeTarget | undefined> {
  const selectedItems = toSelectedItems(arg, selectedArg);
  if (
    selectedItems.length > 0 &&
    (
      selectedItems[0] instanceof CommitFileTreeItem ||
      selectedItems[0] instanceof CommitRangeFileTreeItem ||
      selectedItems[0] instanceof WorkingTreeCompareFileTreeItem ||
      selectedItems[0] instanceof CommitFolderTreeItem
    )
  ) {
    const context = this.commitFilesView.getCommitActionContext(selectedItems as CommitSelectableFileTreeItem[]);
    if (!context || context.filePaths.length === 0) {
      return undefined;
    }
    return toSelectedChangeTarget(context);
  }

  const graphItems = selectedItems.filter((item): item is GraphCommitFileTreeItem => item instanceof GraphCommitFileTreeItem);
  if (graphItems.length === 0) {
    return undefined;
  }

  const commitShas = [...new Set(graphItems.map((item) => item.commit.sha))];
  if (commitShas.length !== 1) {
    void vscode.window.showWarningMessage('Select files from a single commit only.');
    return undefined;
  }

  const sha = commitShas[0];
  const commit = graphItems[0].commit;
  const filePaths = [...new Set(graphItems.map((item) => item.filePath))].sort((a, b) => a.localeCompare(b));
  if (filePaths.length === 0) {
    return undefined;
  }

  const canRevert = await this.git.isCommitInCurrentBranch(sha);
  return {
    kind: 'commit',
    sha,
    subject: commit.subject,
    filePaths,
    canRevert,
    canCherryPick: !canRevert,
    canCreatePatch: !canRevert,
    detailLabel: `Commit: ${sha}`,
    shortLabel: sha.slice(0, 8)
  };
}
