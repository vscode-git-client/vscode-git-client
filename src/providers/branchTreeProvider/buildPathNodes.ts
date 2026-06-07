import * as vscode from 'vscode';
import { BranchRef } from '../../types';
import { BranchPathNode, BranchTreeItem } from './nodes';

export function buildPathNodes(
  branches: BranchRef[],
  basePath: string,
  pathMode: 'name' | 'shortName',
  idPrefix: string
): vscode.TreeItem[] {
  const groups = new Map<string, BranchRef[]>();
  const leaves: BranchTreeItem[] = [];

  for (const branch of branches) {
    const branchPath = pathMode === 'name' ? branch.name : branch.shortName;
    const relativeName = basePath ? branchPath.slice(basePath.length + 1) : branchPath;
    if (!relativeName) {
      leaves.push(new BranchTreeItem(branch, branchPath.split('/').at(-1) ?? branchPath, idPrefix));
      continue;
    }

    const parts = relativeName.split('/');
    if (parts.length === 1) {
      leaves.push(new BranchTreeItem(branch, relativeName, idPrefix));
      continue;
    }

    const segment = parts[0];
    const childPath = basePath ? `${basePath}/${segment}` : segment;
    const list = groups.get(childPath) ?? [];
    list.push(branch);
    groups.set(childPath, list);
  }

  const groupItems = Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fullPath, branchSet]) => new BranchPathNode(idPrefix, fullPath.split('/').at(-1) ?? fullPath, fullPath, branchSet, pathMode));

  leaves.sort((a, b) => {
    if (a.branch.current) {
      return -1;
    }
    if (b.branch.current) {
      return 1;
    }
    const leftPath = pathMode === 'name' ? a.branch.name : a.branch.shortName;
    const rightPath = pathMode === 'name' ? b.branch.name : b.branch.shortName;
    return leftPath.localeCompare(rightPath);
  });

  return [...groupItems, ...leaves];
}
