import type { SpawnGitStreamingResult } from '../submoduleService';
import type { SubmoduleLogSink } from '../submoduleLogSink';
import type { GitServiceShape } from '.';

export async function pullSubmoduleTrackedBranch(
  this: GitServiceShape,
  submodulePath: string,
  opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
): Promise<SpawnGitStreamingResult> {
  return this.submoduleSvc.pullSubmoduleTrackedBranch(submodulePath, opts);
}
