import type { CommandController } from './index';
import * as vscode from 'vscode';
import { pickConfigScope } from './pickConfigScope';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateConfigEmail(value: string): string | undefined {
  const v = value.trim();
  if (!v) {
    return 'Value is required';
  }
  if (!EMAIL_RE.test(v)) {
    return 'Enter a valid email address';
  }
  return undefined;
}

/** Resolve a config value with local → global fallback. */
export async function resolveConfigValue(
  git: {
    getConfig(key: string, scope: 'local' | 'global'): Promise<string | undefined>;
  },
  key: string
): Promise<{ value: string; scope: 'local' | 'global' } | undefined> {
  const local = await git.getConfig(key, 'local');
  if (local !== undefined) {
    return { value: local, scope: 'local' };
  }
  const global = await git.getConfig(key, 'global');
  if (global !== undefined) {
    return { value: global, scope: 'global' };
  }
  return undefined;
}

export async function handleRepoConfigUser(this: CommandController): Promise<void> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: 'Set user name', key: 'user.name', isEmail: false },
      { label: 'Set user email', key: 'user.email', isEmail: true }
    ],
    { title: 'User — name & email' }
  );
  if (!picked) {
    return;
  }

  const current = await resolveConfigValue(this.git, picked.key);
  const value = await vscode.window.showInputBox({
    title: picked.label,
    value: current?.value ?? '',
    prompt: current ? `Current: ${current.value} (${current.scope})` : 'Not currently set',
    validateInput: picked.isEmail
      ? validateConfigEmail
      : (v) => (v.trim() ? undefined : 'Value is required')
  });
  if (value === undefined) {
    return;
  }

  const scope = await pickConfigScope('Apply to');
  if (!scope) {
    return;
  }

  await this.git.setConfig(picked.key, value.trim(), scope);
  this.logger.info(`Set git config ${picked.key} (${scope})`);
  void vscode.window.showInformationMessage(`Set ${picked.key} = ${value.trim()} (${scope}).`);
}
