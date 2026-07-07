import type { CommitSelectableFileTreeItem } from "../../providers/commitFilesTreeProvider";
import type { GraphCommitFileTreeItem } from "../../providers/graphTreeProvider";

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