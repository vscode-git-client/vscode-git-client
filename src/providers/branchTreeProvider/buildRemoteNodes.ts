import * as vscode from 'vscode';
import { BranchRef } from '../../types';
import { BranchRemoteNode } from './nodes';

export function buildRemoteNodes(branches: BranchRef[]): vscode.TreeItem[] {
  const byRemote = new Map<string, BranchRef[]>();
  for (const branch of branches) {
    const remote = branch.remoteName ?? 'unknown';
    const list = byRemote.get(remote) ?? [];
    list.push(branch);
    byRemote.set(remote, list);
  }

  return Array.from(byRemote.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([remoteName, remoteBranches]) => new BranchRemoteNode(remoteName, remoteBranches, remoteBranches[0]?.remoteUrl));
}
