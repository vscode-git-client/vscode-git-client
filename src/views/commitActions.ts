import * as vscode from 'vscode';
import { CommandId } from '../commands/commandController/commandIds';

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
      if (normalizedShas.length === 1) {
        await vscode.commands.executeCommand(CommandId.GraphOpenDetails, {
          sha,
          subject: normalizedSubjects[0] ?? message.subject
        });
        return;
      }
      await runForEachSha(CommandId.GraphOpenDetails);
      return;
    case 'copyCommitId':
      await vscode.env.clipboard.writeText(normalizedShas.join('\n'));
      void vscode.window.setStatusBarMessage(
        normalizedShas.length > 1 ? `Copied ${normalizedShas.length} commit IDs` : `Copied commit ID ${sha}`,
        1500
      );
      return;
    case 'copyCommitMessage':
      if (normalizedSubjects.length === 0) {
        return;
      }
      await vscode.env.clipboard.writeText(normalizedSubjects.join('\n'));
      void vscode.window.setStatusBarMessage(
        normalizedSubjects.length > 1 ? `Copied ${normalizedSubjects.length} commit messages` : 'Copied commit message',
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
      await runForEachSha(CommandId.GraphCreatePatch);
      return;
    case 'cherryPick':
      await runForEachSha(CommandId.GraphCherryPick);
      return;
    case 'checkoutRevision':
      await vscode.commands.executeCommand(CommandId.GraphCheckoutCommit, sha);
      return;
    case 'showRepositoryAtRevision':
      await vscode.commands.executeCommand(CommandId.GraphShowRepositoryAtRevision, sha);
      return;
    case 'compareWithLocal':
      await vscode.commands.executeCommand(CommandId.GraphCompareWithCurrent, sha);
      return;
    case 'resetCurrentBranchToHere':
      await vscode.commands.executeCommand(CommandId.BranchResetCurrentToCommit, sha);
      return;
    case 'revertCommit':
      await runForEachSha(CommandId.GraphRevert);
      return;
    case 'interactiveRebaseFromHere':
      await vscode.commands.executeCommand(CommandId.GraphRebaseInteractiveFromHere, sha);
      return;
    case 'editCommitMessage':
      await vscode.commands.executeCommand(CommandId.GraphEditCommitMessage, sha);
      return;
    case 'pushAllUpToHere':
      await vscode.commands.executeCommand(CommandId.GraphPushAllUpToHere, sha);
      return;
    case 'newBranch':
      await vscode.commands.executeCommand(CommandId.GraphCreateBranchHere, sha);
      return;
    case 'newTag':
      await vscode.commands.executeCommand(CommandId.GraphCreateTagHere, sha);
      return;
    case 'goToParentCommit':
      await vscode.commands.executeCommand(CommandId.GraphGoToParentCommit, sha);
      return;
    case 'goToChildCommit':
      await vscode.commands.executeCommand(CommandId.GraphGoToChildCommit, sha);
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
    (Array.isArray(candidate.subjects) && candidate.subjects.every((item) => typeof item === 'string'));
  return candidate.type === 'commitAction'
    && typeof candidate.action === 'string'
    && typeof candidate.sha === 'string'
    && (candidate.subject === undefined || typeof candidate.subject === 'string')
    && hasValidShas
    && hasValidSubjects;
}
