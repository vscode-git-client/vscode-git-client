import type { GitServiceShape } from '.';

export async function rebaseCurrentOnto(this: GitServiceShape, branch: string): Promise<void> {
  await this.runGit(['rebase', branch]);
}
