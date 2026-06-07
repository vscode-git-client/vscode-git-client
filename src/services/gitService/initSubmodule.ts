import type { SpawnGitStreamingResult } from '../submoduleService';
import type { SubmoduleLogSink } from '../submoduleLogSink';
import type { GitServiceShape } from '.';

export async function initSubmodule(
  this: GitServiceShape,
  submodulePath: string,
  opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
): Promise<SpawnGitStreamingResult> {
  return this.submoduleSvc.initSubmodule(submodulePath, opts);
}
