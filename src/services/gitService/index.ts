import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { getConfigValue } from '../../configuration';
import { Logger } from '../../logger';
import { GitCommandQueue } from '../gitCommandQueue';
import {
  BranchRef,
  CommitFilters,
  CommitDetails,
  CommitFileChange,
  CompareResult,
  GitCommandResult,
  GitOperationState,
  GraphCommit,
  MergeConflictFile,
  RepositoryContext,
  ResolvedCommitMeta,
  StashEntry,
  TagRef,
  WorkingTreeChange,
  WorkingTreeFileChange,
  WorktreeEntry,
  WorktreePruneEntry,
  WorktreeStatus,
  SubmoduleEntry
} from '../../types';
import { SubmoduleService, SpawnGitStreamingResult } from '../submoduleService';
import { SubmoduleLogSink } from '../submoduleLogSink';
import { parseWorktreeListPorcelain, parseWorktreePruneDryRun } from '../worktreeParsing';
import { parseTrack, parseNameStatusZ, parsePorcelainStatusZ } from '../gitParsing';
import {
  buildRepositoryFingerprint,
  diffRepositoryFingerprints,
  isEmptyChangeSet,
  RepoChangeSet,
  RepositoryFingerprint
} from '../repositoryStateDiff';

import { getGitRoot } from './getGitRoot';
import { toRepoRelative } from './toRepoRelative';
import { isRepo } from './isRepo';
import { getCurrentBranch } from './getCurrentBranch';
import { getCurrentHeadSha } from './getCurrentHeadSha';
import { getLocalBranches } from './getLocalBranches';
import { getRemoteBranches } from './getRemoteBranches';
import { getBranches } from './getBranches';
import { parseBranchLines } from './parseBranchLines';
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
import { getVsCodeGitApi } from './getVsCodeGitApi';
import { getVsCodeGitRoot } from './getVsCodeGitRoot';
import { getVsCodeRepository } from './getVsCodeRepository';
import { onRepositoryStateChange } from './onRepositoryStateChange';
import { onRepositoryAvailable } from './onRepositoryAvailable';
import { onRepositoryClosed } from './onRepositoryClosed';
import { toAbsoluteRepoPath } from './toAbsoluteRepoPath';
import { uniqueChangePaths } from './uniqueChangePaths';
import { getChangedFilesFromVsCodeGit } from './getChangedFilesFromVsCodeGit';
import { samePath } from './samePath';
import { getGitDir } from './getGitDir';
import { cherryPick } from './cherryPick';
import { cherryPickCommitFiles } from './cherryPickCommitFiles';
import { cherryPickRange } from './cherryPickRange';
import { getCommitTimestamps } from './getCommitTimestamps';
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
import { resolveExactBranchRef } from './resolveExactBranchRef';
import { refExists } from './refExists';
import { refPatternExists } from './refPatternExists';
import { resolveShaFilter } from './resolveShaFilter';
import { getCommitDetails } from './getCommitDetails';
import { getParentCommit } from './getParentCommit';
import { getFilesAtRevision } from './getFilesAtRevision';
import { getPatchForCommit } from './getPatchForCommit';
import { getPatchForCommitRange } from './getPatchForCommitRange';
import { getPatchForCommitFiles } from './getPatchForCommitFiles';
import { getPatchBetweenRefsForFiles } from './getPatchBetweenRefsForFiles';
import { getPatchBetweenWorkingTreeAndRefForFiles } from './getPatchBetweenWorkingTreeAndRefForFiles';
import { canApplyPatchToWorkingTree } from './canApplyPatchToWorkingTree';
import { isPatchAlreadyApplied } from './isPatchAlreadyApplied';
import { applyPatchToWorkingTree } from './applyPatchToWorkingTree';
import { reverseApplyPatchToWorkingTree } from './reverseApplyPatchToWorkingTree';
import { getCompare } from './getCompare';
import { tryGetMergeBaseCommit } from './tryGetMergeBaseCommit';
import { getChangedFiles } from './getChangedFiles';
import { stashFiles } from './stashFiles';
import { unstashToWorkingTree } from './unstashToWorkingTree';
import { getStagedFiles } from './getStagedFiles';
import { getMergeConflicts } from './getMergeConflicts';
import { getFileContentFromRef } from './getFileContentFromRef';
import { isMissingFileContentError } from './isMissingFileContentError';
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
import { streamLogRecords } from './streamLogRecords';
import { fileBlame } from './fileBlame';
import { openMergeEditor } from './openMergeEditor';
import { applyMergeEditorColumnLayout } from './applyMergeEditorColumnLayout';
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
import { logGitDuration } from './logGitDuration';
import { runGitAt } from './runGitAt';
import { runGit } from './runGit';
import { runGitAllowExitCodes } from './runGitAllowExitCodes';
import { applyCommitFilesPatch } from './applyCommitFilesPatch';
import { runGitWithStdin } from './runGitWithStdin';

export type { RepoChangeSet } from '../repositoryStateDiff';

const FIELD_SEPARATOR = '|~|';
const RECORD_SEPARATOR = '|#|';

interface VsCodeGitChange {
  readonly uri: vscode.Uri;
}

interface VsCodeGitRepository {
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
  createStash(options?: {
    message?: string;
    includeUntracked?: boolean;
    staged?: boolean;
  }): Promise<void>;
}

interface VsCodeGitApi {
  readonly repositories: readonly VsCodeGitRepository[];
  getRepository(uri: vscode.Uri): VsCodeGitRepository | null;
  getRepositoryRoot(uri: vscode.Uri): Promise<vscode.Uri | null>;
  openRepository(root: vscode.Uri): Promise<VsCodeGitRepository | null>;
  readonly onDidOpenRepository?: vscode.Event<VsCodeGitRepository>;
  readonly onDidCloseRepository?: vscode.Event<VsCodeGitRepository>;
}

interface VsCodeGitExtension {
  readonly enabled: boolean;
  getAPI(version: 1): VsCodeGitApi;
}

export class GitService {
  public _gitRootCache: string | undefined;
  public _vscodeGitApi: Promise<VsCodeGitApi | undefined> | undefined;
  public _vscodeGitRepository: VsCodeGitRepository | undefined;
  public readonly gitCommandQueue = new GitCommandQueue(process.platform === 'win32' ? 2 : 4);

  static readonly BRANCH_FORMAT = [
    '%(refname:short)',
    '%(refname)',
    '%(upstream:short)',
    '%(upstream:track)',
    '%(HEAD)',
    '%(committerdate:unix)'
  ].join(FIELD_SEPARATOR);

  static readonly BRANCH_SORT_COMPARATOR = (a: BranchRef, b: BranchRef): number => {
    if (a.current) {
      return -1;
    }
    if (b.current) {
      return 1;
    }
    if (a.type !== b.type) {
      return a.type === 'local' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  };

  static readonly TAG_FORMAT = [
    '%(refname:short)',
    '%(refname)',
    '%(objectname)',
    '%(*objectname)',
    '%(creatordate:unix)'
  ].join(FIELD_SEPARATOR);

  static readonly TAG_SORT_COMPARATOR = (a: TagRef, b: TagRef): number => {
    const left = a.lastCommitEpoch ?? 0;
    const right = b.lastCommitEpoch ?? 0;
    if (left !== right) {
      return right - left;
    }
    return a.name.localeCompare(b.name);
  };

  constructor(
    public readonly context: RepositoryContext,
    public readonly logger: Logger,
    public readonly config: vscode.WorkspaceConfiguration
  ) {}

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

  public readonly getGitRoot = getGitRoot;

  /**
   * Converts an absolute fsPath to a git-root-relative path with forward slashes,
   * suitable for passing to any git command (pathspec or index lookup).
   * Returns undefined if the path is outside the git root.
   */
  public readonly toRepoRelative = toRepoRelative;

  public readonly isRepo = isRepo;

  public readonly getCurrentBranch = getCurrentBranch;

  public readonly getCurrentHeadSha = getCurrentHeadSha;

  public readonly getLocalBranches = getLocalBranches;

  public readonly getRemoteBranches = getRemoteBranches;

  public readonly getBranches = getBranches;

  public readonly parseBranchLines = parseBranchLines;

  public readonly getRemoteFetchUrls = getRemoteFetchUrls;

  public readonly getTagsBasic = getTagsBasic;

  public readonly mergeTagAvailability = mergeTagAvailability;

  public readonly getTags = getTags;

  public readonly getTagAvailabilityByRemote = getTagAvailabilityByRemote;

  public readonly createBranch = createBranch;

  public readonly createTag = createTag;

  public readonly setRemoteUrl = setRemoteUrl;

  public readonly addRemote = addRemote;

  public readonly deleteRemote = deleteRemote;

  public readonly renameBranch = renameBranch;

  public readonly deleteBranch = deleteBranch;

  public readonly checkoutBranch = checkoutBranch;

  public readonly checkoutCommit = checkoutCommit;

  public readonly trackBranch = trackBranch;

  public readonly untrackBranch = untrackBranch;

  public readonly mergeIntoCurrent = mergeIntoCurrent;

  public readonly rebaseCurrentOnto = rebaseCurrentOnto;

  public readonly rebaseInteractive = rebaseInteractive;

  public readonly mergeAbort = mergeAbort;

  public readonly rebaseAbort = rebaseAbort;

  public readonly rebaseContinue = rebaseContinue;

  public readonly rebaseSkip = rebaseSkip;

  public readonly cherryPickAbort = cherryPickAbort;

  public readonly cherryPickContinue = cherryPickContinue;

  public readonly cherryPickSkip = cherryPickSkip;

  public readonly revertAbort = revertAbort;

  public readonly revertContinue = revertContinue;

  public readonly resolveConflictOurs = resolveConflictOurs;

  public readonly resolveConflictTheirs = resolveConflictTheirs;

  public readonly getOperationState = getOperationState;

  public _gitDirCache: string | undefined;

  public _submoduleService: SubmoduleService | undefined;

  public get submoduleSvc(): SubmoduleService {
    if (!this._submoduleService) {
      this._submoduleService = new SubmoduleService(
        this.config,
        this.gitRoot,
        this.runGit.bind(this)
      );
    }
    return this._submoduleService;
  }

  public readonly getVsCodeGitApi = getVsCodeGitApi;

  public readonly getVsCodeGitRoot = getVsCodeGitRoot;

  public readonly getVsCodeRepository = getVsCodeRepository;

  /**
   * Subscribe to VS Code Git API repository state changes with scope-aware
   * diffing. The listener is invoked only when the diff is non-empty — VS Code
   * fires {@code state.onDidChange} redundantly, and the redundant events
   * would otherwise spawn no-op refreshes.
   */
  public readonly onRepositoryStateChange = onRepositoryStateChange;

  /**
   * Fires {@code listener} immediately if our repository is already open, then
   * each time the VS Code Git API reports our repository being (re)opened.
   * Lets consumers attach state listeners and watchers even when {@code vscode.git}
   * activates after our extension.
   */
  public readonly onRepositoryAvailable = onRepositoryAvailable;

  /**
   * Fires {@code listener} when our repository is closed by VS Code (e.g.
   * workspace folder removed). Clears the cached repository handle so a
   * subsequent {@link onRepositoryAvailable} can re-attach.
   */
  public readonly onRepositoryClosed = onRepositoryClosed;

  public readonly toAbsoluteRepoPath = toAbsoluteRepoPath;

  public readonly uniqueChangePaths = uniqueChangePaths;

  public readonly getChangedFilesFromVsCodeGit = getChangedFilesFromVsCodeGit;

  public readonly samePath = samePath;

  public readonly getGitDir = getGitDir;

  public readonly cherryPick = cherryPick;

  public readonly cherryPickCommitFiles = cherryPickCommitFiles;

  public readonly cherryPickRange = cherryPickRange;

  public readonly getCommitTimestamps = getCommitTimestamps;

  public readonly revertCommit = revertCommit;

  public readonly revertCommitFiles = revertCommitFiles;

  public readonly resetCurrent = resetCurrent;

  public readonly isCommitInCurrentBranch = isCommitInCurrentBranch;

  public readonly getStashes = getStashes;

  public readonly createStash = createStash;

  public readonly applyStash = applyStash;

  public readonly dropStash = dropStash;

  public readonly renameStash = renameStash;

  public readonly getStashPatch = getStashPatch;

  public readonly getGraph = getGraph;

  public readonly resolveExactBranchRef = resolveExactBranchRef;

  public readonly refExists = refExists;

  public readonly refPatternExists = refPatternExists;

  public readonly resolveShaFilter = resolveShaFilter;

  public readonly getCommitDetails = getCommitDetails;

  public readonly getParentCommit = getParentCommit;

  public readonly getFilesAtRevision = getFilesAtRevision;

  public readonly getPatchForCommit = getPatchForCommit;

  public readonly getPatchForCommitRange = getPatchForCommitRange;

  public readonly getPatchForCommitFiles = getPatchForCommitFiles;

  public readonly getPatchBetweenRefsForFiles = getPatchBetweenRefsForFiles;

  public readonly getPatchBetweenWorkingTreeAndRefForFiles = getPatchBetweenWorkingTreeAndRefForFiles;

  public readonly canApplyPatchToWorkingTree = canApplyPatchToWorkingTree;

  public readonly isPatchAlreadyApplied = isPatchAlreadyApplied;

  public readonly applyPatchToWorkingTree = applyPatchToWorkingTree;

  public readonly reverseApplyPatchToWorkingTree = reverseApplyPatchToWorkingTree;

  public readonly getCompare = getCompare;

  public readonly tryGetMergeBaseCommit = tryGetMergeBaseCommit;

  public readonly getChangedFiles = getChangedFiles;

  public readonly stashFiles = stashFiles;

  public readonly unstashToWorkingTree = unstashToWorkingTree;

  public readonly getStagedFiles = getStagedFiles;

  public readonly getMergeConflicts = getMergeConflicts;

  public readonly getFileContentFromRef = getFileContentFromRef;

  public readonly isMissingFileContentError = isMissingFileContentError;

  public readonly getFilesInCommit = getFilesInCommit;

  public readonly getFilesInCommitWithStatus = getFilesInCommitWithStatus;

  public readonly getFilesChangedBetween = getFilesChangedBetween;

  public readonly getFilesChangedBetweenRefsWithStatus = getFilesChangedBetweenRefsWithStatus;

  /**
   * Returns all files that differ between the working tree and the given ref.
   * Includes tracked files (via `git diff --name-status -z <ref>`) plus
   * untracked files (via `git ls-files --others --exclude-standard -z`).
   * When `scopePath` is provided, results are restricted to that subtree.
   * Results are sorted by path for stable output.
   */
  public readonly getFilesChangedBetweenWorkingTreeAndRef = getFilesChangedBetweenWorkingTreeAndRef;

  /**
   * Resolves a revision expression (branch name, tag, short SHA, etc.) to
   * a commit and returns its metadata. Returns `undefined` when the ref is
   * invalid or git fails for any reason — this method never throws.
   */
  public readonly resolveRevisionToCommit = resolveRevisionToCommit;

  public readonly stageFile = stageFile;

  public readonly unstageFile = unstageFile;

  public readonly getOutgoingIncomingPreview = getOutgoingIncomingPreview;

  public readonly push = push;

  public readonly pull = pull;

  public readonly fetchPrune = fetchPrune;

  public readonly addAll = addAll;

  public readonly stagePatch = stagePatch;

  public readonly amendCommit = amendCommit;

  public readonly commit = commit;

  public readonly getHeadCommitMessage = getHeadCommitMessage;

  public readonly generateCommitMessage = generateCommitMessage;

  public readonly fileHistory = fileHistory;

  public readonly directoryHistory = directoryHistory;

  public readonly streamLogRecords = streamLogRecords;

  public readonly fileBlame = fileBlame;

  public readonly openMergeEditor = openMergeEditor;

  public readonly applyMergeEditorColumnLayout = applyMergeEditorColumnLayout;

  public readonly getFileStageContent = getFileStageContent;

  public readonly getWorktrees = getWorktrees;

  public readonly addWorktree = addWorktree;

  public readonly addWorktreeBranch = addWorktreeBranch;

  public readonly addDetachedWorktree = addDetachedWorktree;

  public readonly removeWorktree = removeWorktree;

  public readonly lockWorktree = lockWorktree;

  public readonly unlockWorktree = unlockWorktree;

  public readonly getPrunableWorktrees = getPrunableWorktrees;

  public readonly pruneWorktrees = pruneWorktrees;

  public readonly getWorktreeStatus = getWorktreeStatus;

  public readonly getSubmodules = getSubmodules;

  public readonly initSubmodule = initSubmodule;

  public readonly initAllSubmodules = initAllSubmodules;

  public readonly updateSubmodule = updateSubmodule;

  public readonly updateAllSubmodules = updateAllSubmodules;

  public readonly syncSubmodule = syncSubmodule;

  public readonly deinitSubmodule = deinitSubmodule;

  public readonly checkoutRecordedSubmoduleCommit = checkoutRecordedSubmoduleCommit;

  public readonly pullSubmoduleTrackedBranch = pullSubmoduleTrackedBranch;

  public readonly getSubmodulePointerDiff = getSubmodulePointerDiff;

  public readonly stageSubmodulePointer = stageSubmodulePointer;

  public readonly logGitDuration = logGitDuration;

  public readonly runGitAt = runGitAt;

  public readonly runGit = runGit;

  public readonly runGitAllowExitCodes = runGitAllowExitCodes;

  public readonly applyCommitFilesPatch = applyCommitFilesPatch;

  public readonly runGitWithStdin = runGitWithStdin;
}

function parseGraphRows(raw: string): GraphCommit[] {
  return raw
    .split(RECORD_SEPARATOR)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [graph, sha, shortSha, parentsRaw, refsRaw, author, date, subject] =
        line.split(FIELD_SEPARATOR);
      return {
        graph,
        sha,
        shortSha,
        parents: parentsRaw?.split(' ').filter(Boolean) ?? [],
        refs: refsRaw
          ? refsRaw
              .split(',')
              .map((r) => r.trim())
              .filter(Boolean)
          : [],
        author,
        date,
        subject
      };
    });
}

function parseShortStat(
  raw: string
): { files: number; insertions: number; deletions: number } | undefined {
  const line = raw
    .split('\n')
    .map((value) => value.trim())
    .find((value) => value.length > 0);

  if (!line) {
    return undefined;
  }

  const filesMatch = line.match(/(\d+)\s+files?\s+changed/);
  const insertionsMatch = line.match(/(\d+)\s+insertions?\(\+\)/);
  const deletionsMatch = line.match(/(\d+)\s+deletions?\(-\)/);

  return {
    files: Number(filesMatch?.[1] ?? 0),
    insertions: Number(insertionsMatch?.[1] ?? 0),
    deletions: Number(deletionsMatch?.[1] ?? 0)
  };
}
