import type { SubmoduleEntry } from '../../types';
import type { GitServiceShape } from '.';

export async function getSubmodules(this: GitServiceShape): Promise<SubmoduleEntry[]> {
  return this.submoduleSvc.getSubmodules();
}
