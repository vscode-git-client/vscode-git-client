import type { SpawnGitStreamingResult } from '../submoduleService';
import type { SubmoduleLogSink } from '../submoduleLogSink';
import type { GitServiceShape } from '.';

export async function checkoutRecordedSubmoduleCommit(
  this: GitServiceShape,
  submodulePath: string,
  opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
): Promise<SpawnGitStreamingResult> {
  return this.submoduleSvc.checkoutRecordedSubmoduleCommit(submodulePath, opts);
}
