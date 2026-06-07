import * as vscode from 'vscode';
import type { GitServiceShape } from '.';

export async function onRepositoryClosed(
  this: GitServiceShape,
  listener: () => void
): Promise<vscode.Disposable | undefined> {
  const api = await this.getVsCodeGitApi();
  if (!api?.onDidCloseRepository) {
    return undefined;
  }
  return api.onDidCloseRepository((repo) => {
    if (this.samePath(repo.rootUri.fsPath, this.gitRoot)) {
      this._vscodeGitRepository = undefined;
      listener();
    }
  });
}
