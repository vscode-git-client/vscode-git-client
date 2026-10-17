import type { CommandController } from './index';
import * as path from 'path';
import * as vscode from 'vscode';
import { WorktreeTreeItem } from '../../providers/worktreeTreeProvider';
import { parseNameStatusZ } from '../../services/gitParsing';
import { WorkingTreeFileChange } from '../../types';

export async function handleWorktreeViewActiveChanges(
  this: CommandController,
  arg?: unknown
): Promise<void> {
  const item = arg instanceof WorktreeTreeItem ? arg : undefined;
  if (!item) {
    return;
  }

  const worktree = item.worktree;
  const worktreePath = worktree.worktreePath;
  const branchLabel = worktree.branch ?? `detached ${worktree.headSha.slice(0, 8)}`;

  // Gather tracked changes relative to HEAD
  let trackedFiles: WorkingTreeFileChange[] = [];
  try {
    const trackedResult = await this.git.runGitAt(worktreePath, [
      'diff',
      '--name-status',
      '-z',
      'HEAD'
    ]);
    trackedFiles = parseNameStatusZ(trackedResult.stdout).map((entry): WorkingTreeFileChange => ({
      status: entry.status,
      path: entry.path,
      untracked: false
    }));
  } catch {
    // HEAD may not exist (empty repo) — treat as no tracked changes
  }

  // Gather untracked files
  let untrackedFiles: WorkingTreeFileChange[] = [];
  try {
    const untrackedResult = await this.git.runGitAt(worktreePath, [
      'ls-files',
      '--others',
      '--exclude-standard',
      '-z'
    ]);
    untrackedFiles = untrackedResult.stdout
      .split('\0')
      .filter((p) => p.length > 0)
      .map((p): WorkingTreeFileChange => ({ status: 'A', path: p, untracked: true }));
  } catch {
    // Ignore errors
  }

  const trackedPaths = new Set(trackedFiles.map((e) => e.path));
  const allFiles: WorkingTreeFileChange[] = [
    ...trackedFiles,
    ...untrackedFiles.filter((e) => !trackedPaths.has(e.path))
  ].sort((a, b) => a.path.localeCompare(b.path));

  if (allFiles.length === 0) {
    void vscode.window.showInformationMessage(
      `Worktree "${path.basename(worktreePath)}" (${branchLabel}) has no active changes.`
    );
    return;
  }

  const statusLabel: Record<string, string> = {
    A: '(A) Added',
    M: '(M) Modified',
    D: '(D) Deleted',
    R: '(R) Renamed',
    C: '(C) Copied',
    U: '(U) Unmerged',
    T: '(T) Type changed'
  };

  const items = allFiles.map((f) => ({
    label: f.path,
    description: f.untracked
      ? '(?) Untracked'
      : (statusLabel[f.status.toUpperCase()[0]] ?? `(${f.status}) Changed`),
    file: f
  }));

  const picked = await vscode.window.showQuickPick(items, {
    title: `Active Changes — ${path.basename(worktreePath)} (${branchLabel})`,
    placeHolder: `${allFiles.length} file(s) with changes`,
    matchOnDescription: true
  });

  if (!picked) {
    return;
  }

  const file = picked.file;
  const absolutePath = path.join(worktreePath, file.path);
  const statusCode = file.status.toUpperCase()[0];

  if (statusCode === 'D') {
    // Deleted — show HEAD content only via a virtual doc vs empty
    void vscode.window.showInformationMessage(`"${file.path}" was deleted in this worktree.`);
    return;
  }

  if (file.untracked || statusCode === 'A') {
    // Untracked / newly added — open file directly
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(absolutePath));
    return;
  }

  // For modified files: diff HEAD content vs working-tree file
  let headContent = '';
  try {
    const headResult = await this.git.runGitAt(worktreePath, ['show', `HEAD:${file.path}`]);
    headContent = headResult.stdout;
  } catch {
    // File may not exist at HEAD — treat as new
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(absolutePath));
    return;
  }

  const headUri = vscode.Uri.parse(
    `vscodegitclient-worktree:/${encodeURIComponent(worktreePath)}/${file.path}?HEAD`
  );

  // Store head content in the virtual provider via a temporary in-memory store
  // We use a disposable content provider registered for this specific diff session
  const contentProvider = vscode.workspace.registerTextDocumentContentProvider(
    'vscodegitclient-worktree',
    {
      provideTextDocumentContent: () => headContent
    }
  );

  try {
    await vscode.commands.executeCommand(
      'vscode.diff',
      headUri,
      vscode.Uri.file(absolutePath),
      `HEAD ↔ Working Tree · ${file.path} (${path.basename(worktreePath)})`,
      { preview: true }
    );
  } finally {
    contentProvider.dispose();
  }
}
