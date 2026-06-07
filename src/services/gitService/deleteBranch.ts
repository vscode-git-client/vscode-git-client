import type { GitServiceShape } from '.';

export async function deleteBranch(this: GitServiceShape, branch: string, force = false): Promise<void> {
  const repository = await this.getVsCodeRepository();
  if (repository) {
    this.logger.info(`vscode.git deleteBranch ${branch}${force ? ' --force' : ''}`);
    await repository.deleteBranch(branch, force);
    return;
  }
  await this.runGit(['branch', force ? '-D' : '-d', branch]);
}
