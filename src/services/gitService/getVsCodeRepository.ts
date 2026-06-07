import * as vscode from 'vscode';
import type { VsCodeGitRepository } from './types';
import type { GitServiceShape } from '.';

export async function getVsCodeRepository(this: GitServiceShape): Promise<VsCodeGitRepository | undefined> {
  const rootUri = vscode.Uri.file(this.gitRoot);
  if (this._vscodeGitRepository && this.samePath(this._vscodeGitRepository.rootUri.fsPath, rootUri.fsPath)) {
    return this._vscodeGitRepository;
  }

  const api = await this.getVsCodeGitApi();
  if (!api) {
    return undefined;
  }

  const repository =
    api.getRepository(rootUri) ??
    api.repositories.find((candidate) => this.samePath(candidate.rootUri.fsPath, rootUri.fsPath)) ??
    await api.openRepository(rootUri);
  if (!repository) {
    return undefined;
  }

  this._vscodeGitRepository = repository;
  return repository;
}
