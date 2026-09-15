import * as vscode from 'vscode';
import { GitCommand } from '../config/commands';

export type CommitAction =
  | 'openDetails'
  | 'copyCommitId'
  | 'copyCommitMessage'
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
  readonly reverseOrder?: boolean;
}

export async function handleCommitAction(message: CommitActionMessage): Promise<boolean> {
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
    return false;
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
        return false;
      }
      if (normalizedShas.length === 1) {
        await vscode.commands.executeCommand(GitCommand.GraphOpenDetails, {
          sha,
          subject: normalizedSubjects[0] ?? message.subject
        });
        return false;
      }
      await runForEachSha(GitCommand.GraphOpenDetails);
      return false;
    case 'copyCommitId': {
      const orderedShas = message.reverseOrder ? [...normalizedShas].reverse() : normalizedShas;
      await vscode.env.clipboard.writeText(orderedShas.join('\n'));
      void vscode.window.setStatusBarMessage(
        normalizedShas.length > 1
          ? `Copied ${normalizedShas.length} commit IDs${message.reverseOrder ? ' (reversed)' : ''}`
          : `Copied commit ID ${sha}`,
        1500
      );
      return false;
    }
    case 'copyCommitMessage': {
      if (normalizedSubjects.length === 0) {
        return false;
      }
      const orderedSubjects = message.reverseOrder
        ? [...normalizedSubjects].reverse()
        : normalizedSubjects;
      await vscode.env.clipboard.writeText(orderedSubjects.join('\n'));
      void vscode.window.setStatusBarMessage(
        normalizedSubjects.length > 1
          ? `Copied ${normalizedSubjects.length} commit messages${message.reverseOrder ? ' (reversed)' : ''}`
          : 'Copied commit message',
        1500
      );
      return false;
    }
    case 'createPatch':
      if (message.isContinuous && normalizedShas.length > 1) {
        await vscode.commands.executeCommand(
          GitCommand.GraphCreatePatchForRange,
          undefined,
          normalizedShas
        );
        return false;
      }
      await runForEachSha(GitCommand.GraphCreatePatch);
      return false;
    case 'cherryPick':
      if (message.isContinuous && normalizedShas.length > 1) {
        await vscode.commands.executeCommand(GitCommand.GraphCherryPick, undefined, normalizedShas);
        return true;
      }
      await runForEachSha(GitCommand.GraphCherryPick);
      return true;
    case 'checkoutRevision':
      await vscode.commands.executeCommand(GitCommand.GraphCheckoutCommit, sha);
      return true;
    case 'showRepositoryAtRevision':
      await vscode.commands.executeCommand(GitCommand.GraphShowRepositoryAtRevision, sha);
      return false;
    case 'compareWithLocal':
      await vscode.commands.executeCommand(GitCommand.GraphCompareWithCurrent, sha);
      return false;
    case 'resetCurrentBranchToHere':
      await vscode.commands.executeCommand(GitCommand.BranchResetCurrentToCommit, sha);
      return true;
    case 'revertCommit':
      if (message.isContinuous && normalizedShas.length > 1) {
        await vscode.commands.executeCommand(GitCommand.GraphRevert, undefined, normalizedShas);
        return true;
      }
      await runForEachSha(GitCommand.GraphRevert);
      return true;
    case 'interactiveRebaseFromHere':
      await vscode.commands.executeCommand(GitCommand.GraphRebaseInteractiveFromHere, sha);
      return true;
    case 'editCommitMessage':
      await vscode.commands.executeCommand(GitCommand.GraphEditCommitMessage, sha);
      return true;
    case 'pushAllUpToHere':
      await vscode.commands.executeCommand(GitCommand.GraphPushAllUpToHere, sha);
      return true;
    case 'newBranch':
      await vscode.commands.executeCommand(GitCommand.GraphCreateBranchHere, sha);
      return false;
    case 'newTag':
      await vscode.commands.executeCommand(GitCommand.GraphCreateTagHere, sha);
      return false;
    case 'goToParentCommit':
      await vscode.commands.executeCommand(GitCommand.GraphGoToParentCommit, sha);
      return false;
    case 'goToChildCommit':
      await vscode.commands.executeCommand(GitCommand.GraphGoToChildCommit, sha);
      return false;
    default:
      return false;
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
    (candidate.reverseOrder === undefined || typeof candidate.reverseOrder === 'boolean') &&
    hasValidShas &&
    hasValidSubjects
  );
}
