import * as vscode from 'vscode';

export async function closeEmptyEditorGroups(): Promise<void> {
  const groups = vscode.window.tabGroups.all;
  const allGroupsAreEmpty = groups.every((group) => group.tabs.length === 0);
  const emptyGroups = groups.filter(
    (group) => group.tabs.length === 0 && !(allGroupsAreEmpty && group.isActive)
  );

  if (emptyGroups.length > 0) {
    await vscode.window.tabGroups.close(emptyGroups, true);
  }
}
