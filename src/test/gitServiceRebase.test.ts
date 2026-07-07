import * as assert from 'assert';
import { afterEach, describe, it } from 'node:test';
import * as vscode from 'vscode';
import { GitService } from '../services/gitService';
import { GitCommandResult } from '../types';

function makeLogger() {
  return {
    info: () => {
      /* noop */
    },
    warn: () => {
      /* noop */
    },
    error: () => {
      /* noop */
    },
    show: () => {
      /* noop */
    },
    dispose: () => {
      /* noop */
    }
  };
}

function makeConfig() {
  return {
    get: <T>(_key: string, defaultValue: T): T => defaultValue
  };
}

class RecordingGitService extends GitService {
  readonly commands: string[][] = [];

  constructor() {
    super(
      { rootPath: '/repo', rootUri: vscode.Uri.file('/repo') } as never,
      makeLogger() as never,
      makeConfig() as never
    );
  }

  override async runGit(args: string[]): Promise<GitCommandResult> {
    this.commands.push(args);
    return { stdout: '', stderr: '' };
  }
}

describe('GitService rebase', () => {
  const originalGetExtension = vscode.extensions.getExtension;

  afterEach(() => {
    (
      vscode.extensions as unknown as {
        getExtension: typeof vscode.extensions.getExtension;
      }
    ).getExtension = originalGetExtension;
  });

  it('rebases through the CLI runner even when the VS Code Git API is available', async () => {
    let vscodeGitRebaseCalled = false;
    const repository = {
      rootUri: vscode.Uri.file('/repo'),
      state: {
        indexChanges: [],
        mergeChanges: [],
        workingTreeChanges: [],
        untrackedChanges: []
      },
      rebase: async () => {
        vscodeGitRebaseCalled = true;
        throw new Error('Failed to execute git');
      }
    };

    (
      vscode.extensions as unknown as {
        getExtension: typeof vscode.extensions.getExtension;
      }
    ).getExtension = () =>
      ({
        isActive: true,
        exports: {
          enabled: true,
          getAPI: () => ({
            repositories: [repository],
            getRepository: () => repository,
            getRepositoryRoot: async () => vscode.Uri.file('/repo'),
            openRepository: async () => repository
          })
        }
      }) as never;

    const git = new RecordingGitService();

    await git.rebaseCurrentOnto('origin/feature');

    assert.strictEqual(vscodeGitRebaseCalled, false);
    assert.deepStrictEqual(git.commands, [['rebase', 'origin/feature']]);
  });
});
