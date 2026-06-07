import type { GitServiceShape } from '.';

export async function getPatchForCommitFiles(
  this: GitServiceShape,
  sha: string,
  filePaths: string[]
): Promise<string> {
  if (filePaths.length === 0) {
    return '';
  }

  const result = await this.runGit(['show', '--binary', '--format=', sha, '--', ...filePaths]);
  return result.stdout;
}
