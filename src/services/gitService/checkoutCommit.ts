import type { GitServiceShape } from '.';

export async function checkoutCommit(this: GitServiceShape, commit: string): Promise<void> {
  const repository = await this.getVsCodeRepository();
  if (repository) {
    this.logger.info(`vscode.git checkout ${commit}`);
    await repository.checkout(commit);
    return;
  }
  await this.runGit(['checkout', commit]);
}
