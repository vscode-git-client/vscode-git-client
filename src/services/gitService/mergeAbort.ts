import type { GitServiceShape } from '.';

export async function mergeAbort(this: GitServiceShape): Promise<void> {
  const repository = await this.getVsCodeRepository();
  if (repository) {
    this.logger.info('vscode.git mergeAbort');
    await repository.mergeAbort();
    return;
  }
  await this.runGit(['merge', '--abort']);
}
