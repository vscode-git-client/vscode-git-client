import type { SpawnGitStreamingResult } from '../submoduleService';
import type { SubmoduleLogSink } from '../submoduleLogSink';
import type { GitServiceShape } from '.';

export async function syncSubmodule(
  this: GitServiceShape,
  submodulePath?: string,
  recursive = false,
  opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
): Promise<SpawnGitStreamingResult> {
  return this.submoduleSvc.syncSubmodule(submodulePath, recursive, opts);
}
