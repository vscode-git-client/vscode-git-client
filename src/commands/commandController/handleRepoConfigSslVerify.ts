import type { CommandController } from './index';
import * as vscode from 'vscode';
import * as path from 'path';
import { confirmDangerousAction } from '../../guards';
import { pickConfigScope } from './pickConfigScope';
import { resolveConfigValue } from './handleRepoConfigUser';

interface SslOption extends vscode.QuickPickItem {
  action: 'enable' | 'disable' | 'caInfo' | 'reset';
}

export async function handleRepoConfigSslVerify(this: CommandController): Promise<void> {
  const current = await resolveConfigValue(this.git, 'http.sslVerify');
  const disabled = current?.value?.toLowerCase() === 'false';

  const options: SslOption[] = [];
  if (disabled) {
    options.push(
      { label: 'Enable verification', description: '(currently disabled)', action: 'enable' },
      {
        label: 'Reset to default',
        description: 'unset http.sslVerify — Git defaults to enabled',
        action: 'reset'
      }
    );
  } else {
    options.push({
      label: 'Enable verification',
      description: current ? '(default)' : undefined,
      action: 'enable'
    });
  }
  options.push(
    {
      label: 'Disable for this repository (NOT RECOMMENDED)',
      description: 'turns off TLS certificate checking',
      action: 'disable'
    },
    {
      label: 'Also configure CA bundle (http.sslCAInfo)',
      action: 'caInfo'
    }
  );

  const picked = await vscode.window.showQuickPick(options, {
    title: 'SSL verification (http.sslVerify)',
    placeHolder: current
      ? `Currently: ${current.value} (${current.scope})`
      : 'Currently: not set (Git default: enabled)'
  });
  if (!picked) {
    return;
  }

  switch (picked.action) {
    case 'enable': {
      const scope = await pickConfigScope('Apply to');
      if (!scope) {
        return;
      }
      await this.git.setConfig('http.sslVerify', 'true', scope);
      this.logger.info(`Set http.sslVerify = true (${scope})`);
      void vscode.window.showInformationMessage('SSL verification enabled.');
      return;
    }
    case 'disable': {
      // Disabling changes security behavior: require an explicit confirmation,
      // and only ever write the local scope (no global disable from this UI).
      const ok = await confirmDangerousAction({
        title: 'Disable SSL verification?',
        detail:
          'Git will stop verifying TLS certificates for this repository, which allows man-in-the-middle attacks. Only do this for trusted internal servers with self-signed certificates.',
        acceptLabel: 'Disable SSL verification'
      });
      if (!ok) {
        return;
      }
      await this.git.setConfig('http.sslVerify', 'false', 'local');
      this.logger.warn('Disabled http.sslVerify for this repository');
      void vscode.window.showWarningMessage(
        'SSL verification is disabled for this repository. Re-enable it once the certificate issue is resolved.'
      );
      return;
    }
    case 'reset': {
      await this.git.setConfig('http.sslVerify', null, 'local');
      this.logger.info('Unset http.sslVerify (local)');
      void vscode.window.showInformationMessage('Reset http.sslVerify to the Git default.');
      return;
    }
    case 'caInfo': {
      const currentCa = await resolveConfigValue(this.git, 'http.sslCAInfo');
      const file = await vscode.window.showInputBox({
        title: 'CA bundle (http.sslCAInfo)',
        value: currentCa?.value ?? '',
        prompt: 'Absolute path to a CA bundle file',
        validateInput: async (v) => {
          const trimmed = v.trim();
          if (!trimmed) {
            return 'Path is required';
          }
          try {
            await vscode.workspace.fs.stat(vscode.Uri.file(path.resolve(trimmed)));
            return undefined;
          } catch {
            return 'File does not exist';
          }
        }
      });
      if (!file) {
        return;
      }
      const scope = await pickConfigScope('Apply to');
      if (!scope) {
        return;
      }
      await this.git.setConfig('http.sslCAInfo', path.resolve(file.trim()), scope);
      this.logger.info(`Set http.sslCAInfo (${scope})`);
      void vscode.window.showInformationMessage('Set http.sslCAInfo.');
      return;
    }
  }
}
