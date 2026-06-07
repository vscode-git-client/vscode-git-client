import { BranchTreeItem } from '../../providers/branchTreeProvider';
import type { CommandControllerShape } from './shape';

export function normalizeBranchActionHubArg(arg: unknown): string | undefined {
  if (arg instanceof BranchTreeItem) {
    return arg.branch.name;
  }
  if (typeof arg !== 'string') {
    return undefined;
  }
  const raw = arg.trim();
  return raw || undefined;
}

export function resolveBranchNameForActionHub(this: CommandControllerShape, rawBranchName: string): string | undefined {
  const exactMatch = this.state.branches.find((branch) => branch.name === rawBranchName);
  if (exactMatch) {
    return exactMatch.name;
  }

  const uniqueLocalShortMatch = this.state.branches.filter(
    (branch) => branch.type === 'local' && branch.shortName === rawBranchName
  );
  if (uniqueLocalShortMatch.length === 1) {
    return uniqueLocalShortMatch[0].name;
  }

  const uniqueShortMatch = this.state.branches.filter((branch) => branch.shortName === rawBranchName);
  if (uniqueShortMatch.length === 1) {
    return uniqueShortMatch[0].name;
  }

  return undefined;
}
