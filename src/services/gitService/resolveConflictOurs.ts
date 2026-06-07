import type { GitServiceShape } from '.';

export async function resolveConflictOurs(this: GitServiceShape, filePath: string): Promise<void> {
  await this.runGit(['checkout', '--ours', '--', filePath]);
  await this.runGit(['add', '--', filePath]);
}
