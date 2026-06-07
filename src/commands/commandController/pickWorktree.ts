import * as vscode from 'vscode';
import * as path from 'path';
import { resolveWorktreeTargetPath } from '../../services/worktreeTargetPath';
import { pickRevisionToCompare } from '../../views/revisionPicker';
import type { RevisionSelection } from '../../views/revisionPicker';
import type { CommandControllerShape } from './shape';

export async function pickWorktreeRevision(
  this: CommandControllerShape,
  title: string
): Promise<RevisionSelection | undefined> {
  return pickRevisionToCompare(
    this.git,
    () => this.state.branches,
    () => this.state.tags,
    () => this.state.refreshBranches(),
    {
      title,
      placeholder: 'Select a local branch, remote branch, tag, or type a revision',
      emptyPlaceholder: 'No branches or tags found - type a revision',
      loadingPlaceholder: 'Loading branches and tags...',
      refreshingPlaceholder: 'Refreshing branches and tags...',
      allowTypedRevision: true
    }
  );
}

export async function pickWorktreeTargetPath(
  this: CommandControllerShape,
  title: string,
  refName: string
): Promise<string | undefined> {
  const gitRoot = await this.git.getGitRoot();
  const picked = await vscode.window.showOpenDialog({
    title,
    openLabel: 'Use Folder',
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    defaultUri: vscode.Uri.file(path.dirname(gitRoot))
  });

  const selectedFolderPath = picked?.[0]?.fsPath;
  if (!selectedFolderPath) {
    return undefined;
  }

  const resolved = await resolveWorktreeTargetPath(selectedFolderPath, gitRoot, refName);
  if (!resolved.ok) {
    void vscode.window.showErrorMessage(resolved.message);
    return undefined;
  }

  return resolved.targetPath;
}
