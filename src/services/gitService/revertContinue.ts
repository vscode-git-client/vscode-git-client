import type { GitServiceShape } from '.';

export async function revertContinue(this: GitServiceShape): Promise<void> {
  await this.runGit(['-c', 'core.editor=true', 'revert', '--continue']);
}
