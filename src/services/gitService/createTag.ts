import type { GitServiceShape } from '.';

export async function createTag(this: GitServiceShape, name: string, ref: string): Promise<void> {
  const repository = await this.getVsCodeRepository();
  if (repository) {
    this.logger.info(`vscode.git tag ${name} ${ref}`);
    await repository.tag(name, '', ref);
    return;
  }
  await this.runGit(['tag', name, ref]);
}
