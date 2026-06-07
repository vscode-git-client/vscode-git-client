import type { CompareResult } from '../../types';
import type { EditorOrchestratorShape } from './index';

export async function openBranchCompare(
  this: EditorOrchestratorShape,
  leftRef: string,
  rightRef: string
): Promise<CompareResult> {
  const result = await this.state.compareBranches(leftRef, rightRef);
  await this.commitFilesView.clear();
  this.ensureCompareView().render(result);
  this.ensureCompareView().reveal();
  return result;
}
