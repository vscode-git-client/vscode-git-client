import type { SpawnGitStreamingResult } from '../submoduleService';
import type { SubmoduleLogSink } from '../submoduleLogSink';
import type { GitServiceShape } from '.';

export async function initAllSubmodules(
  this: GitServiceShape,
  opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
): Promise<SpawnGitStreamingResult> {
  return this.submoduleSvc.initAllSubmodules(opts);
}
