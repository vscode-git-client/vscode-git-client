import * as vscode from 'vscode';
import type { CommandControllerShape } from './shape';
import type { GitScmRepository, GitScmExtensionExports } from './types';

export async function getBuiltInGitRepository(this: CommandControllerShape): Promise<GitScmRepository | undefined> {
  const gitExtension = vscode.extensions.getExtension<GitScmExtensionExports>('vscode.git');
  if (!gitExtension) {
    return undefined;
  }

  const gitExports = gitExtension.isActive
    ? gitExtension.exports
    : await gitExtension.activate();
  const gitApi = gitExports?.getAPI(1);
  if (!gitApi) {
    return undefined;
  }

  const rootUri = vscode.Uri.file(this.git.gitRoot);
  const direct = gitApi.getRepository(rootUri);
  if (direct) {
    return direct;
  }

  const normalizedRoot = this.git.gitRoot.replace(/\\/g, '/');
  return gitApi.repositories.find((repo) => repo.rootUri.fsPath.replace(/\\/g, '/') === normalizedRoot)
    ?? gitApi.repositories[0];
}
