import * as vscode from 'vscode';
import type { CommandControllerShape } from './shape';
import type { QuickAction } from './types';

export async function openQuickActions(this: CommandControllerShape): Promise<void> {
  const actions: QuickAction[] = [
    { label: 'Refresh', run: () => this.state.refreshAll() },
    { label: 'Search branches', run: async () => vscode.commands.executeCommand('vscodeGitClient.branch.search') },
    { label: 'Create branch', run: async () => vscode.commands.executeCommand('vscodeGitClient.branch.create') },
    { label: 'Checkout branch', run: async () => vscode.commands.executeCommand('vscodeGitClient.branch.checkout') },
    { label: 'Create stash', run: async () => vscode.commands.executeCommand('vscodeGitClient.stash.create') },
    { label: 'Open stash patch preview', run: async () => vscode.commands.executeCommand('vscodeGitClient.stash.previewPatch') },
    { label: 'Open compare branches', run: async () => vscode.commands.executeCommand('vscodeGitClient.compare.open') },
    { label: 'Open diff workflow', run: async () => vscode.commands.executeCommand('vscodeGitClient.diff.open') },
    { label: 'Apply patch to working tree', run: async () => vscode.commands.executeCommand('vscodeGitClient.commit.applyPatch') },
    { label: 'Open merge conflict', run: async () => vscode.commands.executeCommand('vscodeGitClient.merge.openConflict') },
    { label: 'Filter graph', run: async () => vscode.commands.executeCommand('vscodeGitClient.graph.filter') },
    { label: 'Clear graph filters', run: async () => vscode.commands.executeCommand('vscodeGitClient.graph.clearFilter') },
    { label: 'Fetch --prune', run: async () => vscode.commands.executeCommand('vscodeGitClient.git.fetchPrune') },
    { label: 'Push with preview', run: async () => vscode.commands.executeCommand('vscodeGitClient.git.pushWithPreview') },
    { label: 'Pull with preview', run: async () => vscode.commands.executeCommand('vscodeGitClient.git.pullWithPreview') },
    { label: 'Stage selected hunks', run: async () => vscode.commands.executeCommand('vscodeGitClient.stage.patch') },
    { label: 'Stage file', run: async () => vscode.commands.executeCommand('vscodeGitClient.stage.file') },
    { label: 'Unstage file', run: async () => vscode.commands.executeCommand('vscodeGitClient.unstage.file') },
    { label: 'Amend last commit', run: async () => vscode.commands.executeCommand('vscodeGitClient.commit.amend') },
    { label: 'Open file blame', run: async () => vscode.commands.executeCommand('vscodeGitClient.fileBlame.open') },
    { label: 'Worktree: Add from branch', run: async () => vscode.commands.executeCommand('vscodeGitClient.worktree.addFromBranch') },
    { label: 'Worktree: Add new branch', run: async () => vscode.commands.executeCommand('vscodeGitClient.worktree.addNewBranch') },
    { label: 'Worktree: Prune stale (preview)', run: async () => vscode.commands.executeCommand('vscodeGitClient.worktree.prunePreview') },
    { label: 'Submodule: Init all', run: async () => vscode.commands.executeCommand('vscodeGitClient.submodule.initAll') },
    { label: 'Submodule: Update all', run: async () => vscode.commands.executeCommand('vscodeGitClient.submodule.updateAll') },
    { label: 'Submodule: Sync all', run: async () => vscode.commands.executeCommand('vscodeGitClient.submodule.syncAll') }
  ];

  const picked = await vscode.window.showQuickPick(
    actions.map((action) => ({
      label: action.label,
      description: action.description
    })),
    {
      title: 'VS Code Git Client Quick Actions',
      placeHolder: 'Pick a Git action'
    }
  );

  if (!picked) {
    return;
  }

  const action = actions.find((item) => item.label === picked.label);
  if (!action) {
    return;
  }

  await action.run();
}
