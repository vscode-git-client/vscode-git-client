import type { EditorOrchestratorShape } from './index';
import { closeEmptyEditorGroups } from './closeEmptyEditorGroups';
import { formatRevisionLabel } from './utils';

export async function openCommitRangeFileDiff(
  this: EditorOrchestratorShape,
  fromRef: string,
  toRef: string,
  filePath: string,
  labels?: { fromLabel?: string; toLabel?: string }
): Promise<void> {
  await closeEmptyEditorGroups();
  await this.openDiffForFile({
    path: filePath,
    leftRef: fromRef,
    rightRef: toRef,
    title: `${labels?.fromLabel ?? formatRevisionLabel(fromRef)} ↔ ${labels?.toLabel ?? formatRevisionLabel(toRef)} · ${filePath}`
  });
}
