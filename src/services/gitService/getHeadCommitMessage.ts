import type { GitServiceShape } from '.';

export async function getHeadCommitMessage(this: GitServiceShape): Promise<string> {
  const result = await this.runGit(['log', '-1', '--pretty=%B']);
  return result.stdout.trim();
}
