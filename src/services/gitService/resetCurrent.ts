import type { GitServiceShape } from '.';

export async function resetCurrent(
  this: GitServiceShape,
  ref: string,
  mode: 'soft' | 'mixed' | 'hard'
): Promise<void> {
  await this.runGit(['reset', `--${mode}`, ref]);
}
