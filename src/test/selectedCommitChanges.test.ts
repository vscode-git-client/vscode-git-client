import * as assert from 'assert';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GitCommand } from '../config/commands';
import { describe, it, afterEach } from 'node:test';
import * as vscode from 'vscode';
import { CommandController } from '../commands/commandController';
import {
  CommitFilesTreeProvider,
  CommitFolderTreeItem,
  CommitRangeFileTreeItem,
  WorkingTreeCompareFileTreeItem
} from '../providers/commitFilesTreeProvider';
import { GraphCommitFileTreeItem } from '../providers/graphTreeProvider';
import { GitService } from '../services/gitService';
import { GraphCommit } from '../types';

function execGit(cwd: string, args: string[]): string {
  return cp.execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function createGraphCommit(sha: string): GraphCommit {
  return {
    sha,
    shortSha: sha.slice(0, 8),
    parents: [],
    refs: [],
    author: 'Tester',
    date: '2026-05-22T00:00:00.000Z',
    subject: 'backup change'
  };
}

function registerController(
  git: Record<string, unknown>,
  state: Record<string, unknown>,
  editor?: Record<string, unknown>,
  commitFilesView?: {
    getCommitActionContext(selectedItems: readonly unknown[]): unknown;
    getAllFileItems(): unknown[];
    showCommit(sha: string, subject: string): Promise<void>;
    clear(): Promise<void>;
    isShowingCommit(sha: string): boolean;
  }
): Map<string, (...args: unknown[]) => Promise<void>> {
  const commands = new Map<string, (...args: unknown[]) => Promise<void>>();

  (
    vscode.commands as unknown as {
      registerCommand: typeof vscode.commands.registerCommand;
    }
  ).registerCommand = (command: string, callback: (...args: unknown[]) => Promise<void>) => {
    commands.set(command, callback);
    return { dispose() {} };
  };

  const controller = new CommandController(
    git as never,
    state as never,
    (editor ?? {}) as never,
    { error() {}, warn() {}, info() {} } as never,
    (commitFilesView ?? {
      getCommitActionContext: () => undefined,
      getAllFileItems: () => [],
      showCommit: async () => undefined,
      clear: async () => undefined,
      isShowingCommit: () => false
    }) as never
  );

  controller.register({ subscriptions: [] } as unknown as vscode.ExtensionContext);
  return commands;
}

describe('selected commit file changes', () => {
  const originalRegisterCommand = vscode.commands.registerCommand;
  const originalShowInformationMessage = vscode.window.showInformationMessage;
  const originalShowWarningMessage = vscode.window.showWarningMessage;

  afterEach(() => {
    (
      vscode.commands as unknown as { registerCommand: typeof vscode.commands.registerCommand }
    ).registerCommand = originalRegisterCommand;
    (
      vscode.window as unknown as {
        showInformationMessage: typeof vscode.window.showInformationMessage;
      }
    ).showInformationMessage = originalShowInformationMessage;
    (
      vscode.window as unknown as { showWarningMessage: typeof vscode.window.showWarningMessage }
    ).showWarningMessage = originalShowWarningMessage;
  });

  it('cherry-picks multiple selected Git Graph file rows from the same commit', async () => {
    const events: string[] = [];
    const sha = 'abcdef1234567890';
    const commit = createGraphCommit(sha);
    const first = new GraphCommitFileTreeItem(
      commit,
      'src/a.ts',
      undefined,
      undefined,
      '/repo',
      false
    );
    const second = new GraphCommitFileTreeItem(
      commit,
      'src/b.ts',
      undefined,
      undefined,
      '/repo',
      false
    );

    (
      vscode.window as unknown as {
        showWarningMessage: typeof vscode.window.showWarningMessage;
      }
    ).showWarningMessage = async (_message: string, _options: unknown, acceptLabel: string) =>
      acceptLabel;
    (
      vscode.window as unknown as {
        showInformationMessage: typeof vscode.window.showInformationMessage;
      }
    ).showInformationMessage = async (message: string) => {
      events.push(`message:${message}`);
      return undefined;
    };

    const commands = registerController(
      {
        isCommitInCurrentBranch: async () => false,
        cherryPickCommitFiles: async (ref: string, filePaths: string[]) => {
          events.push(`git:cherry-pick-files:${ref}:${filePaths.join(',')}`);
        }
      },
      {
        branches: [],
        conflicts: [],
        refreshAll: async () => {
          events.push('refresh');
        }
      }
    );

    const cherryPick = commands.get(GitCommand.CommitCherryPickSelectedChanges);
    assert.ok(cherryPick, 'expected selected-changes cherry-pick command to be registered');

    await cherryPick(first, [first, second]);

    assert.deepStrictEqual(events, [
      `git:cherry-pick-files:${sha}:src/a.ts,src/b.ts`,
      'refresh',
      `message:Cherry-picked selected changes from ${sha.slice(0, 8)} into the current checkout.`
    ]);
  });

  it('applies selected cherry-picked file changes to the current checkout without creating a commit', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-git-client-selected-changes-'));
    try {
      execGit(root, ['init', '-q', '-b', 'dev']);
      execGit(root, ['config', 'user.email', 'tester@example.com']);
      execGit(root, ['config', 'user.name', 'Tester']);
      fs.writeFileSync(path.join(root, 'file.txt'), 'base\n');
      execGit(root, ['add', 'file.txt']);
      execGit(root, ['commit', '-q', '-m', 'base']);
      execGit(root, ['checkout', '-q', '-b', 'backup']);
      fs.writeFileSync(path.join(root, 'file.txt'), 'base\nbackup\n');
      execGit(root, ['commit', '-am', 'backup change', '-q']);
      const backupSha = execGit(root, ['rev-parse', 'HEAD']).trim();
      execGit(root, ['checkout', '-q', 'dev']);

      const service = new GitService(
        {
          rootUri: vscode.Uri.file(root),
          rootPath: root
        },
        { error() {}, warn() {}, info() {} } as never,
        vscode.workspace.getConfiguration()
      );

      await service.cherryPickCommitFiles(backupSha, ['file.txt']);

      assert.strictEqual(execGit(root, ['rev-list', '--count', 'HEAD']).trim(), '1');
      assert.strictEqual(execGit(root, ['status', '--short']).trim(), 'M  file.txt');
      assert.ok(fs.readFileSync(path.join(root, 'file.txt'), 'utf8').includes('backup\n'));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('cherry-picks multiple selected Commit Details range file rows', async () => {
    const events: string[] = [];
    const fromRef = 'feature-base^';
    const toRef = 'feature-tip';
    const first = new CommitRangeFileTreeItem(
      fromRef,
      toRef,
      'base',
      'tip',
      'src/a.ts',
      'M',
      '/repo'
    );
    const second = new CommitRangeFileTreeItem(
      fromRef,
      toRef,
      'base',
      'tip',
      'src/b.ts',
      'A',
      '/repo'
    );
    const patch = 'diff --git a/src/a.ts b/src/a.ts\n';

    (
      vscode.window as unknown as {
        showWarningMessage: typeof vscode.window.showWarningMessage;
      }
    ).showWarningMessage = async (_message: string, _options: unknown, acceptLabel: string) =>
      acceptLabel;
    (
      vscode.window as unknown as {
        showInformationMessage: typeof vscode.window.showInformationMessage;
      }
    ).showInformationMessage = async (message: string) => {
      events.push(`message:${message}`);
      return undefined;
    };

    const commands = registerController(
      {
        getPatchBetweenRefsForFiles: async (from: string, to: string, filePaths: string[]) => {
          events.push(`git:range-patch:${from}:${to}:${filePaths.join(',')}`);
          return patch;
        },
        getChangedFiles: async () => [],
        canApplyPatchToWorkingTree: async (value: string) => {
          events.push(`git:can-apply:${value === patch}`);
          return true;
        },
        applyPatchToWorkingTree: async (value: string) => {
          events.push(`git:apply-patch:${value === patch}`);
        }
      },
      {
        branches: [],
        conflicts: [],
        refreshAll: async () => {
          events.push('refresh');
        }
      },
      undefined,
      {
        getCommitActionContext: (selectedItems: readonly unknown[]) => ({
          kind: 'range',
          fromRef,
          toRef,
          fromLabel: 'base',
          toLabel: 'tip',
          filePaths: selectedItems
            .filter(
              (item): item is CommitRangeFileTreeItem => item instanceof CommitRangeFileTreeItem
            )
            .map((item) => item.filePath)
            .sort((a, b) => a.localeCompare(b)),
          canRevertSelected: true,
          canCherryPickSelected: true
        }),
        getAllFileItems: () => [],
        showCommit: async () => undefined,
        clear: async () => undefined,
        isShowingCommit: () => false
      } as never
    );

    const cherryPick = commands.get(GitCommand.CommitCherryPickSelectedChanges);
    assert.ok(cherryPick, 'expected selected-changes cherry-pick command to be registered');

    await cherryPick(first, [first, second]);

    assert.deepStrictEqual(events, [
      `git:range-patch:${fromRef}:${toRef}:src/a.ts,src/b.ts`,
      'git:can-apply:true',
      'git:apply-patch:true',
      'refresh',
      'message:Applied patch from selected changes from base..tip to the current working tree.'
    ]);
  });

  it('opens multiple selected working-tree comparison file diffs from Commit Details', async () => {
    const events: string[] = [];
    const first = new WorkingTreeCompareFileTreeItem(
      'HEAD',
      'HEAD',
      'src/a.ts',
      'M',
      false,
      '/repo'
    );
    const second = new WorkingTreeCompareFileTreeItem(
      'HEAD',
      'HEAD',
      'src/b.ts',
      'A',
      true,
      '/repo'
    );

    const commands = registerController(
      {},
      {
        branches: [],
        conflicts: [],
        refreshAll: async () => undefined
      },
      {
        openWorkingTreeFileDiff: async (
          filePath: string,
          ref: string,
          refLabel: string,
          options: { preview: boolean; status?: string }
        ) => {
          events.push(`${filePath}:${ref}:${refLabel}:${options.preview}:${options.status}`);
        }
      }
    );

    const openDiffs = commands.get(GitCommand.GraphOpenFileDiff);
    assert.ok(openDiffs, 'expected open diffs command to be registered');

    await openDiffs(second, [first, second]);

    assert.deepStrictEqual(events, ['src/a.ts:HEAD:HEAD:true:M', 'src/b.ts:HEAD:HEAD:true:A']);
    assert.ok(first.contextValue?.includes('commitViewSelectableChange'));
  });

  it('treats selected Commit Details folders as all files inside them', async () => {
    const provider = new CommitFilesTreeProvider({
      rootPath: '/repo'
    } as never);
    await provider.showWorkingTreeComparison({
      ref: 'HEAD',
      refLabel: 'HEAD',
      scopePath: 'src',
      files: [
        { path: 'src/a.ts', status: 'M', untracked: false },
        { path: 'src/nested/b.ts', status: 'A', untracked: true }
      ]
    });

    const roots = await provider.getChildren();
    const folder = roots.find(
      (item): item is CommitFolderTreeItem => item instanceof CommitFolderTreeItem
    );
    assert.ok(folder, 'expected folder row');
    assert.ok(folder.contextValue?.includes('commitViewSelectableChange'));

    const context = provider.getCommitActionContext([folder]);
    assert.deepStrictEqual(context?.filePaths, ['src/a.ts', 'src/nested/b.ts']);
  });

  it('opens file diffs for all files inside a selected Commit Details folder', async () => {
    const events: string[] = [];
    const provider = new CommitFilesTreeProvider({
      rootPath: '/repo'
    } as never);
    await provider.showWorkingTreeComparison({
      ref: 'HEAD',
      refLabel: 'HEAD',
      scopePath: 'src',
      files: [
        { path: 'src/a.ts', status: 'M', untracked: false },
        { path: 'src/nested/b.ts', status: 'A', untracked: true }
      ]
    });
    const roots = await provider.getChildren();
    const folder = roots.find(
      (item): item is CommitFolderTreeItem => item instanceof CommitFolderTreeItem
    );
    assert.ok(folder, 'expected folder row');

    const commands = registerController(
      {},
      {
        branches: [],
        conflicts: [],
        refreshAll: async () => undefined
      },
      {
        openWorkingTreeFileDiff: async (filePath: string, ref: string, refLabel: string) => {
          events.push(`${filePath}:${ref}:${refLabel}`);
        }
      },
      provider as never
    );

    const openDiffs = commands.get(GitCommand.GraphOpenFileDiff);
    assert.ok(openDiffs, 'expected open diffs command to be registered');

    await openDiffs(folder, [folder]);

    assert.deepStrictEqual(events, ['src/a.ts:HEAD:HEAD', 'src/nested/b.ts:HEAD:HEAD']);
  });

  it('reverts selected working-tree comparison file rows from Commit Details', async () => {
    const events: string[] = [];
    const ref = 'HEAD~1';
    const first = new WorkingTreeCompareFileTreeItem(
      ref,
      'HEAD~1',
      'src/a.ts',
      'M',
      false,
      '/repo'
    );
    const second = new WorkingTreeCompareFileTreeItem(
      ref,
      'HEAD~1',
      'src/new.ts',
      'A',
      true,
      '/repo'
    );
    const patch = 'diff --git a/src/a.ts b/src/a.ts\n';

    (
      vscode.window as unknown as {
        showWarningMessage: typeof vscode.window.showWarningMessage;
      }
    ).showWarningMessage = async (_message: string, _options: unknown, acceptLabel: string) =>
      acceptLabel;
    (
      vscode.window as unknown as {
        showInformationMessage: typeof vscode.window.showInformationMessage;
      }
    ).showInformationMessage = async (message: string) => {
      events.push(`message:${message}`);
      return undefined;
    };

    const commands = registerController(
      {
        getPatchBetweenWorkingTreeAndRefForFiles: async (revision: string, filePaths: string[]) => {
          events.push(`git:working-tree-patch:${revision}:${filePaths.join(',')}`);
          return patch;
        },
        reverseApplyPatchToWorkingTree: async (value: string) => {
          events.push(`git:reverse-apply:${value === patch}`);
        }
      },
      {
        branches: [],
        conflicts: [],
        refreshAll: async () => {
          events.push('refresh');
        }
      },
      undefined,
      {
        getCommitActionContext: (selectedItems: readonly unknown[]) => ({
          kind: 'workingTreeCompare',
          ref,
          refLabel: 'HEAD~1',
          filePaths: selectedItems
            .filter(
              (item): item is WorkingTreeCompareFileTreeItem =>
                item instanceof WorkingTreeCompareFileTreeItem
            )
            .map((item) => item.filePath)
            .sort((a, b) => a.localeCompare(b)),
          canRevertSelected: true,
          canCherryPickSelected: false,
          canCreatePatchSelected: true
        }),
        getAllFileItems: () => [],
        showCommit: async () => undefined,
        clear: async () => undefined,
        isShowingCommit: () => false
      } as never
    );

    const revert = commands.get(GitCommand.CommitRevertSelectedChanges);
    assert.ok(revert, 'expected selected-changes revert command to be registered');

    await revert(second, [first, second]);

    assert.deepStrictEqual(events, [
      `git:working-tree-patch:${ref}:src/a.ts,src/new.ts`,
      'git:reverse-apply:true',
      'refresh',
      'message:Reverted selected changes from HEAD~1 in the current checkout.'
    ]);
  });
});
