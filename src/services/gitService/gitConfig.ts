import type { GitService } from './index';

export type GitConfigScope = 'local' | 'global';

/**
 * Reads a git config key. Returns undefined when the key is unset —
 * `git config --get` exits with code 1 in that case, which is not an error.
 */
export async function getConfig(
  this: GitService,
  key: string,
  scope: GitConfigScope
): Promise<string | undefined> {
  const scopeArgs = scope === 'global' ? ['--global'] : ['--local'];
  const result = await this.runGitAllowExitCodes(['config', ...scopeArgs, '--get', key], [0, 1]);
  const value = result.stdout.trim();
  return value === '' ? undefined : value;
}

/**
 * Writes (value !== null) or removes (value === null) a git config key in the
 * given scope. Unset uses --unset-all so multi-valued keys are fully cleared.
 */
export async function setConfig(
  this: GitService,
  key: string,
  value: string | null,
  scope: GitConfigScope
): Promise<void> {
  const scopeArgs = scope === 'global' ? ['--global'] : ['--local'];
  if (value === null) {
    // Unsetting a key that is not present in this scope exits 1 — treat as success.
    await this.runGitAllowExitCodes(['config', ...scopeArgs, '--unset-all', key], [0, 1]);
    return;
  }
  await this.runGit(['config', ...scopeArgs, key, value]);
}
