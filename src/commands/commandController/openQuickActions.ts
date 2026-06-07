import * as vscode from 'vscode';
import type { CommandControllerShape } from './shape';
import type { QuickAction } from './types';
import { CommandId } from './commandIds';

export async function openQuickActions(this: CommandControllerShape): Promise<void> {
  const actions: QuickAction[] = [
    { label: 'Refresh', run: () => this.state.refreshAll() },
    { label: 'Search branches', run: async () => vscode.commands.executeCommand('vscodeGitClient.branch.search') },
    { label: 'Create branch', run: async () => vscode.commands.executeCommand(CommandId.BranchCreate) },
    { label: 'Checkout branch', run: async () => vscode.commands.executeCommand(CommandId.BranchCheckout) },
    { label: 'Create stash', run: async () => vscode.commands.executeCommand(CommandId.StashCreate) },
    { label: 'Open stash patch preview', run: async () => vscode.commands.executeCommand(CommandId.StashPreviewPatch) },
    { label: 'Open compare branches', run: async () => vscode.commands.executeCommand(CommandId.CompareOpen) },
    { label: 'Open diff workflow', run: async () => vscode.commands.executeCommand(CommandId.DiffOpen) },
    { label: 'Apply patch to working tree', run: async () => vscode.commands.executeCommand(CommandId.CommitApplyPatch) },
    { label: 'Open merge conflict', run: async () => vscode.commands.executeCommand(CommandId.MergeOpenConflict) },
    { label: 'Filter graph', run: async () => vscode.commands.executeCommand(CommandId.GraphFilter) },
    { label: 'Clear graph filters', run: async () => vscode.commands.executeCommand(CommandId.GraphClearFilter) },
    { label: 'Fetch --prune', run: async () => vscode.commands.executeCommand(CommandId.GitFetchPrune) },
    { label: 'Push with preview', run: async () => vscode.commands.executeCommand(CommandId.GitPushWithPreview) },
    { label: 'Pull with preview', run: async () => vscode.commands.executeCommand(CommandId.GitPullWithPreview) },
    { label: 'Stage selected hunks', run: async () => vscode.commands.executeCommand(CommandId.StagePatch) },
    { label: 'Stage file', run: async () => vscode.commands.executeCommand(CommandId.StageFile) },
    { label: 'Unstage file', run: async () => vscode.commands.executeCommand(CommandId.UnstageFile) },
    { label: 'Amend last commit', run: async () => vscode.commands.executeCommand(CommandId.CommitAmend) },
    { label: 'Open file blame', run: async () => vscode.commands.executeCommand(CommandId.FileBlameOpen) },
    { label: 'Worktree: Add from branch', run: async () => vscode.commands.executeCommand(CommandId.WorktreeAddFromBranch) },
    { label: 'Worktree: Add new branch', run: async () => vscode.commands.executeCommand(CommandId.WorktreeAddNewBranch) },
    { label: 'Worktree: Prune stale (preview)', run: async () => vscode.commands.executeCommand(CommandId.WorktreePrunePreview) },
    { label: 'Submodule: Init all', run: async () => vscode.commands.executeCommand(CommandId.SubmoduleInitAll) },
    { label: 'Submodule: Update all', run: async () => vscode.commands.executeCommand(CommandId.SubmoduleUpdateAll) },
    { label: 'Submodule: Sync all', run: async () => vscode.commands.executeCommand(CommandId.SubmoduleSyncAll) }
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
