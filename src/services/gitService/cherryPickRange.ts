import type { GitServiceShape } from '.';

export async function cherryPickRange(
  this: GitServiceShape,
  fromExclusive: string,
  toInclusive: string
): Promise<void> {
  await this.runGit(['cherry-pick', `${fromExclusive}..${toInclusive}`]);
}
