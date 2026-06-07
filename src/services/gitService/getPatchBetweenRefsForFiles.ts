import type { GitServiceShape } from '.';

export async function getPatchBetweenRefsForFiles(
  this: GitServiceShape,
  fromRef: string,
  toRef: string,
  filePaths: string[]
): Promise<string> {
  if (filePaths.length === 0) {
    return '';
  }

  const result = await this.runGit(['diff', '--binary', fromRef, toRef, '--', ...filePaths]);
  return result.stdout;
}
