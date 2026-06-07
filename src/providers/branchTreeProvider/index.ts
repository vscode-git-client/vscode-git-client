import * as vscode from 'vscode';
import { StateStore } from '../../state/stateStore';
import { BranchRef, TagRef } from '../../types';
import { getRecentBranches } from './getRecentBranches';
import { buildRemoteNodes } from './buildRemoteNodes';
import { buildPathNodes } from './buildPathNodes';
import { buildTagPathNodes } from './buildTagPathNodes';
import { buildTopLevelSections } from './buildTopLevelSections';
import { getChildren } from './getChildren';

export {
  BranchRemoteNode,
  BranchTreeItem,
  TagTreeItem
} from './nodes';

export interface BranchTreeProviderShape {
  state: StateStore;
  getRecentBranches(branches: BranchRef[]): BranchRef[];
  buildTopLevelSections(branches: BranchRef[], tags: TagRef[]): vscode.TreeItem[];
  buildRemoteNodes(branches: BranchRef[]): vscode.TreeItem[];
  buildPathNodes(branches: BranchRef[], basePath: string, pathMode: 'name' | 'shortName', idPrefix: string): vscode.TreeItem[];
  buildTagPathNodes(tags: TagRef[], basePath: string, idPrefix: string): vscode.TreeItem[];
}

export class BranchTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(public readonly state: StateStore) {
    this.state.onDidChange(() => this.emitter.fire());
  }

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    return getChildren.call(this as BranchTreeProviderShape, element);
  }

  getRecentBranches(branches: BranchRef[]): BranchRef[] {
    return getRecentBranches(branches);
  }

  buildTopLevelSections(branches: BranchRef[], tags: TagRef[]): vscode.TreeItem[] {
    return buildTopLevelSections.call(this as BranchTreeProviderShape, branches, tags);
  }

  buildRemoteNodes(branches: BranchRef[]): vscode.TreeItem[] {
    return buildRemoteNodes(branches);
  }

  buildPathNodes(
    branches: BranchRef[],
    basePath: string,
    pathMode: 'name' | 'shortName',
    idPrefix: string
  ): vscode.TreeItem[] {
    return buildPathNodes(branches, basePath, pathMode, idPrefix);
  }

  buildTagPathNodes(tags: TagRef[], basePath: string, idPrefix: string): vscode.TreeItem[] {
    return buildTagPathNodes(tags, basePath, idPrefix);
  }
}
