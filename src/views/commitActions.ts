import * as vscode from 'vscode';
import { GitCommand } from '../config/commands';

export type CommitAction =
  | 'openDetails'
  | 'copyCommitId'
  | 'copyCommitMessage'
  | 'copyRevisionNumber'
  | 'createPatch'
  | 'cherryPick'
  | 'checkoutRevision'
  | 'showRepositoryAtRevision'
  | 'compareWithLocal'
  | 'resetCurrentBranchToHere'
  | 'revertCommit'
  | 'interactiveRebaseFromHere'
  | 'editCommitMessage'
  | 'pushAllUpToHere'
  | 'newBranch'
  | 'newTag'
  | 'goToChildCommit'
  | 'goToParentCommit';

export interface CommitActionMessage {
  readonly type: 'commitAction';
  readonly action: CommitAction;
  readonly sha: string;
  readonly shas?: readonly string[];
  readonly subject?: string;
  readonly subjects?: readonly string[];
  readonly isContinuous?: boolean;
}

export async function handleCommitAction(message: CommitActionMessage): Promise<void> {
  const normalizedShas = Array.from(
    new Set(
      (Array.isArray(message.shas) ? message.shas : [message.sha])
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  );
  const [sha] = normalizedShas;
  const normalizedSubjects = Array.from(
    new Set(
      (Array.isArray(message.subjects) ? message.subjects : [message.subject ?? ''])
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  );
  if (!sha) {
    return;
  }

  const runForEachSha = async (command: string) => {
    for (const item of normalizedShas) {
      await vscode.commands.executeCommand(command, item);
    }
  };

  switch (message.action) {
    case 'openDetails':
      if (message.isContinuous && normalizedShas.length > 1) {
        await vscode.commands.executeCommand(
          GitCommand.GraphOpenCommitRangeDetails,
          undefined,
          normalizedShas
        );
        return;
      }
      if (normalizedShas.length === 1) {
        await vscode.commands.executeCommand(GitCommand.GraphOpenDetails, {
          sha,
          subject: normalizedSubjects[0] ?? message.subject
        });
        return;
      }
      await runForEachSha(GitCommand.GraphOpenDetails);
      return;
    case 'copyCommitId':
      await vscode.env.clipboard.writeText(normalizedShas.join('\n'));
      void vscode.window.setStatusBarMessage(
        normalizedShas.length > 1
          ? `Copied ${normalizedShas.length} commit IDs`
          : `Copied commit ID ${sha}`,
        1500
      );
      return;
    case 'copyCommitMessage':
      if (normalizedSubjects.length === 0) {
        return;
      }
      await vscode.env.clipboard.writeText(normalizedSubjects.join('\n'));
      void vscode.window.setStatusBarMessage(
        normalizedSubjects.length > 1
          ? `Copied ${normalizedSubjects.length} commit messages`
          : 'Copied commit message',
        1500
      );
      return;
    case 'copyRevisionNumber':
      await vscode.env.clipboard.writeText(normalizedShas.join('\n'));
      void vscode.window.setStatusBarMessage(
        normalizedShas.length > 1 ? `Copied ${normalizedShas.length} revisions` : `Copied ${sha}`,
        1500
      );
      return;
    case 'createPatch':
      if (message.isContinuous && normalizedShas.length > 1) {
        await vscode.commands.executeCommand(
          GitCommand.GraphCreatePatchForRange,
          undefined,
          normalizedShas
        );
        return;
      }
      await runForEachSha(GitCommand.GraphCreatePatch);
      return;
    case 'cherryPick':
      if (message.isContinuous && normalizedShas.length > 1) {
        await vscode.commands.executeCommand(
          GitCommand.GraphCherryPick,
          undefined,
          normalizedShas
        );
        return;
      }
      await runForEachSha(GitCommand.GraphCherryPick);
      return;
    case 'checkoutRevision':
      await vscode.commands.executeCommand(GitCommand.GraphCheckoutCommit, sha);
      return;
    case 'showRepositoryAtRevision':
      await vscode.commands.executeCommand(GitCommand.GraphShowRepositoryAtRevision, sha);
      return;
    case 'compareWithLocal':
      await vscode.commands.executeCommand(GitCommand.GraphCompareWithCurrent, sha);
      return;
    case 'resetCurrentBranchToHere':
      await vscode.commands.executeCommand(GitCommand.BranchResetCurrentToCommit, sha);
      return;
    case 'revertCommit':
      if (message.isContinuous && normalizedShas.length > 1) {
        await vscode.commands.executeCommand(
          GitCommand.GraphRevert,
          undefined,
          normalizedShas
        );
        return;
      }
      await runForEachSha(GitCommand.GraphRevert);
      return;
    case 'interactiveRebaseFromHere':
      await vscode.commands.executeCommand(GitCommand.GraphRebaseInteractiveFromHere, sha);
      return;
    case 'editCommitMessage':
      await vscode.commands.executeCommand(GitCommand.GraphEditCommitMessage, sha);
      return;
    case 'pushAllUpToHere':
      await vscode.commands.executeCommand(GitCommand.GraphPushAllUpToHere, sha);
      return;
    case 'newBranch':
      await vscode.commands.executeCommand(GitCommand.GraphCreateBranchHere, sha);
      return;
    case 'newTag':
      await vscode.commands.executeCommand(GitCommand.GraphCreateTagHere, sha);
      return;
    case 'goToParentCommit':
      await vscode.commands.executeCommand(GitCommand.GraphGoToParentCommit, sha);
      return;
    case 'goToChildCommit':
      await vscode.commands.executeCommand(GitCommand.GraphGoToChildCommit, sha);
      return;
    default:
      return;
  }
}

export function isCommitActionMessage(value: unknown): value is CommitActionMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const hasValidShas =
    candidate.shas === undefined ||
    (Array.isArray(candidate.shas) && candidate.shas.every((item) => typeof item === 'string'));
  const hasValidSubjects =
    candidate.subjects === undefined ||
    (Array.isArray(candidate.subjects) &&
      candidate.subjects.every((item) => typeof item === 'string'));
  return (
    candidate.type === 'commitAction' &&
    typeof candidate.action === 'string' &&
    typeof candidate.sha === 'string' &&
    (candidate.subject === undefined || typeof candidate.subject === 'string') &&
    (candidate.isContinuous === undefined || typeof candidate.isContinuous === 'boolean') &&
    hasValidShas &&
    hasValidSubjects
  );
}
