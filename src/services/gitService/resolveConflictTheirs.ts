import type { GitServiceShape } from '.';

export async function resolveConflictTheirs(this: GitServiceShape, filePath: string): Promise<void> {
  await this.runGit(['checkout', '--theirs', '--', filePath]);
  await this.runGit(['add', '--', filePath]);
}
