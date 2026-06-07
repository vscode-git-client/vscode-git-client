import type { GitServiceShape } from '.';

export async function pull(this: GitServiceShape): Promise<void> {
  const repository = await this.getVsCodeRepository();
  if (repository) {
    this.logger.info('vscode.git pull');
    await repository.pull();
    return;
  }
  await this.runGit(['pull']);
}
