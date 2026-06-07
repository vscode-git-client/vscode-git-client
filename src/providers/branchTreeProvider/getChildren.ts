import * as vscode from 'vscode';
import { BranchRemoteNode, BranchPathNode, BranchSectionNode, TagSectionNode, TagPathNode } from './nodes';
import type { BranchTreeProviderShape } from './index';

export async function getChildren(
  this: BranchTreeProviderShape,
  element?: vscode.TreeItem
): Promise<vscode.TreeItem[]> {
  const branches = this.state.branches;
  const tags = this.state.tags;

  if (!element) {
    return this.buildTopLevelSections(branches, tags);
  }

  if (element instanceof BranchSectionNode) {
    if (element.kind === 'remote') {
      return this.buildRemoteNodes(element.branches);
    }
    return this.buildPathNodes(
      element.branches,
      '',
      element.kind === 'local' ? 'name' : 'shortName',
      element.kind
    );
  }

  if (element instanceof BranchRemoteNode) {
    return this.buildPathNodes(element.branches, '', 'shortName', `remote:${element.remoteName}`);
  }

  if (element instanceof BranchPathNode) {
    return this.buildPathNodes(element.branches, element.fullPath, element.pathMode, element.idPrefix);
  }

  if (element instanceof TagSectionNode) {
    return this.buildTagPathNodes(element.tags, '', 'tags');
  }

  if (element instanceof TagPathNode) {
    return this.buildTagPathNodes(element.tags, element.fullPath, element.idPrefix);
  }

  return [];
}
