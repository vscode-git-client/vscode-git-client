import * as vscode from 'vscode';
import type { CommandControllerShape } from './shape';
import { pickCommitSha } from './pickCommitSha';
import { pickFileFromWorkspace } from './pickFileFromWorkspace';

export async function openDiffWorkflow(this: CommandControllerShape): Promise<void> {
  const mode = await vscode.window.showQuickPick(
    [
      'Working tree vs HEAD',
      'Index vs HEAD',
      'Commit vs parent',
      'Any two refs for one file'
    ],
    { title: 'Open side-by-side diff' }
  );

  if (!mode) {
    return;
  }

  if (mode === 'Commit vs parent') {
    const sha = await pickCommitSha.call(this, 'Pick commit');
    if (!sha) {
      return;
    }
    await this.editor.openCommitFilesDiff(sha);
    return;
  }

  let leftRef = 'HEAD';
  let rightRef = 'WORKTREE';

  if (mode === 'Index vs HEAD') {
    leftRef = 'HEAD';
    rightRef = 'INDEX';
  }

  if (mode === 'Any two refs for one file') {
    leftRef =
      (await vscode.window.showInputBox({ title: 'Left ref', placeHolder: 'e.g. main, HEAD~1, abc1234' }))?.trim() ?? '';
    rightRef =
      (await vscode.window.showInputBox({ title: 'Right ref', placeHolder: 'e.g. feature/x, HEAD, def5678' }))?.trim() ?? '';

    if (!leftRef || !rightRef) {
      return;
    }
  }

  const filePath = await pickFileFromWorkspace.call(this, 'Pick file to diff');
  if (!filePath) {
    return;
  }

  await this.editor.openDiffForFile({
    path: filePath,
    leftRef,
    rightRef,
    title: `${mode} · ${filePath}`
  });
}
