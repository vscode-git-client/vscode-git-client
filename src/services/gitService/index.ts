import * as vscode from 'vscode';
import { Logger } from '../../logger';
import { GitCommandQueue } from '../gitCommandQueue';
import {
  BranchRef,
  CommitDetails,
  CommitFileChange,
  CommitFilters,
  CompareResult,
  GitCommandResult,
  GitOperationState,
  GraphCommit,
  MergeConflictFile,
  RepositoryContext,
  ResolvedCommitMeta,
  StashEntry,
  SubmoduleEntry,
  TagRef,
  WorkingTreeChange,
  WorkingTreeFileChange,
  WorktreeEntry,
  WorktreePruneEntry,
  WorktreeStatus
} from '../../types';
import { SubmoduleService, SpawnGitStreamingResult } from '../submoduleService';
import { SubmoduleLogSink } from '../submoduleLogSink';
import type { RepoChangeSet } from '../repositoryStateDiff';
import type { VsCodeGitApi, VsCodeGitChange, VsCodeGitRepository } from './types';

// ─── Extracted function imports ──────────────────────────────────────────────
import { logGitDuration } from './logGitDuration';
import { runGit } from './runGit';
import { runGitAt } from './runGitAt';
import { runGitAllowExitCodes } from './runGitAllowExitCodes';
import { runGitWithStdin } from './runGitWithStdin';
import { samePath } from './samePath';
import { toAbsoluteRepoPath } from './toAbsoluteRepoPath';
import { uniqueChangePaths } from './uniqueChangePaths';
import { isMissingFileContentError } from './isMissingFileContentError';
import { getVsCodeGitApi } from './getVsCodeGitApi';
import { getVsCodeGitRoot } from './getVsCodeGitRoot';
import { getVsCodeRepository } from './getVsCodeRepository';
import { getChangedFilesFromVsCodeGit } from './getChangedFilesFromVsCodeGit';
import { resolveExactBranchRef } from './resolveExactBranchRef';
import { refExists } from './refExists';
import { refPatternExists } from './refPatternExists';
import { resolveShaFilter } from './resolveShaFilter';
import { tryGetMergeBaseCommit } from './tryGetMergeBaseCommit';
import { applyCommitFilesPatch } from './applyCommitFilesPatch';
import { applyMergeEditorColumnLayout } from './applyMergeEditorColumnLayout';
import { streamLogRecords } from './streamLogRecords';
import { getGitRoot } from './getGitRoot';
import { toRepoRelative } from './toRepoRelative';
import { isRepo } from './isRepo';
import { getCurrentBranch } from './getCurrentBranch';
import { getCurrentHeadSha } from './getCurrentHeadSha';
import { getLocalBranches } from './getLocalBranches';
import { getRemoteBranches } from './getRemoteBranches';
import { getBranches } from './getBranches';
import { getRemoteFetchUrls } from './getRemoteFetchUrls';
import { getTagsBasic } from './getTagsBasic';
import { mergeTagAvailability } from './mergeTagAvailability';
import { getTags } from './getTags';
import { getTagAvailabilityByRemote } from './getTagAvailabilityByRemote';
import { createBranch } from './createBranch';
import { createTag } from './createTag';
import { setRemoteUrl } from './setRemoteUrl';
import { addRemote } from './addRemote';
import { deleteRemote } from './deleteRemote';
import { renameBranch } from './renameBranch';
import { deleteBranch } from './deleteBranch';
import { checkoutBranch } from './checkoutBranch';
import { checkoutCommit } from './checkoutCommit';
import { trackBranch } from './trackBranch';
import { untrackBranch } from './untrackBranch';
import { mergeIntoCurrent } from './mergeIntoCurrent';
import { rebaseCurrentOnto } from './rebaseCurrentOnto';
import { rebaseInteractive } from './rebaseInteractive';
import { mergeAbort } from './mergeAbort';
import { rebaseAbort } from './rebaseAbort';
import { rebaseContinue } from './rebaseContinue';
import { rebaseSkip } from './rebaseSkip';
import { cherryPickAbort } from './cherryPickAbort';
import { cherryPickContinue } from './cherryPickContinue';
import { cherryPickSkip } from './cherryPickSkip';
import { revertAbort } from './revertAbort';
import { revertContinue } from './revertContinue';
import { resolveConflictOurs } from './resolveConflictOurs';
import { resolveConflictTheirs } from './resolveConflictTheirs';
import { getOperationState } from './getOperationState';
import { getGitDir } from './getGitDir';
import { onRepositoryStateChange } from './onRepositoryStateChange';
import { onRepositoryAvailable } from './onRepositoryAvailable';
import { onRepositoryClosed } from './onRepositoryClosed';
import { cherryPick } from './cherryPick';
import { cherryPickCommitFiles } from './cherryPickCommitFiles';
import { cherryPickRange } from './cherryPickRange';
import { revertCommit } from './revertCommit';
import { revertCommitFiles } from './revertCommitFiles';
import { resetCurrent } from './resetCurrent';
import { isCommitInCurrentBranch } from './isCommitInCurrentBranch';
import { getStashes } from './getStashes';
import { createStash } from './createStash';
import { applyStash } from './applyStash';
import { dropStash } from './dropStash';
import { renameStash } from './renameStash';
import { getStashPatch } from './getStashPatch';
import { getGraph } from './getGraph';
import { getCommitDetails } from './getCommitDetails';
import { getParentCommit } from './getParentCommit';
import { getFilesAtRevision } from './getFilesAtRevision';
import { getPatchForCommit } from './getPatchForCommit';
import { getPatchForCommitFiles } from './getPatchForCommitFiles';
import { getPatchBetweenRefsForFiles } from './getPatchBetweenRefsForFiles';
import { getPatchBetweenWorkingTreeAndRefForFiles } from './getPatchBetweenWorkingTreeAndRefForFiles';
import { canApplyPatchToWorkingTree } from './canApplyPatchToWorkingTree';
import { isPatchAlreadyApplied } from './isPatchAlreadyApplied';
import { applyPatchToWorkingTree } from './applyPatchToWorkingTree';
import { reverseApplyPatchToWorkingTree } from './reverseApplyPatchToWorkingTree';
import { getCompare } from './getCompare';
import { getChangedFiles } from './getChangedFiles';
import { stashFiles } from './stashFiles';
import { unstashToWorkingTree } from './unstashToWorkingTree';
import { getStagedFiles } from './getStagedFiles';
import { getMergeConflicts } from './getMergeConflicts';
import { getFileContentFromRef } from './getFileContentFromRef';
import { getFilesInCommit } from './getFilesInCommit';
import { getFilesInCommitWithStatus } from './getFilesInCommitWithStatus';
import { getFilesChangedBetween } from './getFilesChangedBetween';
import { getFilesChangedBetweenRefsWithStatus } from './getFilesChangedBetweenRefsWithStatus';
import { getFilesChangedBetweenWorkingTreeAndRef } from './getFilesChangedBetweenWorkingTreeAndRef';
import { resolveRevisionToCommit } from './resolveRevisionToCommit';
import { stageFile } from './stageFile';
import { unstageFile } from './unstageFile';
import { getOutgoingIncomingPreview } from './getOutgoingIncomingPreview';
import { push } from './push';
import { pull } from './pull';
import { fetchPrune } from './fetchPrune';
import { addAll } from './addAll';
import { stagePatch } from './stagePatch';
import { amendCommit } from './amendCommit';
import { commit } from './commit';
import { getHeadCommitMessage } from './getHeadCommitMessage';
import { generateCommitMessage } from './generateCommitMessage';
import { fileHistory } from './fileHistory';
import { directoryHistory } from './directoryHistory';
import { fileBlame } from './fileBlame';
import { openMergeEditor } from './openMergeEditor';
import { getFileStageContent } from './getFileStageContent';
import { getWorktrees } from './getWorktrees';
import { addWorktree } from './addWorktree';
import { addWorktreeBranch } from './addWorktreeBranch';
import { addDetachedWorktree } from './addDetachedWorktree';
import { removeWorktree } from './removeWorktree';
import { lockWorktree } from './lockWorktree';
import { unlockWorktree } from './unlockWorktree';
import { getPrunableWorktrees } from './getPrunableWorktrees';
import { pruneWorktrees } from './pruneWorktrees';
import { getWorktreeStatus } from './getWorktreeStatus';
import { getSubmodules } from './getSubmodules';
import { initSubmodule } from './initSubmodule';
import { initAllSubmodules } from './initAllSubmodules';
import { updateSubmodule } from './updateSubmodule';
import { updateAllSubmodules } from './updateAllSubmodules';
import { syncSubmodule } from './syncSubmodule';
import { deinitSubmodule } from './deinitSubmodule';
import { checkoutRecordedSubmoduleCommit } from './checkoutRecordedSubmoduleCommit';
import { pullSubmoduleTrackedBranch } from './pullSubmoduleTrackedBranch';
import { getSubmodulePointerDiff } from './getSubmodulePointerDiff';
import { stageSubmodulePointer } from './stageSubmodulePointer';

export type { RepoChangeSet } from '../repositoryStateDiff';

// ─── Class shape interface ────────────────────────────────────────────────────
/**
 * Structural interface used as the `this` type for extracted method functions.
 * All members listed here are accessed by at least one extracted function file.
 *
 * @internal Visibility-widening warning: several members were widened from
 * `private` to `readonly`/public so that extracted functions in sibling files
 * can access them via `this: GitServiceShape`. These are not part of the
 * public API and should not be consumed from outside the `gitService` module.
 * TODO: restore minimal visibility once use-cases are validated.
 */
export interface GitServiceShape {
  // ── Internal state fields (widened from private) ────────────────────────
  readonly context: RepositoryContext;
  readonly logger: Logger;
  readonly config: vscode.WorkspaceConfiguration;
  readonly gitCommandQueue: GitCommandQueue;
  _gitRootCache: string | undefined;
  _vscodeGitApi: Promise<VsCodeGitApi | undefined> | undefined;
  _vscodeGitRepository: VsCodeGitRepository | undefined;
  _gitDirCache: string | undefined;
  _submoduleService: SubmoduleService | undefined;

  // ── Computed accessors ──────────────────────────────────────────────────
  readonly gitRoot: string;
  readonly rootPath: string;
  readonly submoduleSvc: SubmoduleService;

  // ── Infrastructure (private → widened) ─────────────────────────────────
  logGitDuration(command: string, startedAt: number): void;
  runGitAt(cwd: string, args: string[]): Promise<GitCommandResult>;
  runGitAllowExitCodes(args: string[], allowedExitCodes: readonly number[]): Promise<GitCommandResult>;
  runGitWithStdin(args: string[], stdin: string): Promise<GitCommandResult>;
  getVsCodeGitApi(): Promise<VsCodeGitApi | undefined>;
  getVsCodeGitRoot(): Promise<string | undefined>;
  getVsCodeRepository(): Promise<VsCodeGitRepository | undefined>;
  getChangedFilesFromVsCodeGit(): Promise<WorkingTreeChange[] | undefined>;
  samePath(left: string, right: string): boolean;
  toAbsoluteRepoPath(relativeOrAbsolutePath: string): string;
  uniqueChangePaths(changes: readonly VsCodeGitChange[]): string[];
  isMissingFileContentError(error: unknown): boolean;
  resolveExactBranchRef(branch: string): Promise<string | undefined>;
  refExists(ref: string): Promise<boolean>;
  refPatternExists(pattern: string): Promise<boolean>;
  resolveShaFilter(message: string): Promise<string | undefined>;
  tryGetMergeBaseCommit(leftRef: string, rightRef: string): Promise<GraphCommit | undefined>;
  streamLogRecords(args: string[], onBatch: (commits: GraphCommit[]) => void): Promise<GraphCommit[]>;
  applyCommitFilesPatch(ref: string, filePaths: string[], reverse: boolean): Promise<void>;
  applyMergeEditorColumnLayout(): Promise<void>;

  // ── Public API ──────────────────────────────────────────────────────────
  runGit(args: string[]): Promise<GitCommandResult>;
  getGitRoot(): Promise<string>;
  toRepoRelative(absolutePath: string): string | undefined;
  isRepo(): Promise<boolean>;
  getCurrentBranch(): Promise<string>;
  getCurrentHeadSha(): Promise<string>;
  getLocalBranches(): Promise<BranchRef[]>;
  getRemoteBranches(remoteUrls: Map<string, string>): Promise<BranchRef[]>;
  getBranches(): Promise<BranchRef[]>;
  getRemoteFetchUrls(): Promise<Map<string, string>>;
  getTagsBasic(): Promise<TagRef[]>;
  mergeTagAvailability(tags: readonly TagRef[], availability: ReadonlyMap<string, ReadonlySet<string>>): TagRef[];
  getTags(): Promise<TagRef[]>;
  getTagAvailabilityByRemote(): Promise<Map<string, Set<string>>>;
  createBranch(name: string, base?: string): Promise<void>;
  createTag(name: string, ref: string): Promise<void>;
  setRemoteUrl(remoteName: string, remoteUrl: string): Promise<void>;
  addRemote(remoteName: string, remoteUrl: string): Promise<void>;
  deleteRemote(remoteName: string): Promise<void>;
  renameBranch(from: string, to: string): Promise<void>;
  deleteBranch(branch: string, force?: boolean): Promise<void>;
  checkoutBranch(branch: string): Promise<void>;
  checkoutCommit(commit: string): Promise<void>;
  trackBranch(localBranch: string, upstream: string): Promise<void>;
  untrackBranch(localBranch: string): Promise<void>;
  mergeIntoCurrent(branch: string): Promise<void>;
  rebaseCurrentOnto(branch: string): Promise<void>;
  rebaseInteractive(base: string): Promise<void>;
  mergeAbort(): Promise<void>;
  rebaseAbort(): Promise<void>;
  rebaseContinue(): Promise<void>;
  rebaseSkip(): Promise<void>;
  cherryPickAbort(): Promise<void>;
  cherryPickContinue(): Promise<void>;
  cherryPickSkip(): Promise<void>;
  revertAbort(): Promise<void>;
  revertContinue(): Promise<void>;
  resolveConflictOurs(path: string): Promise<void>;
  resolveConflictTheirs(path: string): Promise<void>;
  getOperationState(): Promise<GitOperationState>;
  getGitDir(): Promise<string | undefined>;
  onRepositoryStateChange(listener: (changeSet: RepoChangeSet) => void): Promise<vscode.Disposable | undefined>;
  onRepositoryAvailable(listener: () => void): Promise<vscode.Disposable | undefined>;
  onRepositoryClosed(listener: () => void): Promise<vscode.Disposable | undefined>;
  cherryPick(ref: string): Promise<void>;
  cherryPickCommitFiles(ref: string, filePaths: string[]): Promise<void>;
  cherryPickRange(fromExclusive: string, toInclusive: string): Promise<void>;
  revertCommit(ref: string): Promise<void>;
  revertCommitFiles(ref: string, filePaths: string[]): Promise<void>;
  resetCurrent(ref: string, mode: 'soft' | 'mixed' | 'hard'): Promise<void>;
  isCommitInCurrentBranch(sha: string): Promise<boolean>;
  getStashes(): Promise<StashEntry[]>;
  createStash(message: string, options: { includeUntracked: boolean; keepIndex: boolean }): Promise<void>;
  applyStash(ref: string, pop?: boolean): Promise<void>;
  dropStash(ref: string): Promise<void>;
  renameStash(ref: string, message: string): Promise<void>;
  getStashPatch(ref: string): Promise<string>;
  getGraph(maxCount: number, skip?: number, filters?: CommitFilters): Promise<GraphCommit[]>;
  getCommitDetails(sha: string): Promise<CommitDetails>;
  getParentCommit(sha: string): Promise<string | undefined>;
  getFilesAtRevision(ref: string): Promise<string[]>;
  getPatchForCommit(sha: string): Promise<string>;
  getPatchForCommitFiles(sha: string, filePaths: string[]): Promise<string>;
  getPatchBetweenRefsForFiles(fromRef: string, toRef: string, filePaths: string[]): Promise<string>;
  getPatchBetweenWorkingTreeAndRefForFiles(ref: string, filePaths: string[]): Promise<string>;
  canApplyPatchToWorkingTree(patch: string): Promise<boolean>;
  isPatchAlreadyApplied(patch: string): Promise<boolean>;
  applyPatchToWorkingTree(patch: string): Promise<void>;
  reverseApplyPatchToWorkingTree(patch: string): Promise<void>;
  getCompare(leftRef: string, rightRef: string): Promise<CompareResult>;
  getChangedFiles(): Promise<WorkingTreeChange[]>;
  stashFiles(paths: string[], message: string, options: { keepIndex: boolean; includeUntracked?: boolean }): Promise<void>;
  unstashToWorkingTree(ref: string): Promise<void>;
  getStagedFiles(): Promise<string[]>;
  getMergeConflicts(): Promise<MergeConflictFile[]>;
  getFileContentFromRef(refSpec: string, relativePath: string): Promise<string>;
  getFilesInCommit(sha: string): Promise<string[]>;
  getFilesInCommitWithStatus(sha: string): Promise<CommitFileChange[]>;
  getFilesChangedBetween(leftRef: string, rightRef: string): Promise<string[]>;
  getFilesChangedBetweenRefsWithStatus(fromRef: string, toRef: string): Promise<CommitFileChange[]>;
  getFilesChangedBetweenWorkingTreeAndRef(ref: string, scopePath?: string): Promise<WorkingTreeFileChange[]>;
  resolveRevisionToCommit(input: string): Promise<ResolvedCommitMeta | undefined>;
  stageFile(path: string): Promise<void>;
  unstageFile(path: string): Promise<void>;
  getOutgoingIncomingPreview(): Promise<{ outgoing: string[]; incoming: string[] }>;
  push(): Promise<void>;
  pull(): Promise<void>;
  fetchPrune(): Promise<void>;
  addAll(): Promise<void>;
  stagePatch(filePath: string): Promise<void>;
  amendCommit(message?: string): Promise<void>;
  commit(message: string): Promise<void>;
  getHeadCommitMessage(): Promise<string>;
  generateCommitMessage(token?: vscode.CancellationToken): Promise<string>;
  fileHistory(path: string): Promise<GraphCommit[]>;
  directoryHistory(path: string, onBatch?: (commits: GraphCommit[]) => void): Promise<GraphCommit[]>;
  fileBlame(path: string): Promise<string>;
  openMergeEditor(filePath: string): Promise<void>;
  getFileStageContent(stage: 1 | 2 | 3, filePath: string): Promise<string>;
  getWorktrees(): Promise<WorktreeEntry[]>;
  addWorktree(worktreePath: string, ref: string): Promise<void>;
  addWorktreeBranch(worktreePath: string, branch: string, base?: string): Promise<void>;
  addDetachedWorktree(worktreePath: string, ref: string): Promise<void>;
  removeWorktree(worktreePath: string, force?: boolean): Promise<void>;
  lockWorktree(worktreePath: string, reason?: string): Promise<void>;
  unlockWorktree(worktreePath: string): Promise<void>;
  getPrunableWorktrees(): Promise<WorktreePruneEntry[]>;
  pruneWorktrees(): Promise<void>;
  getWorktreeStatus(worktreePath: string): Promise<WorktreeStatus>;
  getSubmodules(): Promise<SubmoduleEntry[]>;
  initSubmodule(submodulePath: string, opts?: { sink?: SubmoduleLogSink; signal?: AbortSignal }): Promise<SpawnGitStreamingResult>;
  initAllSubmodules(opts?: { sink?: SubmoduleLogSink; signal?: AbortSignal }): Promise<SpawnGitStreamingResult>;
  updateSubmodule(submodulePath: string, recursive?: boolean, opts?: { sink?: SubmoduleLogSink; signal?: AbortSignal }): Promise<SpawnGitStreamingResult>;
  updateAllSubmodules(recursive?: boolean, opts?: { sink?: SubmoduleLogSink; signal?: AbortSignal }): Promise<SpawnGitStreamingResult>;
  syncSubmodule(submodulePath?: string, recursive?: boolean, opts?: { sink?: SubmoduleLogSink; signal?: AbortSignal }): Promise<SpawnGitStreamingResult>;
  deinitSubmodule(submodulePath: string, force?: boolean, opts?: { sink?: SubmoduleLogSink; signal?: AbortSignal }): Promise<SpawnGitStreamingResult>;
  checkoutRecordedSubmoduleCommit(submodulePath: string, opts?: { sink?: SubmoduleLogSink; signal?: AbortSignal }): Promise<SpawnGitStreamingResult>;
  pullSubmoduleTrackedBranch(submodulePath: string, opts?: { sink?: SubmoduleLogSink; signal?: AbortSignal }): Promise<SpawnGitStreamingResult>;
  getSubmodulePointerDiff(submodulePath: string): Promise<string>;
  stageSubmodulePointer(submodulePath: string): Promise<void>;
}

// ─── Class shell ─────────────────────────────────────────────────────────────
export class GitService {
  // ── Internal state (widened from private for extraction compatibility) ──
  /** @internal */ _gitRootCache: string | undefined;
  /** @internal */ _vscodeGitApi: Promise<VsCodeGitApi | undefined> | undefined;
  /** @internal */ _vscodeGitRepository: VsCodeGitRepository | undefined;
  /** @internal */ readonly gitCommandQueue = new GitCommandQueue(process.platform === 'win32' ? 2 : 4);
  /** @internal */ _gitDirCache: string | undefined;
  /** @internal */ _submoduleService: SubmoduleService | undefined;

  constructor(
    /** @internal */ readonly context: RepositoryContext,
    /** @internal */ readonly logger: Logger,
    /** @internal */ readonly config: vscode.WorkspaceConfiguration
  ) { }

  get rootPath(): string {
    return this.context.rootPath;
  }

  /**
   * Synchronous accessor for the resolved git root. Falls back to the workspace
   * root until {@link getGitRoot} has populated the cache (done during activate).
   * All path arguments passed to git commands must be relative to this path.
   */
  get gitRoot(): string {
    return this._gitRootCache ?? this.context.rootPath;
  }

  /** @internal */
  get submoduleSvc(): SubmoduleService {
    if (!this._submoduleService) {
      this._submoduleService = new SubmoduleService(
        this.config,
        this.gitRoot,
        this.runGit.bind(this)
      );
    }
    return this._submoduleService;
  }

  // ── Infrastructure delegates ─────────────────────────────────────────────
  /** @internal */ logGitDuration(command: string, startedAt: number): void { return logGitDuration.call(this as GitServiceShape, command, startedAt); }
  /** @internal */ async runGitAt(cwd: string, args: string[]): Promise<GitCommandResult> { return runGitAt.call(this as GitServiceShape, cwd, args); }
  /** @internal */ async runGitAllowExitCodes(args: string[], allowedExitCodes: readonly number[]): Promise<GitCommandResult> { return runGitAllowExitCodes.call(this as GitServiceShape, args, allowedExitCodes); }
  /** @internal */ async runGitWithStdin(args: string[], stdin: string): Promise<GitCommandResult> { return runGitWithStdin.call(this as GitServiceShape, args, stdin); }
  /** @internal */ samePath(left: string, right: string): boolean { return samePath(left, right); }
  /** @internal */ toAbsoluteRepoPath(relativeOrAbsolutePath: string): string { return toAbsoluteRepoPath.call(this as GitServiceShape, relativeOrAbsolutePath); }
  /** @internal */ uniqueChangePaths(changes: readonly VsCodeGitChange[]): string[] { return uniqueChangePaths(changes); }
  /** @internal */ isMissingFileContentError(error: unknown): boolean { return isMissingFileContentError(error); }
  /** @internal */ async getVsCodeGitApi(): Promise<VsCodeGitApi | undefined> { return getVsCodeGitApi.call(this as GitServiceShape); }
  /** @internal */ async getVsCodeGitRoot(): Promise<string | undefined> { return getVsCodeGitRoot.call(this as GitServiceShape); }
  /** @internal */ async getVsCodeRepository(): Promise<VsCodeGitRepository | undefined> { return getVsCodeRepository.call(this as GitServiceShape); }
  /** @internal */ async getChangedFilesFromVsCodeGit(): Promise<WorkingTreeChange[] | undefined> { return getChangedFilesFromVsCodeGit.call(this as GitServiceShape); }
  /** @internal */ async resolveExactBranchRef(branch: string): Promise<string | undefined> { return resolveExactBranchRef.call(this as GitServiceShape, branch); }
  /** @internal */ async refExists(ref: string): Promise<boolean> { return refExists.call(this as GitServiceShape, ref); }
  /** @internal */ async refPatternExists(pattern: string): Promise<boolean> { return refPatternExists.call(this as GitServiceShape, pattern); }
  /** @internal */ async resolveShaFilter(message: string): Promise<string | undefined> { return resolveShaFilter.call(this as GitServiceShape, message); }
  /** @internal */ async tryGetMergeBaseCommit(leftRef: string, rightRef: string): Promise<GraphCommit | undefined> { return tryGetMergeBaseCommit.call(this as GitServiceShape, leftRef, rightRef); }
  /** @internal */ streamLogRecords(args: string[], onBatch: (commits: GraphCommit[]) => void): Promise<GraphCommit[]> { return streamLogRecords.call(this as GitServiceShape, args, onBatch); }
  /** @internal */ async applyCommitFilesPatch(ref: string, filePaths: string[], reverse: boolean): Promise<void> { return applyCommitFilesPatch.call(this as GitServiceShape, ref, filePaths, reverse); }
  /** @internal */ async applyMergeEditorColumnLayout(): Promise<void> { return applyMergeEditorColumnLayout(); }

  // ── Public API delegates ─────────────────────────────────────────────────
  async runGit(args: string[]): Promise<GitCommandResult> { return runGit.call(this as GitServiceShape, args); }
  async getGitRoot(): Promise<string> { return getGitRoot.call(this as GitServiceShape); }
  toRepoRelative(absolutePath: string): string | undefined { return toRepoRelative.call(this as GitServiceShape, absolutePath); }
  async isRepo(): Promise<boolean> { return isRepo.call(this as GitServiceShape); }
  async getCurrentBranch(): Promise<string> { return getCurrentBranch.call(this as GitServiceShape); }
  async getCurrentHeadSha(): Promise<string> { return getCurrentHeadSha.call(this as GitServiceShape); }
  async getLocalBranches(): Promise<BranchRef[]> { return getLocalBranches.call(this as GitServiceShape); }
  async getRemoteBranches(remoteUrls: Map<string, string>): Promise<BranchRef[]> { return getRemoteBranches.call(this as GitServiceShape, remoteUrls); }
  async getBranches(): Promise<BranchRef[]> { return getBranches.call(this as GitServiceShape); }
  async getRemoteFetchUrls(): Promise<Map<string, string>> { return getRemoteFetchUrls.call(this as GitServiceShape); }
  async getTagsBasic(): Promise<TagRef[]> { return getTagsBasic.call(this as GitServiceShape); }
  mergeTagAvailability(tags: readonly TagRef[], availability: ReadonlyMap<string, ReadonlySet<string>>): TagRef[] { return mergeTagAvailability(tags, availability); }
  async getTags(): Promise<TagRef[]> { return getTags.call(this as GitServiceShape); }
  async getTagAvailabilityByRemote(): Promise<Map<string, Set<string>>> { return getTagAvailabilityByRemote.call(this as GitServiceShape); }
  async createBranch(name: string, base?: string): Promise<void> { return createBranch.call(this as GitServiceShape, name, base); }
  async createTag(name: string, ref: string): Promise<void> { return createTag.call(this as GitServiceShape, name, ref); }
  async setRemoteUrl(remoteName: string, remoteUrl: string): Promise<void> { return setRemoteUrl.call(this as GitServiceShape, remoteName, remoteUrl); }
  async addRemote(remoteName: string, remoteUrl: string): Promise<void> { return addRemote.call(this as GitServiceShape, remoteName, remoteUrl); }
  async deleteRemote(remoteName: string): Promise<void> { return deleteRemote.call(this as GitServiceShape, remoteName); }
  async renameBranch(from: string, to: string): Promise<void> { return renameBranch.call(this as GitServiceShape, from, to); }
  async deleteBranch(branch: string, force = false): Promise<void> { return deleteBranch.call(this as GitServiceShape, branch, force); }
  async checkoutBranch(branch: string): Promise<void> { return checkoutBranch.call(this as GitServiceShape, branch); }
  async checkoutCommit(commit: string): Promise<void> { return checkoutCommit.call(this as GitServiceShape, commit); }
  async trackBranch(localBranch: string, upstream: string): Promise<void> { return trackBranch.call(this as GitServiceShape, localBranch, upstream); }
  async untrackBranch(localBranch: string): Promise<void> { return untrackBranch.call(this as GitServiceShape, localBranch); }
  async mergeIntoCurrent(branch: string): Promise<void> { return mergeIntoCurrent.call(this as GitServiceShape, branch); }
  async rebaseCurrentOnto(branch: string): Promise<void> { return rebaseCurrentOnto.call(this as GitServiceShape, branch); }
  async rebaseInteractive(base: string): Promise<void> { return rebaseInteractive.call(this as GitServiceShape, base); }
  async mergeAbort(): Promise<void> { return mergeAbort.call(this as GitServiceShape); }
  async rebaseAbort(): Promise<void> { return rebaseAbort.call(this as GitServiceShape); }
  async rebaseContinue(): Promise<void> { return rebaseContinue.call(this as GitServiceShape); }
  async rebaseSkip(): Promise<void> { return rebaseSkip.call(this as GitServiceShape); }
  async cherryPickAbort(): Promise<void> { return cherryPickAbort.call(this as GitServiceShape); }
  async cherryPickContinue(): Promise<void> { return cherryPickContinue.call(this as GitServiceShape); }
  async cherryPickSkip(): Promise<void> { return cherryPickSkip.call(this as GitServiceShape); }
  async revertAbort(): Promise<void> { return revertAbort.call(this as GitServiceShape); }
  async revertContinue(): Promise<void> { return revertContinue.call(this as GitServiceShape); }
  async resolveConflictOurs(path: string): Promise<void> { return resolveConflictOurs.call(this as GitServiceShape, path); }
  async resolveConflictTheirs(path: string): Promise<void> { return resolveConflictTheirs.call(this as GitServiceShape, path); }
  async getOperationState(): Promise<GitOperationState> { return getOperationState.call(this as GitServiceShape); }
  async getGitDir(): Promise<string | undefined> { return getGitDir.call(this as GitServiceShape); }
  async onRepositoryStateChange(listener: (changeSet: RepoChangeSet) => void): Promise<vscode.Disposable | undefined> { return onRepositoryStateChange.call(this as GitServiceShape, listener); }
  async onRepositoryAvailable(listener: () => void): Promise<vscode.Disposable | undefined> { return onRepositoryAvailable.call(this as GitServiceShape, listener); }
  async onRepositoryClosed(listener: () => void): Promise<vscode.Disposable | undefined> { return onRepositoryClosed.call(this as GitServiceShape, listener); }
  async cherryPick(ref: string): Promise<void> { return cherryPick.call(this as GitServiceShape, ref); }
  async cherryPickCommitFiles(ref: string, filePaths: string[]): Promise<void> { return cherryPickCommitFiles.call(this as GitServiceShape, ref, filePaths); }
  async cherryPickRange(fromExclusive: string, toInclusive: string): Promise<void> { return cherryPickRange.call(this as GitServiceShape, fromExclusive, toInclusive); }
  async revertCommit(ref: string): Promise<void> { return revertCommit.call(this as GitServiceShape, ref); }
  async revertCommitFiles(ref: string, filePaths: string[]): Promise<void> { return revertCommitFiles.call(this as GitServiceShape, ref, filePaths); }
  async resetCurrent(ref: string, mode: 'soft' | 'mixed' | 'hard'): Promise<void> { return resetCurrent.call(this as GitServiceShape, ref, mode); }
  async isCommitInCurrentBranch(sha: string): Promise<boolean> { return isCommitInCurrentBranch.call(this as GitServiceShape, sha); }
  async getStashes(): Promise<StashEntry[]> { return getStashes.call(this as GitServiceShape); }
  async createStash(message: string, options: { includeUntracked: boolean; keepIndex: boolean }): Promise<void> { return createStash.call(this as GitServiceShape, message, options); }
  async applyStash(ref: string, pop = false): Promise<void> { return applyStash.call(this as GitServiceShape, ref, pop); }
  async dropStash(ref: string): Promise<void> { return dropStash.call(this as GitServiceShape, ref); }
  async renameStash(ref: string, message: string): Promise<void> { return renameStash.call(this as GitServiceShape, ref, message); }
  async getStashPatch(ref: string): Promise<string> { return getStashPatch.call(this as GitServiceShape, ref); }
  async getGraph(maxCount: number, skip = 0, filters?: CommitFilters): Promise<GraphCommit[]> { return getGraph.call(this as GitServiceShape, maxCount, skip, filters); }
  async getCommitDetails(sha: string): Promise<CommitDetails> { return getCommitDetails.call(this as GitServiceShape, sha); }
  async getParentCommit(sha: string): Promise<string | undefined> { return getParentCommit.call(this as GitServiceShape, sha); }
  async getFilesAtRevision(ref: string): Promise<string[]> { return getFilesAtRevision.call(this as GitServiceShape, ref); }
  async getPatchForCommit(sha: string): Promise<string> { return getPatchForCommit.call(this as GitServiceShape, sha); }
  async getPatchForCommitFiles(sha: string, filePaths: string[]): Promise<string> { return getPatchForCommitFiles.call(this as GitServiceShape, sha, filePaths); }
  async getPatchBetweenRefsForFiles(fromRef: string, toRef: string, filePaths: string[]): Promise<string> { return getPatchBetweenRefsForFiles.call(this as GitServiceShape, fromRef, toRef, filePaths); }
  async getPatchBetweenWorkingTreeAndRefForFiles(ref: string, filePaths: string[]): Promise<string> { return getPatchBetweenWorkingTreeAndRefForFiles.call(this as GitServiceShape, ref, filePaths); }
  async canApplyPatchToWorkingTree(patch: string): Promise<boolean> { return canApplyPatchToWorkingTree.call(this as GitServiceShape, patch); }
  async isPatchAlreadyApplied(patch: string): Promise<boolean> { return isPatchAlreadyApplied.call(this as GitServiceShape, patch); }
  async applyPatchToWorkingTree(patch: string): Promise<void> { return applyPatchToWorkingTree.call(this as GitServiceShape, patch); }
  async reverseApplyPatchToWorkingTree(patch: string): Promise<void> { return reverseApplyPatchToWorkingTree.call(this as GitServiceShape, patch); }
  async getCompare(leftRef: string, rightRef: string): Promise<CompareResult> { return getCompare.call(this as GitServiceShape, leftRef, rightRef); }
  async getChangedFiles(): Promise<WorkingTreeChange[]> { return getChangedFiles.call(this as GitServiceShape); }
  async stashFiles(paths: string[], message: string, options: { keepIndex: boolean; includeUntracked?: boolean }): Promise<void> { return stashFiles.call(this as GitServiceShape, paths, message, options); }
  async unstashToWorkingTree(ref: string): Promise<void> { return unstashToWorkingTree.call(this as GitServiceShape, ref); }
  async getStagedFiles(): Promise<string[]> { return getStagedFiles.call(this as GitServiceShape); }
  async getMergeConflicts(): Promise<MergeConflictFile[]> { return getMergeConflicts.call(this as GitServiceShape); }
  async getFileContentFromRef(refSpec: string, relativePath: string): Promise<string> { return getFileContentFromRef.call(this as GitServiceShape, refSpec, relativePath); }
  async getFilesInCommit(sha: string): Promise<string[]> { return getFilesInCommit.call(this as GitServiceShape, sha); }
  async getFilesInCommitWithStatus(sha: string): Promise<CommitFileChange[]> { return getFilesInCommitWithStatus.call(this as GitServiceShape, sha); }
  async getFilesChangedBetween(leftRef: string, rightRef: string): Promise<string[]> { return getFilesChangedBetween.call(this as GitServiceShape, leftRef, rightRef); }
  async getFilesChangedBetweenRefsWithStatus(fromRef: string, toRef: string): Promise<CommitFileChange[]> { return getFilesChangedBetweenRefsWithStatus.call(this as GitServiceShape, fromRef, toRef); }
  async getFilesChangedBetweenWorkingTreeAndRef(ref: string, scopePath?: string): Promise<WorkingTreeFileChange[]> { return getFilesChangedBetweenWorkingTreeAndRef.call(this as GitServiceShape, ref, scopePath); }
  async resolveRevisionToCommit(input: string): Promise<ResolvedCommitMeta | undefined> { return resolveRevisionToCommit.call(this as GitServiceShape, input); }
  async stageFile(path: string): Promise<void> { return stageFile.call(this as GitServiceShape, path); }
  async unstageFile(path: string): Promise<void> { return unstageFile.call(this as GitServiceShape, path); }
  async getOutgoingIncomingPreview(): Promise<{ outgoing: string[]; incoming: string[] }> { return getOutgoingIncomingPreview.call(this as GitServiceShape); }
  async push(): Promise<void> { return push.call(this as GitServiceShape); }
  async pull(): Promise<void> { return pull.call(this as GitServiceShape); }
  async fetchPrune(): Promise<void> { return fetchPrune.call(this as GitServiceShape); }
  async addAll(): Promise<void> { return addAll.call(this as GitServiceShape); }
  async stagePatch(filePath: string): Promise<void> { return stagePatch.call(this as GitServiceShape, filePath); }
  async amendCommit(message?: string): Promise<void> { return amendCommit.call(this as GitServiceShape, message); }
  async commit(message: string): Promise<void> { return commit.call(this as GitServiceShape, message); }
  async getHeadCommitMessage(): Promise<string> { return getHeadCommitMessage.call(this as GitServiceShape); }
  async generateCommitMessage(token?: vscode.CancellationToken): Promise<string> { return generateCommitMessage.call(this as GitServiceShape, token); }
  async fileHistory(path: string): Promise<GraphCommit[]> { return fileHistory.call(this as GitServiceShape, path); }
  async directoryHistory(path: string, onBatch?: (commits: GraphCommit[]) => void): Promise<GraphCommit[]> { return directoryHistory.call(this as GitServiceShape, path, onBatch); }
  async fileBlame(path: string): Promise<string> { return fileBlame.call(this as GitServiceShape, path); }
  async openMergeEditor(filePath: string): Promise<void> { return openMergeEditor.call(this as GitServiceShape, filePath); }
  async getFileStageContent(stage: 1 | 2 | 3, filePath: string): Promise<string> { return getFileStageContent.call(this as GitServiceShape, stage, filePath); }
  async getWorktrees(): Promise<WorktreeEntry[]> { return getWorktrees.call(this as GitServiceShape); }
  async addWorktree(worktreePath: string, ref: string): Promise<void> { return addWorktree.call(this as GitServiceShape, worktreePath, ref); }
  async addWorktreeBranch(worktreePath: string, branch: string, base?: string): Promise<void> { return addWorktreeBranch.call(this as GitServiceShape, worktreePath, branch, base); }
  async addDetachedWorktree(worktreePath: string, ref: string): Promise<void> { return addDetachedWorktree.call(this as GitServiceShape, worktreePath, ref); }
  async removeWorktree(worktreePath: string, force = false): Promise<void> { return removeWorktree.call(this as GitServiceShape, worktreePath, force); }
  async lockWorktree(worktreePath: string, reason?: string): Promise<void> { return lockWorktree.call(this as GitServiceShape, worktreePath, reason); }
  async unlockWorktree(worktreePath: string): Promise<void> { return unlockWorktree.call(this as GitServiceShape, worktreePath); }
  async getPrunableWorktrees(): Promise<WorktreePruneEntry[]> { return getPrunableWorktrees.call(this as GitServiceShape); }
  async pruneWorktrees(): Promise<void> { return pruneWorktrees.call(this as GitServiceShape); }
  async getWorktreeStatus(worktreePath: string): Promise<WorktreeStatus> { return getWorktreeStatus.call(this as GitServiceShape, worktreePath); }
  async getSubmodules(): Promise<SubmoduleEntry[]> { return getSubmodules.call(this as GitServiceShape); }
  async initSubmodule(submodulePath: string, opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}): Promise<SpawnGitStreamingResult> { return initSubmodule.call(this as GitServiceShape, submodulePath, opts); }
  async initAllSubmodules(opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}): Promise<SpawnGitStreamingResult> { return initAllSubmodules.call(this as GitServiceShape, opts); }
  async updateSubmodule(submodulePath: string, recursive = false, opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}): Promise<SpawnGitStreamingResult> { return updateSubmodule.call(this as GitServiceShape, submodulePath, recursive, opts); }
  async updateAllSubmodules(recursive = false, opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}): Promise<SpawnGitStreamingResult> { return updateAllSubmodules.call(this as GitServiceShape, recursive, opts); }
  async syncSubmodule(submodulePath?: string, recursive = false, opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}): Promise<SpawnGitStreamingResult> { return syncSubmodule.call(this as GitServiceShape, submodulePath, recursive, opts); }
  async deinitSubmodule(submodulePath: string, force = false, opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}): Promise<SpawnGitStreamingResult> { return deinitSubmodule.call(this as GitServiceShape, submodulePath, force, opts); }
  async checkoutRecordedSubmoduleCommit(submodulePath: string, opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}): Promise<SpawnGitStreamingResult> { return checkoutRecordedSubmoduleCommit.call(this as GitServiceShape, submodulePath, opts); }
  async pullSubmoduleTrackedBranch(submodulePath: string, opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}): Promise<SpawnGitStreamingResult> { return pullSubmoduleTrackedBranch.call(this as GitServiceShape, submodulePath, opts); }
  async getSubmodulePointerDiff(submodulePath: string): Promise<string> { return getSubmodulePointerDiff.call(this as GitServiceShape, submodulePath); }
  async stageSubmodulePointer(submodulePath: string): Promise<void> { return stageSubmodulePointer.call(this as GitServiceShape, submodulePath); }
}
