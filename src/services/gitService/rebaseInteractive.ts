import type { GitServiceShape } from '.';

export async function rebaseInteractive(this: GitServiceShape, base: string): Promise<void> {
  await this.runGit(['rebase', '-i', base]);
}
