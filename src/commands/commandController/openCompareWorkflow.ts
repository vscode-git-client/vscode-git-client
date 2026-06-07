import * as vscode from 'vscode';
import type { CommandControllerShape } from './shape';

export async function openCompareWorkflow(this: CommandControllerShape): Promise<void> {
  const left =
    (await vscode.window.showInputBox({
      title: 'Compare branches',
      placeHolder: 'Left ref (default: current branch)'
    }))?.trim() || (await this.git.getCurrentBranch());

  const right =
    (await vscode.window.showInputBox({
      title: `Compare against ${left}`,
      placeHolder: 'Right ref'
    }))?.trim() ?? '';

  if (!right) {
    return;
  }

  await this.editor.openBranchCompare(left, right);

  const followUp = await vscode.window.showQuickPick(
    ['Open changed file diff', 'Cherry-pick commit range', 'No more actions'],
    { title: 'Branch comparison action' }
  );

  if (followUp === 'Open changed file diff') {
    await this.editor.openBranchComparisonFileDiff(left, right);
  } else if (followUp === 'Cherry-pick commit range') {
    await vscode.commands.executeCommand('vscodeGitClient.graph.cherryPickRange');
  }
}
