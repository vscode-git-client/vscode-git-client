import * as vscode from 'vscode';
import { Logger } from '../../logger';
import { BranchRef, RepositoryContext, TagRef } from '../../types';
import { GitCommandQueue } from '../gitCommandQueue';
import { SubmoduleService } from '../submoduleService';

import { addAll } from './addAll';
import { addDetachedWorktree } from './addDetachedWorktree';
import { addRemote } from './addRemote';
import { addWorktree } from './addWorktree';
import { addWorktreeBranch } from './addWorktreeBranch';
import { amendCommit } from './amendCommit';
import { applyCommitFilesPatch } from './applyCommitFilesPatch';
import { applyMergeEditorColumnLayout } from './applyMergeEditorColumnLayout';
import { applyPatchToWorkingTree } from './applyPatchToWorkingTree';
import { applyStash } from './applyStash';
import { canApplyPatchToWorkingTree } from './canApplyPatchToWorkingTree';
import { checkoutBranch } from './checkoutBranch';
import { checkoutCommit } from './checkoutCommit';
import { checkoutRecordedSubmoduleCommit } from './checkoutRecordedSubmoduleCommit';
import { cherryPick } from './cherryPick';
import { cherryPickAbort } from './cherryPickAbort';
import { cherryPickCommitFiles } from './cherryPickCommitFiles';
import { cherryPickContinue } from './cherryPickContinue';
import { cherryPickRange } from './cherryPickRange';
import { cherryPickSkip } from './cherryPickSkip';
import { commit } from './commit';
import { createBranch } from './createBranch';
import { createStash } from './createStash';
import { createTag } from './createTag';
import { deinitSubmodule } from './deinitSubmodule';
import { deleteBranch } from './deleteBranch';
import { deleteRemote } from './deleteRemote';
import { directoryHistory } from './directoryHistory';
import { dropStash } from './dropStash';
import { fetchPrune } from './fetchPrune';
import { fileBlame } from './fileBlame';
import { fileHistory } from './fileHistory';
import { generateCommitMessage } from './generateCommitMessage';
import { getBranches } from './getBranches';
import { getChangedFiles } from './getChangedFiles';
import { getChangedFilesFromVsCodeGit } from './getChangedFilesFromVsCodeGit';
import { getCommitDetails } from './getCommitDetails';
import { getCommitTimestamps } from './getCommitTimestamps';
import { getCompare } from './getCompare';
import { getCurrentBranch } from './getCurrentBranch';
import { getCurrentHeadSha } from './getCurrentHeadSha';
import { getFileContentFromRef } from './getFileContentFromRef';
import { getFilesAtRevision } from './getFilesAtRevision';
import { getFilesChangedBetween } from './getFilesChangedBetween';
import { getFilesChangedBetweenRefsWithStatus } from './getFilesChangedBetweenRefsWithStatus';
import { getFilesChangedBetweenWorkingTreeAndRef } from './getFilesChangedBetweenWorkingTreeAndRef';
import { getFilesInCommit } from './getFilesInCommit';
import { getFilesInCommitWithStatus } from './getFilesInCommitWithStatus';
import { getFileStageContent } from './getFileStageContent';
import { getGitDir } from './getGitDir';
import { getGitRoot } from './getGitRoot';
import { getGraph } from './getGraph';
import { getHeadCommitMessage } from './getHeadCommitMessage';
import { getLocalBranches } from './getLocalBranches';
import { getMergeConflicts } from './getMergeConflicts';
import { getOperationState } from './getOperationState';
import { getOutgoingIncomingPreview } from './getOutgoingIncomingPreview';
import { getParentCommit } from './getParentCommit';
import { getPatchBetweenRefsForFiles } from './getPatchBetweenRefsForFiles';
import { getPatchBetweenWorkingTreeAndRefForFiles } from './getPatchBetweenWorkingTreeAndRefForFiles';
import { getPatchForCommit } from './getPatchForCommit';
import { getPatchForCommitFiles } from './getPatchForCommitFiles';
import { getPatchForCommitRange } from './getPatchForCommitRange';
import { getPrunableWorktrees } from './getPrunableWorktrees';
import { getRemoteBranches } from './getRemoteBranches';
import { getRemoteFetchUrls } from './getRemoteFetchUrls';
import { getStagedFiles } from './getStagedFiles';
import { getStashes } from './getStashes';
import { getStashPatch } from './getStashPatch';
import { getSubmodulePointerDiff } from './getSubmodulePointerDiff';
import { getSubmodules } from './getSubmodules';
import { getTagAvailabilityByRemote } from './getTagAvailabilityByRemote';
import { getTags } from './getTags';
import { getTagsBasic } from './getTagsBasic';
import { getVsCodeGitApi } from './getVsCodeGitApi';
import { getVsCodeGitRoot } from './getVsCodeGitRoot';
import { getVsCodeRepository } from './getVsCodeRepository';
import { getWorktrees } from './getWorktrees';
import { getWorktreeStatus } from './getWorktreeStatus';
import { initAllSubmodules } from './initAllSubmodules';
import { initSubmodule } from './initSubmodule';
import { isCommitInCurrentBranch } from './isCommitInCurrentBranch';
import { isMissingFileContentError } from './isMissingFileContentError';
import { isPatchAlreadyApplied } from './isPatchAlreadyApplied';
import { isRepo } from './isRepo';
import { lockWorktree } from './lockWorktree';
import { logGitDuration } from './logGitDuration';
import { mergeAbort } from './mergeAbort';
import { mergeIntoCurrent } from './mergeIntoCurrent';
import { mergeTagAvailability } from './mergeTagAvailability';
import { onRepositoryAvailable } from './onRepositoryAvailable';
import { onRepositoryClosed } from './onRepositoryClosed';
import { onRepositoryStateChange } from './onRepositoryStateChange';
import { openMergeEditor } from './openMergeEditor';
import { parseBranchLines } from './parseBranchLines';
import { pruneWorktrees } from './pruneWorktrees';
import { pull } from './pull';
import { pullSubmoduleTrackedBranch } from './pullSubmoduleTrackedBranch';
import { push } from './push';
import { rebaseAbort } from './rebaseAbort';
import { rebaseContinue } from './rebaseContinue';
import { rebaseCurrentOnto } from './rebaseCurrentOnto';
import { rebaseInteractive } from './rebaseInteractive';
import { rebaseSkip } from './rebaseSkip';
import { refExists } from './refExists';
import { refPatternExists } from './refPatternExists';
import { removeWorktree } from './removeWorktree';
import { renameBranch } from './renameBranch';
import { renameStash } from './renameStash';
import { resetCurrent } from './resetCurrent';
import { resolveConflictOurs } from './resolveConflictOurs';
import { resolveConflictTheirs } from './resolveConflictTheirs';
import { resolveExactBranchRef } from './resolveExactBranchRef';
import { resolveRevisionToCommit } from './resolveRevisionToCommit';
import { resolveShaFilter } from './resolveShaFilter';
import { reverseApplyPatchToWorkingTree } from './reverseApplyPatchToWorkingTree';
import { revertAbort } from './revertAbort';
import { revertCommit } from './revertCommit';
import { revertCommitFiles } from './revertCommitFiles';
import { revertContinue } from './revertContinue';
import { runGit } from './runGit';
import { runGitAllowExitCodes } from './runGitAllowExitCodes';
import { runGitAt } from './runGitAt';
import { runGitWithStdin } from './runGitWithStdin';
import { samePath } from './samePath';
import { setRemoteUrl } from './setRemoteUrl';
import { stageFile } from './stageFile';
import { stagePatch } from './stagePatch';
import { stageSubmodulePointer } from './stageSubmodulePointer';
import { stashFiles } from './stashFiles';
import { streamLogRecords } from './streamLogRecords';
import { syncSubmodule } from './syncSubmodule';
import { toAbsoluteRepoPath } from './toAbsoluteRepoPath';
import { toRepoRelative } from './toRepoRelative';
import { trackBranch } from './trackBranch';
import { tryGetMergeBaseCommit } from './tryGetMergeBaseCommit';
import { uniqueChangePaths } from './uniqueChangePaths';
import { unlockWorktree } from './unlockWorktree';
import { unstageFile } from './unstageFile';
import { unstashToWorkingTree } from './unstashToWorkingTree';
import { untrackBranch } from './untrackBranch';
import { updateAllSubmodules } from './updateAllSubmodules';
import { updateSubmodule } from './updateSubmodule';

export type { RepoChangeSet } from '../repositoryStateDiff';

const FIELD_SEPARATOR = '|~|';

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

  public readonly getPatchBetweenWorkingTreeAndRefForFiles =
    getPatchBetweenWorkingTreeAndRefForFiles;

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
