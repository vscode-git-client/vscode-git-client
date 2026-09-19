import * as assert from 'assert';
import { describe, it } from 'node:test';
import { getConfig, setConfig } from '../services/gitService/gitConfig';

interface FakeGit {
  runGitAllowExitCodes(
    args: string[],
    codes: readonly number[]
  ): Promise<{ stdout: string; stderr: string }>;
  runGit(args: string[]): Promise<{ stdout: string; stderr: string }>;
  allowCalls: Array<{ args: string[]; codes: readonly number[] }>;
  runCalls: string[][];
}

function makeGit(stdout = ''): FakeGit {
  return {
    allowCalls: [],
    runCalls: [],
    async runGitAllowExitCodes(args, codes) {
      this.allowCalls.push({ args, codes });
      return { stdout, stderr: '' };
    },
    async runGit(args) {
      this.runCalls.push(args);
      return { stdout: '', stderr: '' };
    }
  };
}

const getConfigFn = getConfig as unknown as (
  this: FakeGit,
  key: string,
  scope: 'local' | 'global'
) => Promise<string | undefined>;
const setConfigFn = setConfig as unknown as (
  this: FakeGit,
  key: string,
  value: string | null,
  scope: 'local' | 'global'
) => Promise<void>;

describe('git config service', () => {
  it('getConfig reads local scope and trims the value', async () => {
    const git = makeGit('  osxkeychain\n');
    const value = await getConfigFn.call(git, 'credential.helper', 'local');
    assert.strictEqual(value, 'osxkeychain');
    assert.deepStrictEqual(git.allowCalls[0].args, [
      'config',
      '--local',
      '--get',
      'credential.helper'
    ]);
    assert.deepStrictEqual(git.allowCalls[0].codes, [0, 1]);
  });

  it('getConfig uses --global for global scope', async () => {
    const git = makeGit('tung@example.com');
    await getConfigFn.call(git, 'user.email', 'global');
    assert.deepStrictEqual(git.allowCalls[0].args, ['config', '--global', '--get', 'user.email']);
  });

  it('getConfig returns undefined for an empty value (unset)', async () => {
    const git = makeGit('');
    const value = await getConfigFn.call(git, 'http.sslVerify', 'local');
    assert.strictEqual(value, undefined);
  });

  it('setConfig writes value with scope flag', async () => {
    const git = makeGit();
    await setConfigFn.call(git, 'user.name', 'Tung', 'global');
    assert.deepStrictEqual(git.runCalls[0], ['config', '--global', 'user.name', 'Tung']);
  });

  it('setConfig with null unsets all values in scope (exit 1 tolerated)', async () => {
    const git = makeGit();
    await setConfigFn.call(git, 'credential.helper', null, 'local');
    assert.strictEqual(git.runCalls.length, 0);
    assert.deepStrictEqual(git.allowCalls[0].args, [
      'config',
      '--local',
      '--unset-all',
      'credential.helper'
    ]);
    assert.deepStrictEqual(git.allowCalls[0].codes, [0, 1]);
  });
});
