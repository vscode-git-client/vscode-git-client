import type * as vscode from 'vscode';
import type {
  CommitActionContext,
  CommitFileTreeItem,
  CommitSelectableFileTreeItem
} from '../../providers/commitFilesTreeProvider';
import type { GraphCommitFileTreeItem } from '../../providers/graphTreeProvider';

export interface QuickAction {
  label: string;
  description?: string;
  run: () => Promise<void>;
}

export type CherryPickIssueKind = 'conflict' | 'nothingToCherryPick' | 'failed';
export type MergeIssueKind = 'conflict' | 'failed';
export type RebaseIssueKind = 'conflict' | 'failed';

export type GitScmRepository = {
  rootUri: vscode.Uri;
  inputBox: {
    value: string;
  };
};

export type GitScmApi = {
  repositories: GitScmRepository[];
  getRepository(uri: vscode.Uri): GitScmRepository | null;
};

export type GitScmExtensionExports = {
  getAPI(version: 1): GitScmApi;
};

export type SelectableChangeTreeItem = GraphCommitFileTreeItem | CommitSelectableFileTreeItem;

export type SelectedChangeTarget =
  | {
    kind: 'commit';
    sha: string;
    subject: string;
    filePaths: string[];
    canRevert: boolean;
    canCherryPick: boolean;
    canCreatePatch: boolean;
    detailLabel: string;
    shortLabel: string;
  }
  | {
    kind: 'range';
    fromRef: string;
    toRef: string;
    fromLabel: string;
    toLabel: string;
    filePaths: string[];
    canRevert: boolean;
    canCherryPick: boolean;
    canCreatePatch: boolean;
    detailLabel: string;
    shortLabel: string;
  }
  | {
    kind: 'workingTreeCompare';
    ref: string;
    refLabel: string;
    filePaths: string[];
    canRevert: boolean;
    canCherryPick: boolean;
    canCreatePatch: boolean;
    detailLabel: string;
    shortLabel: string;
  };

export interface CommitFilesViewShape {
  getCommitActionContext(selectedItems: readonly CommitSelectableFileTreeItem[]): CommitActionContext | undefined;
  getAllFileItems(): CommitFileTreeItem[];
  showCommit(sha: string, subject: string): Promise<void>;
  clear(): Promise<void>;
  isShowingCommit(sha: string): boolean;
}

export interface WithSubmoduleProgressOptions {
  title: string;
  autoShow: boolean;
  /** Human-readable name for the warning toast, e.g. "Submodule update" */
  command: string;
}
