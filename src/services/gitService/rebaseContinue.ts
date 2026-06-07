import type { GitServiceShape } from '.';

export async function rebaseContinue(this: GitServiceShape): Promise<void> {
  await this.runGit(['-c', 'core.editor=true', 'rebase', '--continue']);
}
