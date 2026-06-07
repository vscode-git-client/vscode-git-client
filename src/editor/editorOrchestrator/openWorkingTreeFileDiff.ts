import * as vscode from 'vscode';
import type { EditorOrchestratorShape } from './index';
import {
  formatCompareWithRevisionSideLabel,
  getCompareWithRevisionDirection,
  type ComparableDiffSide,
  type CompareWithRevisionDirection
} from './utils';

export async function openWorkingTreeFileDiff(
  this: EditorOrchestratorShape,
  relativePath: string,
  ref: string,
  refLabel: string,
  opts: { preview: boolean; status?: string; direction?: CompareWithRevisionDirection }
): Promise<void> {
  const direction = opts.direction ?? getCompareWithRevisionDirection();
  const revisionSide: ComparableDiffSide = { kind: 'ref', ref, relativePath };
  const worktreeSide: ComparableDiffSide = { kind: 'worktree', relativePath };
  const leftSide = direction === 'reverse' ? revisionSide : worktreeSide;
  const rightSide = direction === 'reverse' ? worktreeSide : revisionSide;
  const left = await this.createComparableDiffUri(leftSide, opts.status);
  const right = await this.createComparableDiffUri(rightSide, opts.status);

  const title = `${formatCompareWithRevisionSideLabel(leftSide, ref, refLabel)} ↔ ${formatCompareWithRevisionSideLabel(rightSide, ref, refLabel)} · ${relativePath}`;
  await vscode.commands.executeCommand('vscode.diff', left, right, title, {
    preview: opts.preview,
    preserveFocus: false
  });
}
