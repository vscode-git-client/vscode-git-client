import * as vscode from 'vscode';
import { BranchRef, TagRef } from '../../types';
import { BranchSectionNode, TagSectionNode } from './nodes';
import type { BranchTreeProviderShape } from './index';

export function buildTopLevelSections(
  this: BranchTreeProviderShape,
  branches: BranchRef[],
  tags: TagRef[]
): vscode.TreeItem[] {
  const localBranches = branches.filter((branch) => branch.type === 'local');
  const remoteBranches = branches.filter((branch) => branch.type === 'remote');
  const recentBranches = this.getRecentBranches(branches);

  const sections: vscode.TreeItem[] = [];
  if (recentBranches.length > 0) {
    sections.push(new BranchSectionNode('recent', recentBranches, recentBranches.length));
  }
  if (localBranches.length > 0) {
    sections.push(new BranchSectionNode('local', localBranches, localBranches.length));
  }
  if (remoteBranches.length > 0) {
    sections.push(new BranchSectionNode('remote', remoteBranches, remoteBranches.length));
  }
  if (tags.length > 0) {
    sections.push(new TagSectionNode(tags, tags.length));
  }
  return sections;
}
