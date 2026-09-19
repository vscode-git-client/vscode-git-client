import type { CommandController } from './index';
import * as vscode from 'vscode';
import { confirmDangerousAction } from '../../guards';
import { pickConfigScope } from './pickConfigScope';
import { resolveConfigValue } from './handleRepoConfigUser';

interface HelperOption extends vscode.QuickPickItem {
  /** null → unset the key in the chosen scope. */
  value: string | null;
  requiresConfirm?: boolean;
  needsTimeoutInput?: boolean;
  custom?: boolean;
}

export function buildCredentialHelperOptions(
  platform: NodeJS.Platform = process.platform
): HelperOption[] {
  const options: HelperOption[] = [];
  if (platform === 'darwin') {
    options.push({ label: 'osxkeychain', value: 'osxkeychain' });
  } else if (platform === 'win32') {
    options.push({ label: 'manager-core', value: 'manager-core' });
  }
  options.push(
    {
      label: 'store',
      description: 'saves credentials in plaintext on disk',
      value: 'store',
      requiresConfirm: true
    },
    {
      label: 'cache',
      description: 'keeps credentials in memory for a timeout',
      value: '',
      needsTimeoutInput: true
    },
    {
      label: 'none',
      description: 'unset here — fall back to the higher scope',
      value: null
    },
    { label: 'Custom…', value: '', custom: true }
  );
  return options;
}

export async function handleRepoConfigCredentialHelper(this: CommandController): Promise<void> {
  const current = await resolveConfigValue(this.git, 'credential.helper');
  const picked = await vscode.window.showQuickPick(
    buildCredentialHelperOptions().map((o) => ({
      ...o,
      detail:
        current && o.value === current.value
          ? `$(check) currently active (${current.scope})`
          : o.detail
    })),
    { title: 'Credential helper', placeHolder: 'Pick a credential helper' }
  );
  if (!picked) {
    return;
  }

  let value: string | null = picked.value;
  if (picked.needsTimeoutInput) {
    const seconds = await vscode.window.showInputBox({
      title: 'Credential cache timeout',
      prompt: 'Seconds to keep credentials cached (Git default: 900)',
      value: '900',
      validateInput: (v) => (/^\d+$/.test(v.trim()) ? undefined : 'Enter a number of seconds')
    });
    if (seconds === undefined) {
      return;
    }
    value = `cache --timeout=${seconds.trim() || '900'}`;
  } else if (picked.custom) {
    const custom = await vscode.window.showInputBox({
      title: 'Custom credential helper',
      prompt: 'Enter a credential helper value',
      validateInput: (v) => (v.trim() ? undefined : 'Value is required')
    });
    if (!custom) {
      return;
    }
    value = custom.trim();
  }

  if (value !== null && picked.requiresConfirm) {
    const ok = await confirmDangerousAction({
      title: 'Use the "store" credential helper?',
      detail:
        'Git will save credentials in a plaintext file on disk (~/.git-credentials). Anyone with access to that file can read them.',
      acceptLabel: 'Use store'
    });
    if (!ok) {
      return;
    }
  }

  const scope = await pickConfigScope('Apply to');
  if (!scope) {
    return;
  }

  await this.git.setConfig('credential.helper', value === '' ? null : value, scope);
  this.logger.info(`Set credential.helper = ${value ?? '(unset)'} (${scope})`);
  void vscode.window.showInformationMessage(
    value === null
      ? 'Cleared credential.helper (this scope).'
      : `Set credential.helper = ${value} (${scope}).`
  );
}
