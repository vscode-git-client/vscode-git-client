import type { GitServiceShape } from '.';

export async function stageFile(this: GitServiceShape, filePath: string): Promise<void> {
  const repository = await this.getVsCodeRepository();
  if (repository) {
    this.logger.info(`vscode.git add ${filePath}`);
    await repository.add([this.toAbsoluteRepoPath(filePath)]);
    return;
  }
  await this.runGit(['add', '--', filePath]);
}
