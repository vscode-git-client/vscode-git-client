import type { GitServiceShape } from '.';

export async function commit(this: GitServiceShape, message: string): Promise<void> {
  const repository = await this.getVsCodeRepository();
  if (repository) {
    this.logger.info('vscode.git commit -m <message>');
    await repository.commit(message);
    return;
  }
  await this.runGit(['commit', '-m', message]);
}
