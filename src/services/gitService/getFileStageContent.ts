import type { GitServiceShape } from '.';

export async function getFileStageContent(
  this: GitServiceShape,
  stage: 1 | 2 | 3,
  filePath: string
): Promise<string> {
  const result = await this.runGit(['show', `:${stage}:${filePath}`]);
  return result.stdout;
}
