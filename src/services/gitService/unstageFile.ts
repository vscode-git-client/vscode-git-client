import type { GitServiceShape } from '.';

export async function unstageFile(this: GitServiceShape, filePath: string): Promise<void> {
  const repository = await this.getVsCodeRepository();
  if (repository) {
    this.logger.info(`vscode.git restore --staged ${filePath}`);
    await repository.restore([this.toAbsoluteRepoPath(filePath)], { staged: true });
    return;
  }
  await this.runGit(['restore', '--staged', '--', filePath]);
}
