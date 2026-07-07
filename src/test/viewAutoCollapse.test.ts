import * as assert from 'assert';
import { describe, it } from 'node:test';
import * as vscode from 'vscode';
import { attachSparseRepositoryViewAutoCollapse } from '../viewAutoCollapse';
import { WorktreeEntry } from '../types';

function worktree(overrides: Partial<WorktreeEntry> = {}): WorktreeEntry {
  return {
    worktreePath: '/repo',
    headSha: 'abcdef1234567890',
    branch: 'main',
    isBare: false,
    isDetached: false,
    isCurrent: true,
    isLocked: false,
    lockReason: undefined,
    isPrunable: false,
    isDirty: false,
    ahead: 0,
    behind: 0,
    headSubject: undefined,
    ...overrides
  };
}

function makeState() {
  const emitter = new vscode.EventEmitter<void>();
  return {
    worktreesLoaded: false,
    submodulesLoaded: false,
    worktrees: [] as WorktreeEntry[],
    submodules: [] as unknown[],
    onDidChange: emitter.event,
    fire: () => emitter.fire()
  };
}

function recordExecutedCommands(commands: string[]): typeof vscode.commands.executeCommand {
  return async <T = unknown>(command: string): Promise<T> => {
    commands.push(command);
    return undefined as T;
  };
}

describe('sparse repository view auto-collapse', () => {
  it('waits until worktrees and submodules have both loaded', async () => {
    const state = makeState();
    const commands: string[] = [];
    const originalExecuteCommand = vscode.commands.executeCommand;
    (
      vscode.commands as unknown as {
        executeCommand: typeof vscode.commands.executeCommand;
      }
    ).executeCommand = recordExecutedCommands(commands);

    try {
      attachSparseRepositoryViewAutoCollapse(
        { subscriptions: [] } as unknown as vscode.ExtensionContext,
        state as never,
        { warn: () => undefined } as never
      );

      state.worktreesLoaded = true;
      state.worktrees = [worktree()];
      state.fire();
      await Promise.resolve();

      assert.deepStrictEqual(commands, []);

      state.submodulesLoaded = true;
      state.fire();
      await Promise.resolve();

      assert.deepStrictEqual(commands, [
        'workbench.actions.treeView.vscodeGitClient.worktrees.collapseAll',
        'workbench.actions.treeView.vscodeGitClient.submodules.collapseAll'
      ]);
    } finally {
      (
        vscode.commands as unknown as {
          executeCommand: typeof vscode.commands.executeCommand;
        }
      ).executeCommand = originalExecuteCommand;
    }
  });

  it('collapses once per sparse state and resets when repository layout grows', async () => {
    const state = makeState();
    state.worktreesLoaded = true;
    state.submodulesLoaded = true;
    state.worktrees = [worktree()];

    const commands: string[] = [];
    const originalExecuteCommand = vscode.commands.executeCommand;
    (
      vscode.commands as unknown as {
        executeCommand: typeof vscode.commands.executeCommand;
      }
    ).executeCommand = recordExecutedCommands(commands);

    try {
      attachSparseRepositoryViewAutoCollapse(
        { subscriptions: [] } as unknown as vscode.ExtensionContext,
        state as never,
        { warn: () => undefined } as never
      );
      await Promise.resolve();
      state.fire();
      await Promise.resolve();

      assert.strictEqual(commands.length, 2);

      state.worktrees = [
        worktree(),
        worktree({ worktreePath: '/repo-feature', isCurrent: false, branch: 'feature' })
      ];
      state.fire();
      await Promise.resolve();

      state.worktrees = [worktree()];
      state.fire();
      await Promise.resolve();

      assert.strictEqual(commands.length, 4);
    } finally {
      (
        vscode.commands as unknown as {
          executeCommand: typeof vscode.commands.executeCommand;
        }
      ).executeCommand = originalExecuteCommand;
    }
  });

  it('does not collapse when there are extra worktrees or submodules', async () => {
    const state = makeState();
    state.worktreesLoaded = true;
    state.submodulesLoaded = true;
    state.worktrees = [worktree(), worktree({ worktreePath: '/repo-feature', isCurrent: false })];

    const commands: string[] = [];
    const originalExecuteCommand = vscode.commands.executeCommand;
    (
      vscode.commands as unknown as {
        executeCommand: typeof vscode.commands.executeCommand;
      }
    ).executeCommand = recordExecutedCommands(commands);

    try {
      attachSparseRepositoryViewAutoCollapse(
        { subscriptions: [] } as unknown as vscode.ExtensionContext,
        state as never,
        { warn: () => undefined } as never
      );
      await Promise.resolve();

      state.worktrees = [worktree()];
      state.submodules = [{ path: 'vendor/lib' }];
      state.fire();
      await Promise.resolve();

      assert.deepStrictEqual(commands, []);
    } finally {
      (
        vscode.commands as unknown as {
          executeCommand: typeof vscode.commands.executeCommand;
        }
      ).executeCommand = originalExecuteCommand;
    }
  });
});
