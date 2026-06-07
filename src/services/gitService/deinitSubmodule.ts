import type { SpawnGitStreamingResult } from '../submoduleService';
import type { SubmoduleLogSink } from '../submoduleLogSink';
import type { GitServiceShape } from '.';

export async function deinitSubmodule(
  this: GitServiceShape,
  submodulePath: string,
  force = false,
  opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
): Promise<SpawnGitStreamingResult> {
  return this.submoduleSvc.deinitSubmodule(submodulePath, force, opts);
}
