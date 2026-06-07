import type { GitServiceShape } from '.';

export async function createBranch(this: GitServiceShape, name: string, base?: string): Promise<void> {
  const repository = await this.getVsCodeRepository();
  if (repository) {
    this.logger.info(`vscode.git createBranch ${name}${base ? ` ${base}` : ''}`);
    await repository.createBranch(name, false, base);
    return;
  }
  const args = ['branch', name];
  if (base) {
    args.push(base);
  }
  await this.runGit(args);
}
