import * as vscode from 'vscode';
import { BranchRef, TagRef } from '../../types';
import { formatComparisonSummary } from '../../services/gitParsing';
import { CommandId } from '../../commands/commandController/commandIds';

export class BranchSectionNode extends vscode.TreeItem {
  constructor(
    public readonly kind: 'recent' | 'local' | 'remote',
    public readonly branches: BranchRef[],
    count: number
  ) {
    const label = kind === 'recent' ? 'Recent' : kind === 'local' ? 'Local' : 'Remote';
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = kind === 'remote' ? 'branchSectionRemote' : 'branchSection';
    this.id = `branchSection:${kind}`;
    this.description = `${count}`;
  }
}

export class TagSectionNode extends vscode.TreeItem {
  constructor(public readonly tags: TagRef[], count: number) {
    super('Tags', vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'tagSection';
    this.id = 'branchSection:tags';
    this.description = `${count}`;
  }
}

export class BranchRemoteNode extends vscode.TreeItem {
  constructor(
    public readonly remoteName: string,
    public readonly branches: BranchRef[],
    remoteUrl?: string
  ) {
    super(remoteName, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'branchRemoteGroup';
    this.id = `branchRemote:${remoteName}`;
    if (remoteUrl) {
      this.tooltip = remoteUrl;
    }
  }
}

export class BranchPathNode extends vscode.TreeItem {
  constructor(
    public readonly idPrefix: string,
    public readonly segment: string,
    public readonly fullPath: string,
    public readonly branches: BranchRef[],
    public readonly pathMode: 'name' | 'shortName'
  ) {
    super(segment, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'branchPathGroup';
    this.id = `branchPath:${idPrefix}:${fullPath}`;
  }
}

export class TagPathNode extends vscode.TreeItem {
  constructor(
    public readonly idPrefix: string,
    public readonly segment: string,
    public readonly fullPath: string,
    public readonly tags: TagRef[]
  ) {
    super(segment, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'tagPathGroup';
    this.id = `tagPath:${idPrefix}:${fullPath}`;
  }
}

export class BranchTreeItem extends vscode.TreeItem {
  constructor(
    public readonly branch: BranchRef,
    label: string,
    idScope: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = branch.type === 'remote' ? 'branchRefRemote' : 'branchRefLocal';
    this.id = `branch:${idScope}:${branch.fullName}`;
    this.description = describeBranch(branch);
    this.tooltip = buildBranchTooltip(branch);
    this.iconPath = branch.current
      ? new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
      : new vscode.ThemeIcon(branch.type === 'remote' ? 'cloud' : 'git-branch');

    this.command = {
      title: 'Open Branch Commits',
      command: CommandId.BranchOpenCommits,
      arguments: [this]
    };
  }
}

export class TagTreeItem extends vscode.TreeItem {
  constructor(
    public readonly tag: TagRef,
    label: string,
    idScope: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'tagRef';
    this.id = `tag:${idScope}:${tag.fullName}`;
    this.tooltip = buildTagTooltip(tag);
    this.description = describeTagRemotes(tag);
    this.iconPath = new vscode.ThemeIcon('tag');
    this.command = {
      title: 'Open Tag Commits',
      command: CommandId.TagOpenCommits,
      arguments: [this]
    };
  }
}

export function compareTagsByTimeDesc(a: TagRef, b: TagRef): number {
  const left = a.lastCommitEpoch ?? 0;
  const right = b.lastCommitEpoch ?? 0;
  if (left !== right) {
    return right - left;
  }
  return a.name.localeCompare(b.name);
}

export function latestTagEpoch(tags: TagRef[]): number {
  return Math.max(0, ...tags.map((tag) => tag.lastCommitEpoch ?? 0));
}

function describeBranch(branch: BranchRef): string {
  const parts: string[] = [];
  if (branch.current) {
    parts.push('current');
  }
  if (branch.type === 'remote') {
    parts.push('remote');
  }
  if (branch.upstream) {
    parts.push(`upstream: ${branch.upstream}`);
  }
  if (branch.ahead || branch.behind) {
    parts.push(`▲${branch.ahead} ▼${branch.behind}`);
  }
  return parts.join(' · ');
}

function buildBranchTooltip(branch: BranchRef): string {
  const lines = [
    branch.name,
    branch.fullName,
    `Last update: ${formatEpoch(branch.lastCommitEpoch)}`,
    branch.upstream ? `Upstream: ${branch.upstream}` : '',
    formatComparison(branch.comparison)
  ];
  return lines.filter(Boolean).join('\n');
}

function buildTagTooltip(tag: TagRef): string {
  const remoteLines = (tag.availableOnRemotes ?? []).map((remoteName) => `Available on ${remoteName}`);
  const lines = [
    ...remoteLines,
    (tag.availableOnRemotes?.length ?? 0) === 0 ? 'Local only' : '',
    tag.name,
    tag.fullName,
    tag.sha ? `Revision: ${tag.sha}` : '',
    `Last update: ${formatEpoch(tag.lastCommitEpoch)}`,
    formatComparison(tag.comparison)
  ];
  return lines.filter(Boolean).join('\n');
}

function describeTagRemotes(tag: TagRef): string {
  const remotes = tag.availableOnRemotes ?? [];
  if (remotes.length === 0) {
    return '';
  }
  return `🌐 ${remotes.join(', ')}`;
}

function formatComparison(comparison: BranchRef['comparison'] | TagRef['comparison']): string {
  if (!comparison) {
    return '';
  }
  return formatComparisonSummary(comparison.ref, comparison.ahead, comparison.behind);
}

function formatEpoch(epoch: number | undefined): string {
  if (!epoch) {
    return 'unknown';
  }
  return new Date(epoch * 1000).toLocaleString();
}
