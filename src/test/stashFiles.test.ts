import * as assert from 'assert';
import { describe, it } from 'node:test';
import { stashFiles } from '../services/gitService/stashFiles';

type GitResult = { stdout: string; stderr: string };

interface FakeGit {
  runGit(args: string[]): Promise<GitResult>;
  runGitAllowExitCodes(args: string[], codes: readonly number[]): Promise<GitResult>;
  logger: {
    warn(message: string): void;
  };
  runCalls: string[][];
  allowCalls: Array<{ args: string[]; codes: readonly number[] }>;
}

function makeGit(options?: {
  runGitError?: Error;
  stashHeads?: Array<string | undefined>;
}): FakeGit {
  const stashHeads = [...(options?.stashHeads ?? [])];
  const runGitError = options?.runGitError;

  return {
    runCalls: [],
    allowCalls: [],
    logger: {
      warn(_message: string) {}
    },
    async runGit(args) {
      this.runCalls.push(args);
      if (runGitError) {
        throw runGitError;
      }
      return { stdout: '', stderr: '' };
    },
    async runGitAllowExitCodes(args, codes) {
      this.allowCalls.push({ args, codes });
      if (args[0] === 'rev-parse' && args[1] === '--verify' && args[2] === 'refs/stash') {
        const head = stashHeads.shift();
        return { stdout: head ? `${head}\n` : '', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    }
  } as FakeGit;
}

const stashFilesFn = stashFiles as unknown as (
  this: FakeGit,
  paths: string[],
  message: string,
  options: { keepIndex: boolean; includeUntracked?: boolean }
) => Promise<void>;

describe('git stashFiles', () => {
  it('treats untracked pathspec mismatch as success when a new stash entry is created', async () => {
    const git = makeGit({
      runGitError: new Error(
        "error: pathspec ':(prefix:0)new.txt' did not match any file(s) known to git"
      ),
      stashHeads: [undefined, 'abc123']
    });

    const warnings: string[] = [];
    git.logger.warn = (message: string) => {
      warnings.push(message);
    };

    await assert.doesNotReject(
      stashFilesFn.call(git, ['new.txt'], 'shelve new file', {
        keepIndex: true,
        includeUntracked: true
      })
    );

    assert.deepStrictEqual(git.runCalls[0], [
      'stash',
      'push',
      '-m',
      'shelve new file',
      '--keep-index',
      '--include-untracked',
      '--',
      'new.txt'
    ]);
    assert.strictEqual(git.allowCalls.length, 2);
    assert.deepStrictEqual(git.allowCalls[0], {
      args: ['rev-parse', '--verify', 'refs/stash'],
      codes: [0, 1]
    });
    assert.strictEqual(warnings.length, 1);
  });

  it('rethrows untracked pathspec mismatch when no new stash entry exists', async () => {
    const git = makeGit({
      runGitError: new Error(
        "error: pathspec ':(prefix:0)new.txt' did not match any file(s) known to git"
      ),
      stashHeads: ['abc123', 'abc123']
    });

    await assert.rejects(
      stashFilesFn.call(git, ['new.txt'], 'shelve new file', {
        keepIndex: true,
        includeUntracked: true
      }),
      /did not match any file\(s\) known to git/
    );
    assert.strictEqual(git.allowCalls.length, 2);
  });

  it('keeps existing failure behavior when includeUntracked is false', async () => {
    const git = makeGit({
      runGitError: new Error('fatal: broken stash command')
    });

    await assert.rejects(
      stashFilesFn.call(git, ['tracked.txt'], 'shelve tracked', {
        keepIndex: true,
        includeUntracked: false
      }),
      /broken stash command/
    );
    assert.strictEqual(git.allowCalls.length, 0);
  });
});
