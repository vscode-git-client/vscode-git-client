import type { GitServiceShape } from '.';

export async function stageSubmodulePointer(this: GitServiceShape, submodulePath: string): Promise<void> {
  return this.submoduleSvc.stageSubmodulePointer(submodulePath);
}
