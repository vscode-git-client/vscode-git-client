import * as vscode from 'vscode';
import type { GitServiceShape } from '.';

export async function onRepositoryAvailable(
  this: GitServiceShape,
  listener: () => void
): Promise<vscode.Disposable | undefined> {
  const api = await this.getVsCodeGitApi();
  if (!api) {
    return undefined;
  }
  const current = await this.getVsCodeRepository();
  if (current) {
    listener();
  }
  if (!api.onDidOpenRepository) {
    return undefined;
  }
  return api.onDidOpenRepository((repo) => {
    if (this.samePath(repo.rootUri.fsPath, this.gitRoot)) {
      this._vscodeGitRepository = repo;
      listener();
    }
  });
}
