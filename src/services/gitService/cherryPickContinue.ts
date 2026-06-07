import type { GitServiceShape } from '.';

export async function cherryPickContinue(this: GitServiceShape): Promise<void> {
  await this.runGit(['-c', 'core.editor=true', 'cherry-pick', '--continue']);
}
