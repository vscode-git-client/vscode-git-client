import type { GitServiceShape } from '.';

export async function checkoutBranch(this: GitServiceShape, branch: string): Promise<void> {
  const repository = await this.getVsCodeRepository();
  if (repository) {
    this.logger.info(`vscode.git checkout ${branch}`);
    await repository.checkout(branch);
    return;
  }
  await this.runGit(['checkout', branch]);
}
