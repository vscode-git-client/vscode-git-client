import type { GitServiceShape } from '.';

export async function fetchPrune(this: GitServiceShape): Promise<void> {
  const repository = await this.getVsCodeRepository();
  if (repository) {
    this.logger.info('vscode.git fetch --prune');
    await repository.fetch({ prune: true });
    return;
  }
  await this.runGit(['fetch', '--prune']);
}
