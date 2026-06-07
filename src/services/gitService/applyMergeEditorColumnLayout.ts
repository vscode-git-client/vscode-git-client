import * as vscode from 'vscode';

export async function applyMergeEditorColumnLayout(): Promise<void> {
  const commandCandidates = [
    'merge.columnLayout',
    'mergeEditor.setColumnLayout',
    'workbench.action.mergeEditor.setColumnLayout'
  ];
  for (const cmd of commandCandidates) {
    try {
      await vscode.commands.executeCommand(cmd);
      return;
    } catch {
      // try next candidate
    }
  }
}
