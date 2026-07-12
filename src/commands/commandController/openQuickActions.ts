import type { CommandController } from '.';
import { GitCommand } from '../../config/commands';
import type { CommandQuickAction } from '../types';
import * as vscode from 'vscode';

export async function openQuickActions(this: CommandController): Promise<void> {
  const actions: CommandQuickAction[] = [
    { label: 'Refresh', run: () => this.state.refreshAll() },
    {
      label: 'Search branches',
      run: async () => vscode.commands.executeCommand(GitCommand.BranchSearch)
    },
    {
      label: 'Create branch',
      run: async () => vscode.commands.executeCommand(GitCommand.BranchCreate)
    },
    {
      label: 'Checkout branch',
      run: async () => vscode.commands.executeCommand(GitCommand.BranchCheckout)
    },
    {
      label: 'Create stash',
      run: async () => vscode.commands.executeCommand(GitCommand.StashCreate)
    },
    {
      label: 'Open stash patch preview',
      run: async () => vscode.commands.executeCommand(GitCommand.StashPreviewPatch)
    },
    {
      label: 'Open compare branches',
      run: async () => vscode.commands.executeCommand(GitCommand.CompareOpen)
    },
    {
      label: 'Open diff workflow',
      run: async () => vscode.commands.executeCommand(GitCommand.DiffOpen)
    },
    {
      label: 'Apply patch to working tree',
      run: async () => vscode.commands.executeCommand(GitCommand.CommitApplyPatch)
    },
    {
      label: 'Open merge conflict',
      run: async () => vscode.commands.executeCommand(GitCommand.MergeOpenConflict)
    },
    {
      label: 'Filter graph',
      run: async () => vscode.commands.executeCommand(GitCommand.GraphFilter)
    },
    {
      label: 'Clear graph filters',
      run: async () => vscode.commands.executeCommand(GitCommand.GraphClearFilter)
    },
    {
      label: 'Fetch --prune',
      run: async () => vscode.commands.executeCommand(GitCommand.GitFetchPrune)
    },
    {
      label: 'Push with preview',
      run: async () => vscode.commands.executeCommand(GitCommand.GitPushWithPreview)
    },
    {
      label: 'Pull with preview',
      run: async () => vscode.commands.executeCommand(GitCommand.GitPullWithPreview)
    },
    {
      label: 'Force SSH pull (GitHub)',
      run: async () => vscode.commands.executeCommand(GitCommand.GitSshPullGithub)
    },
    {
      label: 'Force SSH pull (GitLab)',
      run: async () => vscode.commands.executeCommand(GitCommand.GitSshPullGitlab)
    },
    {
      label: 'Force SSH pull (Bitbucket)',
      run: async () => vscode.commands.executeCommand(GitCommand.GitSshPullBitbucket)
    },
    {
      label: 'Force SSH pull (Custom server)',
      run: async () => vscode.commands.executeCommand(GitCommand.GitSshPullCustom)
    },
    {
      label: 'Stage selected hunks',
      run: async () => vscode.commands.executeCommand(GitCommand.StagePatch)
    },
    {
      label: 'Stage file',
      run: async () => vscode.commands.executeCommand(GitCommand.StageFile)
    },
    {
      label: 'Unstage file',
      run: async () => vscode.commands.executeCommand(GitCommand.UnstageFile)
    },
    {
      label: 'Amend last commit',
      run: async () => vscode.commands.executeCommand(GitCommand.CommitAmend)
    },
    {
      label: 'Open file blame',
      run: async () => vscode.commands.executeCommand(GitCommand.FileBlameOpen)
    },
    {
      label: 'Worktree: Add from branch',
      run: async () => vscode.commands.executeCommand(GitCommand.WorktreeAddFromBranch)
    },
    {
      label: 'Worktree: Add new branch',
      run: async () => vscode.commands.executeCommand(GitCommand.WorktreeAddNewBranch)
    },
    {
      label: 'Worktree: Prune stale (preview)',
      run: async () => vscode.commands.executeCommand(GitCommand.WorktreePrunePreview)
    },
    {
      label: 'Submodule: Init all',
      run: async () => vscode.commands.executeCommand(GitCommand.SubmoduleInitAll)
    },
    {
      label: 'Submodule: Update all',
      run: async () => vscode.commands.executeCommand(GitCommand.SubmoduleUpdateAll)
    },
    {
      label: 'Submodule: Sync all',
      run: async () => vscode.commands.executeCommand(GitCommand.SubmoduleSyncAll)
    }
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
