import type { GitServiceShape } from '.';

export async function trackBranch(
  this: GitServiceShape,
  localBranch: string,
  upstream: string
): Promise<void> {
  const repository = await this.getVsCodeRepository();
  if (repository) {
    this.logger.info(`vscode.git setBranchUpstream ${localBranch} ${upstream}`);
    await repository.setBranchUpstream(localBranch, upstream);
    return;
  }
  await this.runGit(['branch', '--set-upstream-to', upstream, localBranch]);
}
