import type { CommandController } from './index';
import * as vscode from 'vscode';

export async function handleRepoConfigOpen(this: CommandController): Promise<void> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: 'User — name & email', id: 'user' },
      { label: 'Credential helper', id: 'credentialHelper' },
      { label: 'SSL verification (http.sslVerify)', id: 'sslVerify' }
    ],
    { title: 'Repository Settings', placeHolder: 'Pick a setting to edit' }
  );
  if (!picked) {
    return;
  }
  if (picked.id === 'user') {
    await this.handleRepoConfigUser();
  } else if (picked.id === 'credentialHelper') {
    await this.handleRepoConfigCredentialHelper();
  } else {
    await this.handleRepoConfigSslVerify();
  }
}
