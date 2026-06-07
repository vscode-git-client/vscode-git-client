import type { GitServiceShape } from '.';

export async function amendCommit(this: GitServiceShape, message?: string): Promise<void> {
  const repository = await this.getVsCodeRepository();
  if (repository) {
    this.logger.info(`vscode.git commit --amend${message ? ' -m <message>' : ' --no-edit'}`);
    await repository.commit(message ?? '', { amend: true });
    return;
  }
  const args = ['commit', '--amend'];
  if (message) {
    args.push('-m', message);
  } else {
    args.push('--no-edit');
  }
  await this.runGit(args);
}
