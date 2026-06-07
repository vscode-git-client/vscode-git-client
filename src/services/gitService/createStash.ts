import type { GitServiceShape } from '.';

export async function createStash(
  this: GitServiceShape,
  message: string,
  options: { includeUntracked: boolean; keepIndex: boolean }
): Promise<void> {
  const repository = await this.getVsCodeRepository();
  if (repository && !options.keepIndex) {
    this.logger.info(`vscode.git createStash ${message}`);
    await repository.createStash({ message, includeUntracked: options.includeUntracked });
    return;
  }

  const args = ['stash', 'push', '-m', message];
  if (options.includeUntracked) {
    args.push('-u');
  }
  if (options.keepIndex) {
    args.push('--keep-index');
  }
  await this.runGit(args);
}
