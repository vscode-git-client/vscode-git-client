import * as vscode from 'vscode';

export interface VsCodeGitChange {
  readonly uri: vscode.Uri;
}

export interface VsCodeGitRepository {
  readonly rootUri: vscode.Uri;
  readonly state: {
    readonly HEAD?: {
      readonly name?: string;
      readonly commit?: string;
    };
    readonly indexChanges: readonly VsCodeGitChange[];
    readonly mergeChanges: readonly VsCodeGitChange[];
    readonly workingTreeChanges: readonly VsCodeGitChange[];
    readonly untrackedChanges: readonly VsCodeGitChange[];
    readonly onDidChange?: vscode.Event<void>;
  };
  status(): Promise<void>;
  add(paths: string[]): Promise<void>;
  restore(paths: string[], options?: { staged?: boolean; ref?: string }): Promise<void>;
  revert(paths: string[]): Promise<void>;
  clean(paths: string[]): Promise<void>;
  createBranch(name: string, checkout: boolean, ref?: string): Promise<void>;
  deleteBranch(name: string, force?: boolean): Promise<void>;
  setBranchUpstream(name: string, upstream: string): Promise<void>;
  checkout(treeish: string): Promise<void>;
  tag(name: string, message: string, ref?: string): Promise<void>;
  fetch(options?: { prune?: boolean }): Promise<void>;
  pull(unshallow?: boolean): Promise<void>;
  push(remoteName?: string, branchName?: string, setUpstream?: boolean): Promise<void>;
  commit(message: string, opts?: { all?: boolean | 'tracked'; amend?: boolean }): Promise<void>;
  rebase(branch: string): Promise<void>;
  mergeAbort(): Promise<void>;
  createStash(options?: { message?: string; includeUntracked?: boolean; staged?: boolean }): Promise<void>;
}

export interface VsCodeGitApi {
  readonly repositories: readonly VsCodeGitRepository[];
  getRepository(uri: vscode.Uri): VsCodeGitRepository | null;
  getRepositoryRoot(uri: vscode.Uri): Promise<vscode.Uri | null>;
  openRepository(root: vscode.Uri): Promise<VsCodeGitRepository | null>;
  readonly onDidOpenRepository?: vscode.Event<VsCodeGitRepository>;
  readonly onDidCloseRepository?: vscode.Event<VsCodeGitRepository>;
}

export interface VsCodeGitExtension {
  readonly enabled: boolean;
  getAPI(version: 1): VsCodeGitApi;
}
