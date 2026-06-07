import * as vscode from 'vscode';
import { confirmDangerousAction } from '../../guards';
import type { CommandControllerShape } from './shape';
import { normalizeBranchActionHubArg, resolveBranchNameForActionHub } from './branchNameHelpers';
import { pickBranchName } from './pickBranchName';
import { startMergeOperation, startRebaseOperation } from './operationHandlers';

export async function openBranchActionHub(this: CommandControllerShape, arg?: unknown): Promise<void> {
  const explicitBranchArg = normalizeBranchActionHubArg(arg);
  const branchName =
    (explicitBranchArg ? resolveBranchNameForActionHub.call(this, explicitBranchArg) ?? explicitBranchArg : undefined)
    ?? (await pickBranchName.call(this, 'Pick branch for VS Code Git Client actions'));

  if (!branchName) {
    return;
  }

  const currentBranch = await this.git.getCurrentBranch();
  const branch = this.state.branches.find((item) => item.name === branchName || item.shortName === branchName);
  const isCurrentBranch = branch ? branch.current : branchName === currentBranch;
  const canRenameOrDelete = branch ? branch.type !== 'remote' : false;

  type BranchHubAction = {
    id: string;
    label: string;
    description?: string;
    run: () => Promise<void>;
  };

  const actions: BranchHubAction[] = [];

  if (!isCurrentBranch) {
    actions.push({
      id: 'checkout',
      label: 'Checkout branch',
      run: async () => {
        await this.git.checkoutBranch(branchName);
        await this.state.refreshAll();
      }
    });
  }

  actions.push({
    id: 'compare',
    label: 'Compare with current',
    description: `${currentBranch} ↔ ${branchName}`,
    run: async () => {
      await this.editor.openBranchCompare(currentBranch, branchName);
    }
  });

  if (canRenameOrDelete) {
    actions.push({
      id: 'rename',
      label: 'Rename branch',
      run: async () => {
        const renamedTo = await vscode.window.showInputBox({
          title: `Rename branch ${branchName}`,
          value: branchName,
          validateInput: (value) => (value.trim() ? undefined : 'Branch name is required')
        });

        if (!renamedTo || renamedTo.trim() === branchName) {
          return;
        }

        await this.git.renameBranch(branchName, renamedTo.trim());
        await this.state.refreshAll();
      }
    });

    actions.push({
      id: 'delete',
      label: 'Delete branch',
      run: async () => {
        const confirmed = await confirmDangerousAction({
          title: 'Delete branch',
          detail: `Branch: ${branchName}`,
          acceptLabel: 'Delete'
        });

        if (!confirmed) {
          return;
        }

        await this.git.deleteBranch(branchName);
        await this.state.refreshAll();
      }
    });
  }

  if (!isCurrentBranch) {
    actions.push({
      id: 'merge',
      label: 'Merge into current branch',
      description: `${branchName} → ${currentBranch}`,
      run: async () => {
        const confirmed = await confirmDangerousAction({
          title: 'Merge into current branch',
          detail: `Source branch: ${branchName}`,
          acceptLabel: 'Merge'
        });

        if (!confirmed) {
          return;
        }

        await startMergeOperation.call(this, () => this.git.mergeIntoCurrent(branchName));
      }
    });

    actions.push({
      id: 'rebase',
      label: 'Rebase current onto this branch',
      description: `${currentBranch} onto ${branchName}`,
      run: async () => {
        const confirmed = await confirmDangerousAction({
          title: 'Rebase current branch',
          detail: `Rebase onto: ${branchName}`,
          acceptLabel: 'Rebase'
        });

        if (!confirmed) {
          return;
        }

        await startRebaseOperation.call(this, () => this.git.rebaseCurrentOnto(branchName));
      }
    });
  }

  const picked = await vscode.window.showQuickPick(
    actions.map((action) => ({
      label: action.label,
      description: action.description,
      id: action.id
    })),
    {
      title: `Branch actions: ${branchName}`,
      placeHolder: 'Choose an action'
    }
  );

  if (!picked) {
    return;
  }

  const action = actions.find((item) => item.id === picked.id);
  if (!action) {
    return;
  }

  await action.run();
}
