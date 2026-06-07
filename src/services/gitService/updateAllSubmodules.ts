import type { SpawnGitStreamingResult } from '../submoduleService';
import type { SubmoduleLogSink } from '../submoduleLogSink';
import type { GitServiceShape } from '.';

export async function updateAllSubmodules(
  this: GitServiceShape,
  recursive = false,
  opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
): Promise<SpawnGitStreamingResult> {
  return this.submoduleSvc.updateAllSubmodules(recursive, opts);
}
