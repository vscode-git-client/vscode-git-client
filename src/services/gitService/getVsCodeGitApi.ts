import * as vscode from 'vscode';
import type { VsCodeGitApi, VsCodeGitExtension } from './types';
import type { GitServiceShape } from '.';

export async function getVsCodeGitApi(this: GitServiceShape): Promise<VsCodeGitApi | undefined> {
  if (!this._vscodeGitApi) {
    this._vscodeGitApi = (async () => {
      const extension = vscode.extensions.getExtension<VsCodeGitExtension>('vscode.git');
      if (!extension) {
        return undefined;
      }
      const gitExtension = extension.isActive ? extension.exports : await extension.activate();
      if (!gitExtension.enabled) {
        return undefined;
      }
      return gitExtension.getAPI(1);
    })();
  }
  return this._vscodeGitApi;
}
