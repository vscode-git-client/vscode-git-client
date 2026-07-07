import * as assert from 'assert';
import { describe, it } from 'node:test';
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

class FakeGitService extends GitService {
  readonly commands: string[][] = [];

  constructor() {
    super(
      { rootPath: '/repo', rootUri: { fsPath: '/repo' } } as never,
      makeLogger() as never,
      makeConfig() as never
    );
  }

  override async runGit(args: string[]): Promise<GitCommandResult> {
    this.commands.push(args);
    if (args[0] === 'reflog') {
      return {
        stdout:
          'stash@{0}|~|abc123|~|WIP on main: work in progress|~|Test User|~|2026-05-06T00:00:00Z|#|',
        stderr: ''
      };
    }
    throw new Error(`unexpected git command: ${args.join(' ')}`);
  }
}

describe('GitService lazy stash listing', () => {
  it('does not run per-stash file count commands while listing stashes', async () => {
    const git = new FakeGitService();

    const stashes = await git.getStashes();

    assert.strictEqual(stashes.length, 1);
    assert.strictEqual(stashes[0].fileCount, undefined);
    assert.deepStrictEqual(
      git.commands.map((args) => args.slice(0, 3)),
      [['reflog', 'show', 'refs/stash']]
    );
  });
});
