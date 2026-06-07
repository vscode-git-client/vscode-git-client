import type { GitServiceShape } from '.';

export async function getSubmodulePointerDiff(this: GitServiceShape, submodulePath: string): Promise<string> {
  return this.submoduleSvc.getSubmodulePointerDiff(submodulePath);
}
