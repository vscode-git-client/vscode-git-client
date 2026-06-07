import type { CherryPickIssueKind, MergeIssueKind, RebaseIssueKind } from './types';
import { getErrorSummary } from './getErrorSummary';

export function classifyCherryPickIssue(error: unknown): { kind: CherryPickIssueKind; message?: string } {
  const message = getErrorSummary(error);
  const normalized = message.toLowerCase();

  const emptyMarkers = [
    'nothing to cherry-pick',
    'the previous cherry-pick is now empty',
    'nothing to commit, working tree clean',
    'the patch is empty'
  ];
  if (emptyMarkers.some((marker) => normalized.includes(marker))) {
    return { kind: 'nothingToCherryPick', message };
  }

  const conflictMarkers = [
    'conflict',
    'could not apply',
    'unmerged files',
    'cannot cherry-pick',
    'can not cherry pick',
    'after resolving the conflicts',
    'fix conflicts and then commit the result',
    'cherry-pick failed'
  ];
  if (conflictMarkers.some((marker) => normalized.includes(marker))) {
    return { kind: 'conflict', message };
  }

  return { kind: 'failed', message };
}

export function classifyMergeIssue(error: unknown): { kind: MergeIssueKind; message?: string } {
  const message = getErrorSummary(error);
  const normalized = message.toLowerCase();

  const conflictMarkers = [
    'conflict',
    'automatic merge failed',
    'unmerged files',
    'fix conflicts and then commit the result',
    'merge failed'
  ];
  if (conflictMarkers.some((marker) => normalized.includes(marker))) {
    return { kind: 'conflict', message };
  }

  return { kind: 'failed', message };
}

export function classifyRebaseIssue(error: unknown): { kind: RebaseIssueKind; message?: string } {
  const message = getErrorSummary(error);
  const normalized = message.toLowerCase();

  const conflictMarkers = [
    'conflict',
    'could not apply',
    'unmerged files',
    'resolve all conflicts manually',
    'after resolving the conflicts',
    'fix conflicts and then run'
  ];
  if (conflictMarkers.some((marker) => normalized.includes(marker))) {
    return { kind: 'conflict', message };
  }

  return { kind: 'failed', message };
}
