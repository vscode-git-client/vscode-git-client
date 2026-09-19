import type { CommandController } from './index';
import * as vscode from 'vscode';
import { confirmDangerousAction } from '../../guards';
import { convertToHttpsUrl, convertToSshUrl, detectUrlScheme } from '../../services/gitParsing';

export async function handleRemoteConvertUrl(this: CommandController): Promise<void> {
  const remoteUrls = await this.git.getRemoteFetchUrls();
  if (remoteUrls.size === 0) {
    void vscode.window.showErrorMessage('No remotes found in this repository.');
    return;
  }

  const remoteItems = [...remoteUrls.entries()].map(([name, url]) => ({
    label: name,
    description: url,
    detail: `Current scheme: ${detectUrlScheme(url).toUpperCase()}`
  }));

  const pickedRemote = await vscode.window.showQuickPick(remoteItems, {
    title: 'Convert remote URL',
    placeHolder: 'Pick a remote'
  });
  if (!pickedRemote) {
    return;
  }

  const remoteName = pickedRemote.label;
  const currentUrl = remoteUrls.get(remoteName);
  if (currentUrl === undefined) {
    return;
  }

  const scheme = detectUrlScheme(currentUrl);
  const items = [
    { label: 'Convert to SSH', description: 'git@host:path', target: 'ssh' as const },
    { label: 'Convert to HTTPS', description: 'https://host/path', target: 'https' as const }
  ].filter((i) => i.target !== scheme);
  if (items.length === 0) {
    void vscode.window.showInformationMessage(
      `Remote ${remoteName} is already ${scheme.toUpperCase()}: ${currentUrl}`
    );
    return;
  }

  const targetPicked = await vscode.window.showQuickPick(items, {
    title: `Remote ${remoteName}`,
    placeHolder: 'Pick the target scheme'
  });
  if (!targetPicked) {
    return;
  }

  const newUrl =
    targetPicked.target === 'ssh' ? convertToSshUrl(currentUrl) : convertToHttpsUrl(currentUrl);

  if (newUrl === null) {
    void vscode.window.showInformationMessage(
      `Remote ${remoteName} is already ${targetPicked.target.toUpperCase()} or the URL cannot be converted: ${currentUrl}`
    );
    return;
  }
  if (newUrl === currentUrl) {
    void vscode.window.showInformationMessage(`Remote ${remoteName} already uses this URL.`);
    return;
  }

  const ok = await confirmDangerousAction({
    title: `Change URL for remote ${remoteName}?`,
    detail: `${currentUrl}\n→ ${newUrl}`,
    acceptLabel: 'Change URL'
  });
  if (!ok) {
    return;
  }

  await this.git.setRemoteUrl(remoteName, newUrl);
  await this.state.refreshBranches();
  this.logger.info(`Converted remote ${remoteName} to ${targetPicked.target.toUpperCase()}`);
  const fetchNow = 'Fetch now';
  void vscode.window
    .showInformationMessage(
      `Remote ${remoteName} now uses ${targetPicked.target.toUpperCase()}: ${newUrl}`,
      fetchNow
    )
    .then(async (choice) => {
      if (choice === fetchNow) {
        try {
          await this.git.runGit(['fetch', remoteName]);
          await this.state.refreshAll();
        } catch (error) {
          this.logger.error(`Fetch after URL conversion failed for ${remoteName}`, error);
          void vscode.window.showErrorMessage(
            `Fetch failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    });
}
