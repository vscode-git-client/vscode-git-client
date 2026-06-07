import type { GitServiceShape } from '.';

export async function push(this: GitServiceShape): Promise<void> {
  const repository = await this.getVsCodeRepository();
  if (repository) {
    this.logger.info('vscode.git push');
    await repository.push();
    return;
  }
  await this.runGit(['push']);
}
