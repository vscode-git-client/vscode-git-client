import * as vscode from 'vscode';
import type { CommitFilesTreeProvider } from '../../providers/commitFilesTreeProvider';
import type { GitService } from '../../services/gitService';
import type { StateStore } from '../../state/stateStore';
import type { CompareResult } from '../../types';
import { CompareCommitRangeSelection, CompareView } from '../../views/compareView';
import type { VirtualGitContentProvider } from '../virtualGitContentProvider';
import { closeEmptyEditorGroups } from './closeEmptyEditorGroups';
import { createComparableDiffUri } from './createComparableDiffUri';
import { createVirtualUri } from './createVirtualUri';
import { createWorkingTreeUri } from './createWorkingTreeUri';
import { openBranchCompare } from './openBranchCompare';
import { openBranchComparisonFileDiff } from './openBranchComparisonFileDiff';
import { openCommitFilesDiff } from './openCommitFilesDiff';
import { openCommitFileDiffWithStatus } from './openCommitFileDiffWithStatus';
import { openCommitRangeDetails } from './openCommitRangeDetails';
import { openCommitRangeFileDiff } from './openCommitRangeFileDiff';
import { openCompareWithRevisionForFolder } from './openCompareWithRevisionForFolder';
import { openDiffForFile } from './openDiffForFile';
import { openDiffForUri } from './openDiffForUri';
import { openFileAtRevision } from './openFileAtRevision';
import { openWorkingTreeFile } from './openWorkingTreeFile';
import { openWorkingTreeFileDiff } from './openWorkingTreeFileDiff';
import { parseComparableDiffSide } from './parseComparableDiffSide';
import { readContentOrEmpty } from './readContentOrEmpty';
import { swapActiveCompareDirection } from './swapActiveCompareDirection';
import type { ComparableDiffSide, CompareWithRevisionDirection } from './utils';

// WARNING: private constructor parameters are exposed via this interface solely
// to allow extracted functions to access them through the typed `this` parameter.
// Scope: git, state, contentProvider, commitFilesView, ensureCompareView,
//        readContentOrEmpty, createVirtualUri, createWorkingTreeUri,
//        createComparableDiffUri, parseComparableDiffSide.
// Mitigation: TODO — evaluate narrowing visibility after further refactoring.
export interface EditorOrchestratorShape {
  readonly git: GitService;
  readonly state: StateStore;
  readonly contentProvider: VirtualGitContentProvider;
  readonly commitFilesView: CommitFilesTreeProvider;
  ensureCompareView(): CompareView;
  readContentOrEmpty(ref: string, relativePath: string): Promise<string>;
  createVirtualUri(ref: string, relativePath: string): Promise<vscode.Uri>;
  createWorkingTreeUri(relativePath: string, status?: string): Promise<vscode.Uri>;
  createComparableDiffUri(side: ComparableDiffSide, status?: string): Promise<vscode.Uri>;
  parseComparableDiffSide(uri: vscode.Uri): Promise<ComparableDiffSide | undefined>;
  openDiffForFile(options: { path: string; leftRef: string; rightRef: string; title?: string }): Promise<void>;
  openWorkingTreeFileDiff(
    relativePath: string,
    ref: string,
    refLabel: string,
    opts: { preview: boolean; status?: string; direction?: CompareWithRevisionDirection }
  ): Promise<void>;
}

export class EditorOrchestrator {
  private compareView: CompareView | undefined;

  constructor(
    private readonly git: GitService,
    private readonly state: StateStore,
    private readonly contentProvider: VirtualGitContentProvider,
    private readonly commitFilesView: CommitFilesTreeProvider
  ) { }

  // ─── Trivial delegators kept in class ────────────────────────────────────

  async openMergeConflict(filePath: string): Promise<void> {
    await this.git.openMergeEditor(filePath);
  }

  async openCompareFromCommit(commitSha: string): Promise<void> {
    const current = await this.git.getCurrentBranch();
    await this.openBranchCompare(commitSha, current);
  }

  async showRepositoryAtRevision(sha: string): Promise<void> {
    await this.commitFilesView.showRevision(sha);
  }

  async openCompareWithRevisionForFile(
    relativePath: string,
    ref: string,
    refLabel: string
  ): Promise<void> {
    await this.openWorkingTreeFileDiff(relativePath, ref, refLabel, { preview: false });
  }

  async openCompareCommitRangeDetails(selection: CompareCommitRangeSelection): Promise<void> {
    await this.openCommitRangeDetails(selection.shas);
  }

  async openCommitFileDiff(sha: string, filePath: string): Promise<void> {
    const entries = await this.git.getFilesInCommitWithStatus(sha);
    const entry = entries.find((item) => item.path === filePath);
    await this.openCommitFileDiffWithStatus(sha, filePath, entry?.status, { oldPath: entry?.oldPath });
  }

  // ─── ensureCompareView (kept in class — accesses private compareView field) ──

  private ensureCompareView(): CompareView {
    if (!this.compareView) {
      this.compareView = new CompareView(
        async (sha, subject) => {
          if (this.commitFilesView.isShowingCommit(sha)) {
            await this.commitFilesView.clear();
            return;
          }
          await this.commitFilesView.showCommit(sha, subject);
        },
        async (selection) => {
          await this.openCompareCommitRangeDetails(selection);
        },
        {
          getCompareViewMode: () => this.state.getCompareViewMode(),
          setCompareViewMode: (mode) => this.state.setCompareViewMode(mode)
        },
        async (leftRef, rightRef) => {
          const result = await this.state.compareBranches(leftRef, rightRef);
          this.compareView?.render(result);
        }
      );
      this.compareView.onDispose(() => {
        void this.commitFilesView.clear();
        this.compareView = undefined;
      });
    }
    return this.compareView;
  }

  // ─── Delegating wrappers for extracted functions ──────────────────────────

  async openDiffForFile(options: {
    path: string;
    leftRef: string;
    rightRef: string;
    title?: string;
  }): Promise<void> {
    return openDiffForFile.call(this as unknown as EditorOrchestratorShape, options);
  }

  async openDiffForUri(uri: vscode.Uri, title: string): Promise<void> {
    return openDiffForUri(uri, title);
  }

  async openBranchCompare(leftRef: string, rightRef: string): Promise<CompareResult> {
    return openBranchCompare.call(this as unknown as EditorOrchestratorShape, leftRef, rightRef);
  }

  async openCommitFilesDiff(sha: string): Promise<void> {
    return openCommitFilesDiff.call(this as unknown as EditorOrchestratorShape, sha);
  }

  async openBranchComparisonFileDiff(leftRef: string, rightRef: string): Promise<void> {
    return openBranchComparisonFileDiff.call(
      this as unknown as EditorOrchestratorShape,
      leftRef,
      rightRef
    );
  }

  async openCommitFileDiffWithStatus(
    sha: string,
    filePath: string,
    status?: string,
    options?: { oldPath?: string }
  ): Promise<void> {
    return openCommitFileDiffWithStatus.call(
      this as unknown as EditorOrchestratorShape,
      sha,
      filePath,
      status,
      options
    );
  }

  async openCommitRangeFileDiff(
    fromRef: string,
    toRef: string,
    filePath: string,
    labels?: { fromLabel?: string; toLabel?: string }
  ): Promise<void> {
    return openCommitRangeFileDiff.call(
      this as unknown as EditorOrchestratorShape,
      fromRef,
      toRef,
      filePath,
      labels
    );
  }

  async openWorkingTreeFileDiff(
    relativePath: string,
    ref: string,
    refLabel: string,
    opts: { preview: boolean; status?: string; direction?: CompareWithRevisionDirection }
  ): Promise<void> {
    return openWorkingTreeFileDiff.call(
      this as unknown as EditorOrchestratorShape,
      relativePath,
      ref,
      refLabel,
      opts
    );
  }

  async swapActiveCompareDirection(): Promise<void> {
    return swapActiveCompareDirection.call(this as unknown as EditorOrchestratorShape);
  }

  async openCompareWithRevisionForFolder(
    folderRelPath: string,
    ref: string,
    refLabel: string
  ): Promise<void> {
    return openCompareWithRevisionForFolder.call(
      this as unknown as EditorOrchestratorShape,
      folderRelPath,
      ref,
      refLabel
    );
  }

  async openCommitRangeDetails(rawShas: readonly string[]): Promise<void> {
    return openCommitRangeDetails.call(this as unknown as EditorOrchestratorShape, rawShas);
  }

  async openFileAtRevision(ref: string, filePath: string): Promise<void> {
    return openFileAtRevision.call(this as unknown as EditorOrchestratorShape, ref, filePath);
  }

  async openWorkingTreeFile(filePath: string): Promise<void> {
    return openWorkingTreeFile.call(this as unknown as EditorOrchestratorShape, filePath);
  }

  // ─── Private method wrappers (delegating to extracted functions) ──────────

  private async readContentOrEmpty(ref: string, relativePath: string): Promise<string> {
    return readContentOrEmpty.call(this as unknown as EditorOrchestratorShape, ref, relativePath);
  }

  private async createVirtualUri(ref: string, relativePath: string): Promise<vscode.Uri> {
    return createVirtualUri.call(this as unknown as EditorOrchestratorShape, ref, relativePath);
  }

  private async createWorkingTreeUri(relativePath: string, status?: string): Promise<vscode.Uri> {
    return createWorkingTreeUri.call(
      this as unknown as EditorOrchestratorShape,
      relativePath,
      status
    );
  }

  private async createComparableDiffUri(
    side: ComparableDiffSide,
    status?: string
  ): Promise<vscode.Uri> {
    return createComparableDiffUri.call(
      this as unknown as EditorOrchestratorShape,
      side,
      status
    );
  }

  private async parseComparableDiffSide(
    uri: vscode.Uri
  ): Promise<ComparableDiffSide | undefined> {
    return parseComparableDiffSide.call(this as unknown as EditorOrchestratorShape, uri);
  }

  private async closeEmptyEditorGroups(): Promise<void> {
    return closeEmptyEditorGroups();
  }
}
