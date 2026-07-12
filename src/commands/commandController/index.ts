import * as path from 'path';
import * as vscode from 'vscode';
import { GIT_COMMAND_PREFIX, GitCommand } from '../../config/commands';
import { getConfigValue } from '../../configuration';
import { EditorOrchestrator } from '../../editor/editorOrchestrator';
import { confirmDangerousAction } from '../../guards';
import { Logger } from '../../logger';
import { BranchRemoteNode, BranchTreeItem, TagTreeItem } from '../../providers/branchTreeProvider';
import {
  CommitActionContext,
  CommitFileTreeItem,
  CommitFolderTreeItem,
  CommitRangeFileTreeItem,
  CommitSelectableFileTreeItem,
  RevisionFileTreeItem,
  WorkingTreeCompareFileTreeItem
} from '../../providers/commitFilesTreeProvider';
import { GraphCommitFileTreeItem, GraphCommitTreeItem } from '../../providers/graphTreeProvider';
import { StashTreeItem } from '../../providers/stashTreeProvider';
import { SubmoduleTreeItem } from '../../providers/submoduleTreeProvider';
import { WorktreeTreeItem } from '../../providers/worktreeTreeProvider';
import { convertToSshUrl } from '../../services/gitParsing';
import { GitService } from '../../services/gitService';
import { resolveWorktreeTargetPath } from '../../services/worktreeTargetPath';
import { expandTemplate, loadTemplates } from '../../state/commitTemplates';
import { StateStore } from '../../state/stateStore';
import { BranchSearchView } from '../../views/branchSearchView';
import { CommitListView } from '../../views/commitListView';
import { GraphFilterSession } from '../../views/graphFilterSession';
import { GraphFilterView } from '../../views/graphFilterView';
import { pickRevisionToCompare, RevisionSelection } from '../../views/revisionPicker';
import { withSubmoduleProgress } from '../helpers/with-submodule-progress';
import {
  CherryPickIssueKind,
  GitScmExtensionExports,
  GitScmRepository,
  MergeIssueKind,
  RebaseIssueKind,
  SelectableChangeTreeItem,
  SelectedChangeTarget
} from '../types';
import { openBranchActionHub } from './openBranchActionHub';
import { openCompareWorkflow } from './openCompareWorkflow';
import { openQuickActions } from './openQuickActions';
import { register } from './register';

import { openBranchCommits } from './openBranchCommits';
import { openRefCommits } from './openRefCommits';
import { openDirectoryTimeline } from './openDirectoryTimeline';
import { sshPull } from './sshPull';
import { openDiffWorkflow } from './openDiffWorkflow';
import { pickConflictPathArg } from './pickConflictPathArg';
import { pickConflictPath } from './pickConflictPath';
import { normalizeBranchActionHubArg } from './normalizeBranchActionHubArg';
import { resolveBranchNameForActionHub } from './resolveBranchNameForActionHub';
import { pickBranchName } from './pickBranchName';
import { pickWorktreeRevision } from './pickWorktreeRevision';
import { pickWorktreeTargetPath } from './pickWorktreeTargetPath';
import { pickStashRef } from './pickStashRef';
import { pickCommitSha } from './pickCommitSha';
import { pickFileFromWorkspace } from './pickFileFromWorkspace';
import { getBuiltInGitRepository } from './getBuiltInGitRepository';
import { getActiveFilePath } from './getActiveFilePath';
import { openCommitDetails } from './openCommitDetails';
import { openSelectedFileDiffs } from './openSelectedFileDiffs';
import { openCommitActionContextDiffs } from './openCommitActionContextDiffs';
import { pickPatchOutputTarget } from './pickPatchOutputTarget';
import { pickPatchSource } from './pickPatchSource';
import { readPatchFromFile } from './readPatchFromFile';
import { applyPatchToWorkingTree } from './applyPatchToWorkingTree';
import { resolveSelectedCommitFiles } from './resolveSelectedCommitFiles';
import { toSelectedChangeTarget } from './toSelectedChangeTarget';
import { toSelectedItems } from './toSelectedItems';
import { extractSelectableItem } from './extractSelectableItem';
import { classifyCherryPickIssue } from './classifyCherryPickIssue';
import { classifyMergeIssue } from './classifyMergeIssue';
import { classifyRebaseIssue } from './classifyRebaseIssue';
import { getErrorSummary } from './getErrorSummary';
import { startMergeOperation } from './startMergeOperation';
import { startRebaseOperation } from './startRebaseOperation';
import { handleRebaseConflict } from './handleRebaseConflict';
import { handleOperationConflict } from './handleOperationConflict';
import { showRebaseProgressFeedback } from './showRebaseProgressFeedback';
import { openOperationConflictEditors } from './openOperationConflictEditors';
import { asBranchItem } from './asBranchItem';
import { asBranchRemoteItem } from './asBranchRemoteItem';
import { asTagItem } from './asTagItem';
import { asStashItem } from './asStashItem';
import { asGraphItem } from './asGraphItem';
import { asGraphFileItem } from './asGraphFileItem';
import { asCommitViewFileItem } from './asCommitViewFileItem';
import { asRevisionViewFileItem } from './asRevisionViewFileItem';
import { legacyCommandId } from './legacyCommandId';
import { asCommitRangeFileItem } from './asCommitRangeFileItem';
import { asWorkingTreeCompareFileItem } from './asWorkingTreeCompareFileItem';
import { asFileResourceUri } from './asFileResourceUri';
import { toExplorerResourceUris } from './toExplorerResourceUris';
import { toBranchName } from './toBranchName';
import { toRepoFilePath } from './toRepoFilePath';
import { toCommitSha } from './toCommitSha';
import { toCommitSubject } from './toCommitSubject';
import { resolveCommitSubject } from './resolveCommitSubject';
import { toGraphCommitShas } from './toGraphCommitShas';
import { toTagRef } from './toTagRef';
import { toTagRevision } from './toTagRevision';
import { orderShasForCherryPick } from './orderShasForCherryPick';
import { handleCherryPick } from './handleCherryPick';
import { handleOpenFileDiff } from './handleOpenFileDiff';
import { handleCherryPickSelectedChanges } from './handleCherryPickSelectedChanges';
import { handleCreatePatchSelectedChanges } from './handleCreatePatchSelectedChanges';
import { handleRevertSelectedChanges } from './handleRevertSelectedChanges';
import { handleApplyPatch } from './handleApplyPatch';
import { handleEditCommitMessage } from './handleEditCommitMessage';
import { handlePushAllUpToHere } from './handlePushAllUpToHere';
import { handleOperationAbort } from './handleOperationAbort';
import { handleOperationContinue } from './handleOperationContinue';
import { handleShelveResource } from './handleShelveResource';
import { handleCommitTemplate } from './handleCommitTemplate';
import { handleGenerateCommitMessage } from './handleGenerateCommitMessage';
import { handleScmAmendFromInput } from './handleScmAmendFromInput';
import { handleDirectoryTimelineOpen } from './handleDirectoryTimelineOpen';
import { handleCompareWithRevision } from './handleCompareWithRevision';
import { handleResetCurrentToCommit } from './handleResetCurrentToCommit';
import { handleStashCreate } from './handleStashCreate';
import { handleBranchSearch } from './handleBranchSearch';
import { handleGraphFilter } from './handleGraphFilter';
import { handleSetRemoteUrl } from './handleSetRemoteUrl';
import { handleConflictResolve } from './handleConflictResolve';
import { handleStashApplyPop } from './handleStashApplyPop';
import { handleSubmoduleDeinit } from './handleSubmoduleDeinit';
import { handleSubmoduleStagePointerChange } from './handleSubmoduleStagePointerChange';
import { handleSubmoduleDiffPointer } from './handleSubmoduleDiffPointer';
import { handleSubmodulePullTrackedBranch } from './handleSubmodulePullTrackedBranch';
import { handleSubmoduleCheckoutRecorded } from './handleSubmoduleCheckoutRecorded';
import { handleSubmoduleOpenTerminal } from './handleSubmoduleOpenTerminal';
import { handleSubmoduleOpenInNewWindow } from './handleSubmoduleOpenInNewWindow';
import { handleSubmoduleOpen } from './handleSubmoduleOpen';
import { handleSubmoduleSyncAll } from './handleSubmoduleSyncAll';
import { handleSubmoduleSync } from './handleSubmoduleSync';
import { handleSubmoduleUpdateRecursive } from './handleSubmoduleUpdateRecursive';
import { handleSubmoduleUpdateAll } from './handleSubmoduleUpdateAll';
import { handleSubmoduleUpdate } from './handleSubmoduleUpdate';
import { handleSubmoduleInitAll } from './handleSubmoduleInitAll';
import { handleSubmoduleInit } from './handleSubmoduleInit';
import { handleSubmoduleRefresh } from './handleSubmoduleRefresh';
import { handleWorktreeOpenTerminal } from './handleWorktreeOpenTerminal';
import { handleWorktreeRevealInFinder } from './handleWorktreeRevealInFinder';
import { handleWorktreePrune } from './handleWorktreePrune';
import { handleWorktreePrunePreview } from './handleWorktreePrunePreview';
import { handleWorktreeUnlock } from './handleWorktreeUnlock';
import { handleWorktreeLock } from './handleWorktreeLock';
import { handleWorktreeRemoveForce } from './handleWorktreeRemoveForce';
import { handleWorktreeRemove } from './handleWorktreeRemove';
import { handleWorktreeAddDetached } from './handleWorktreeAddDetached';
import { handleWorktreeAddNewBranch } from './handleWorktreeAddNewBranch';
import { handleWorktreeAddFromBranch } from './handleWorktreeAddFromBranch';
import { handleWorktreeOpenInNewWindow } from './handleWorktreeOpenInNewWindow';
import { handleWorktreeOpen } from './handleWorktreeOpen';
import { handleWorktreeRefresh } from './handleWorktreeRefresh';
import { handleFileBlameOpen } from './handleFileBlameOpen';
import { handleCommitAmend } from './handleCommitAmend';
import { handleUnstageFile } from './handleUnstageFile';
import { handleStageFile } from './handleStageFile';
import { handleStagePatch } from './handleStagePatch';
import { handleGitSshPullCustom } from './handleGitSshPullCustom';
import { handleGitSshPullBitbucket } from './handleGitSshPullBitbucket';
import { handleGitSshPullGitlab } from './handleGitSshPullGitlab';
import { handleGitSshPullGithub } from './handleGitSshPullGithub';
import { handleGitFetchPrune } from './handleGitFetchPrune';
import { handleGitPullWithPreview } from './handleGitPullWithPreview';
import { handleGitPushWithPreview } from './handleGitPushWithPreview';
import { handleOperationSkip } from './handleOperationSkip';
import { handleConflictAcceptBoth } from './handleConflictAcceptBoth';
import { handleConflictAcceptTheirs } from './handleConflictAcceptTheirs';
import { handleConflictAcceptOurs } from './handleConflictAcceptOurs';
import { handleMergeFinalize } from './handleMergeFinalize';
import { handleMergePrevious } from './handleMergePrevious';
import { handleMergeNext } from './handleMergeNext';
import { handleMergeOpenConflict } from './handleMergeOpenConflict';
import { handleCompareOpen } from './handleCompareOpen';
import { handleDiffOpen } from './handleDiffOpen';
import { handleGraphLoadMore } from './handleGraphLoadMore';
import { handleGraphClearFilter } from './handleGraphClearFilter';
import { handleGraphShowRepositoryAtRevision } from './handleGraphShowRepositoryAtRevision';
import { handleGraphCreatePatchForRange } from './handleGraphCreatePatchForRange';
import { handleGraphCreatePatch } from './handleGraphCreatePatch';
import { handleGraphGoToChildCommit } from './handleGraphGoToChildCommit';
import { handleGraphGoToParentCommit } from './handleGraphGoToParentCommit';
import { handleGraphRebaseInteractiveFromHere } from './handleGraphRebaseInteractiveFromHere';
import { handleGraphCompareWithCurrent } from './handleGraphCompareWithCurrent';
import { handleGraphRevert } from './handleGraphRevert';
import { handleGraphCherryPickRange } from './handleGraphCherryPickRange';
import { handleGraphCreateTagHere } from './handleGraphCreateTagHere';
import { handleGraphCreateBranchHere } from './handleGraphCreateBranchHere';
import { handleGraphCheckoutCommit } from './handleGraphCheckoutCommit';
import { handleGraphOpenRepositoryFileAtRevision } from './handleGraphOpenRepositoryFileAtRevision';
import { handleCompareWithRevisionSwapDirection } from './handleCompareWithRevisionSwapDirection';
import { handleWorkingTreeCompareOpenFileDiff } from './handleWorkingTreeCompareOpenFileDiff';
import { handleGraphCopyCommitMessage } from './handleGraphCopyCommitMessage';
import { handleGraphCopyCommitId } from './handleGraphCopyCommitId';
import { handleGraphOpenCommitRangeDetails } from './handleGraphOpenCommitRangeDetails';
import { handleGraphOpenDetails } from './handleGraphOpenDetails';
import { handleStashPreviewPatch } from './handleStashPreviewPatch';
import { handleStashRename } from './handleStashRename';
import { handleStashDrop } from './handleStashDrop';
import { handleStashPop } from './handleStashPop';
import { handleStashApply } from './handleStashApply';
import { handleStashUnshelve } from './handleStashUnshelve';
import { handleBranchCompareWithCurrent } from './handleBranchCompareWithCurrent';
import { handleBranchRebaseOnto } from './handleBranchRebaseOnto';
import { handleBranchMergeIntoCurrent } from './handleBranchMergeIntoCurrent';
import { handleBranchUntrack } from './handleBranchUntrack';
import { handleBranchTrack } from './handleBranchTrack';
import { handleBranchDelete } from './handleBranchDelete';
import { handleBranchRename } from './handleBranchRename';
import { handleRemoteDelete } from './handleRemoteDelete';
import { handleRemoteAdd } from './handleRemoteAdd';
import { handleTagCreateCurrent } from './handleTagCreateCurrent';
import { handleTagCreatePatch } from './handleTagCreatePatch';
import { handleTagCompareWithCurrent } from './handleTagCompareWithCurrent';
import { handleTagShowRepositoryAtRevision } from './handleTagShowRepositoryAtRevision';
import { handleTagCopyRevisionNumber } from './handleTagCopyRevisionNumber';
import { handleTagCheckout } from './handleTagCheckout';
import { handleTagCheckoutNewBranch } from './handleTagCheckoutNewBranch';
import { handleBranchCreate } from './handleBranchCreate';
import { handleTagOpenCommits } from './handleTagOpenCommits';
import { handleBranchCheckout } from './handleBranchCheckout';
import { handleBranchSearchRefresh } from './handleBranchSearchRefresh';
import { handleBranchOpenCommits } from './handleBranchOpenCommits';
import { handleBranchActionHub } from './handleBranchActionHub';
import { handleQuickActions } from './handleQuickActions';
import { handleCommitViewClose } from './handleCommitViewClose';
import { handleRefresh } from './handleRefresh';

export class CommandController {
  constructor(
    public readonly git: GitService,
    public readonly state: StateStore,
    public readonly editor: EditorOrchestrator,
    public readonly logger: Logger,
    public readonly commitFilesView: {
      getCommitActionContext(
        selectedItems: readonly CommitSelectableFileTreeItem[]
      ): CommitActionContext | undefined;
      getAllFileItems(): CommitFileTreeItem[];
      showCommit(sha: string, subject: string): Promise<void>;
      clear(): Promise<void>;
      isShowingCommit(sha: string): boolean;
    }
  ) {}

  public readonly register = register;

  public readonly openBranchCommits = openBranchCommits;

  public readonly openRefCommits = openRefCommits;

  public readonly openDirectoryTimeline = openDirectoryTimeline;

  public readonly sshPull = sshPull;

  public readonly openQuickActions = openQuickActions;

  public readonly openBranchActionHub = openBranchActionHub;

  public readonly openDiffWorkflow = openDiffWorkflow;

  public readonly openCompareWorkflow = openCompareWorkflow;

  public readonly pickConflictPathArg = pickConflictPathArg;

  public readonly pickConflictPath = pickConflictPath;

  public readonly normalizeBranchActionHubArg = normalizeBranchActionHubArg;

  public readonly resolveBranchNameForActionHub = resolveBranchNameForActionHub;

  public readonly pickBranchName = pickBranchName;

  public readonly pickWorktreeRevision = pickWorktreeRevision;

  public readonly pickWorktreeTargetPath = pickWorktreeTargetPath;

  public readonly pickStashRef = pickStashRef;

  public readonly pickCommitSha = pickCommitSha;

  public readonly pickFileFromWorkspace = pickFileFromWorkspace;

  public readonly getBuiltInGitRepository = getBuiltInGitRepository;

  public readonly getActiveFilePath = getActiveFilePath;

  public readonly openCommitDetails = openCommitDetails;

  public readonly openSelectedFileDiffs = openSelectedFileDiffs;

  public readonly openCommitActionContextDiffs = openCommitActionContextDiffs;

  public readonly pickPatchOutputTarget = pickPatchOutputTarget;

  public readonly pickPatchSource = pickPatchSource;

  public readonly readPatchFromFile = readPatchFromFile;

  public readonly applyPatchToWorkingTree = applyPatchToWorkingTree;

  public readonly resolveSelectedCommitFiles = resolveSelectedCommitFiles;

  public readonly toSelectedChangeTarget = toSelectedChangeTarget;

  public readonly toSelectedItems = toSelectedItems;

  public readonly extractSelectableItem = extractSelectableItem;

  public readonly classifyCherryPickIssue = classifyCherryPickIssue;

  public readonly classifyMergeIssue = classifyMergeIssue;

  public readonly classifyRebaseIssue = classifyRebaseIssue;

  public readonly getErrorSummary = getErrorSummary;

  public readonly startMergeOperation = startMergeOperation;

  public readonly startRebaseOperation = startRebaseOperation;

  public readonly handleRebaseConflict = handleRebaseConflict;

  public readonly handleOperationConflict = handleOperationConflict;

  public readonly showRebaseProgressFeedback = showRebaseProgressFeedback;

  public readonly openOperationConflictEditors = openOperationConflictEditors;

  // ── Promoted type guard methods (Phase 1) ──────────────────────────────

  public readonly asBranchItem = asBranchItem;

  public readonly asBranchRemoteItem = asBranchRemoteItem;

  public readonly asTagItem = asTagItem;

  public readonly asStashItem = asStashItem;

  public readonly asGraphItem = asGraphItem;

  public readonly asGraphFileItem = asGraphFileItem;

  public readonly asCommitViewFileItem = asCommitViewFileItem;

  public readonly asRevisionViewFileItem = asRevisionViewFileItem;

  public readonly legacyCommandId = legacyCommandId;

  public readonly asCommitRangeFileItem = asCommitRangeFileItem;

  public readonly asWorkingTreeCompareFileItem = asWorkingTreeCompareFileItem;

  public readonly asFileResourceUri = asFileResourceUri;

  public readonly toExplorerResourceUris = toExplorerResourceUris;

  public readonly toBranchName = toBranchName;

  public readonly toRepoFilePath = toRepoFilePath;

  public readonly toCommitSha = toCommitSha;

  public readonly toCommitSubject = toCommitSubject;

  public readonly resolveCommitSubject = resolveCommitSubject;

  public readonly toGraphCommitShas = toGraphCommitShas;

  public readonly toTagRef = toTagRef;

  public readonly toTagRevision = toTagRevision;

  // ── Command handler methods (Phase 2) ─────────────────────────────────

  public readonly orderShasForCherryPick = orderShasForCherryPick;

  public readonly handleCherryPick = handleCherryPick;

  public readonly handleOpenFileDiff = handleOpenFileDiff;

  public readonly handleCherryPickSelectedChanges = handleCherryPickSelectedChanges;

  public readonly handleCreatePatchSelectedChanges = handleCreatePatchSelectedChanges;

  public readonly handleRevertSelectedChanges = handleRevertSelectedChanges;

  public readonly handleApplyPatch = handleApplyPatch;

  public readonly handleEditCommitMessage = handleEditCommitMessage;

  public readonly handlePushAllUpToHere = handlePushAllUpToHere;

  public readonly handleOperationAbort = handleOperationAbort;

  public readonly handleOperationContinue = handleOperationContinue;

  public readonly handleShelveResource = handleShelveResource;

  public readonly handleCommitTemplate = handleCommitTemplate;

  public readonly handleGenerateCommitMessage = handleGenerateCommitMessage;

  public readonly handleScmAmendFromInput = handleScmAmendFromInput;

  public readonly handleDirectoryTimelineOpen = handleDirectoryTimelineOpen;

  public readonly handleCompareWithRevision = handleCompareWithRevision;

  public readonly handleResetCurrentToCommit = handleResetCurrentToCommit;

  public readonly handleStashCreate = handleStashCreate;

  public readonly handleBranchSearch = handleBranchSearch;

  public readonly handleGraphFilter = handleGraphFilter;

  public readonly handleSetRemoteUrl = handleSetRemoteUrl;

  public readonly handleConflictResolve = handleConflictResolve;

  public readonly handleStashApplyPop = handleStashApplyPop;

  // ── Extracted command handler methods (Phase 3) ────────────────

  public readonly handleSubmoduleDeinit = handleSubmoduleDeinit;
  public readonly handleSubmoduleStagePointerChange = handleSubmoduleStagePointerChange;
  public readonly handleSubmoduleDiffPointer = handleSubmoduleDiffPointer;
  public readonly handleSubmodulePullTrackedBranch = handleSubmodulePullTrackedBranch;
  public readonly handleSubmoduleCheckoutRecorded = handleSubmoduleCheckoutRecorded;
  public readonly handleSubmoduleOpenTerminal = handleSubmoduleOpenTerminal;
  public readonly handleSubmoduleOpenInNewWindow = handleSubmoduleOpenInNewWindow;
  public readonly handleSubmoduleOpen = handleSubmoduleOpen;
  public readonly handleSubmoduleSyncAll = handleSubmoduleSyncAll;
  public readonly handleSubmoduleSync = handleSubmoduleSync;
  public readonly handleSubmoduleUpdateRecursive = handleSubmoduleUpdateRecursive;
  public readonly handleSubmoduleUpdateAll = handleSubmoduleUpdateAll;
  public readonly handleSubmoduleUpdate = handleSubmoduleUpdate;
  public readonly handleSubmoduleInitAll = handleSubmoduleInitAll;
  public readonly handleSubmoduleInit = handleSubmoduleInit;
  public readonly handleSubmoduleRefresh = handleSubmoduleRefresh;
  public readonly handleWorktreeOpenTerminal = handleWorktreeOpenTerminal;
  public readonly handleWorktreeRevealInFinder = handleWorktreeRevealInFinder;
  public readonly handleWorktreePrune = handleWorktreePrune;
  public readonly handleWorktreePrunePreview = handleWorktreePrunePreview;
  public readonly handleWorktreeUnlock = handleWorktreeUnlock;
  public readonly handleWorktreeLock = handleWorktreeLock;
  public readonly handleWorktreeRemoveForce = handleWorktreeRemoveForce;
  public readonly handleWorktreeRemove = handleWorktreeRemove;
  public readonly handleWorktreeAddDetached = handleWorktreeAddDetached;
  public readonly handleWorktreeAddNewBranch = handleWorktreeAddNewBranch;
  public readonly handleWorktreeAddFromBranch = handleWorktreeAddFromBranch;
  public readonly handleWorktreeOpenInNewWindow = handleWorktreeOpenInNewWindow;
  public readonly handleWorktreeOpen = handleWorktreeOpen;
  public readonly handleWorktreeRefresh = handleWorktreeRefresh;
  public readonly handleFileBlameOpen = handleFileBlameOpen;
  public readonly handleCommitAmend = handleCommitAmend;
  public readonly handleUnstageFile = handleUnstageFile;
  public readonly handleStageFile = handleStageFile;
  public readonly handleStagePatch = handleStagePatch;
  public readonly handleGitSshPullCustom = handleGitSshPullCustom;
  public readonly handleGitSshPullBitbucket = handleGitSshPullBitbucket;
  public readonly handleGitSshPullGitlab = handleGitSshPullGitlab;
  public readonly handleGitSshPullGithub = handleGitSshPullGithub;
  public readonly handleGitFetchPrune = handleGitFetchPrune;
  public readonly handleGitPullWithPreview = handleGitPullWithPreview;
  public readonly handleGitPushWithPreview = handleGitPushWithPreview;
  public readonly handleOperationSkip = handleOperationSkip;
  public readonly handleConflictAcceptBoth = handleConflictAcceptBoth;
  public readonly handleConflictAcceptTheirs = handleConflictAcceptTheirs;
  public readonly handleConflictAcceptOurs = handleConflictAcceptOurs;
  public readonly handleMergeFinalize = handleMergeFinalize;
  public readonly handleMergePrevious = handleMergePrevious;
  public readonly handleMergeNext = handleMergeNext;
  public readonly handleMergeOpenConflict = handleMergeOpenConflict;
  public readonly handleCompareOpen = handleCompareOpen;
  public readonly handleDiffOpen = handleDiffOpen;
  public readonly handleGraphLoadMore = handleGraphLoadMore;
  public readonly handleGraphClearFilter = handleGraphClearFilter;
  public readonly handleGraphShowRepositoryAtRevision = handleGraphShowRepositoryAtRevision;
  public readonly handleGraphCreatePatchForRange = handleGraphCreatePatchForRange;
  public readonly handleGraphCreatePatch = handleGraphCreatePatch;
  public readonly handleGraphGoToChildCommit = handleGraphGoToChildCommit;
  public readonly handleGraphGoToParentCommit = handleGraphGoToParentCommit;
  public readonly handleGraphRebaseInteractiveFromHere = handleGraphRebaseInteractiveFromHere;
  public readonly handleGraphCompareWithCurrent = handleGraphCompareWithCurrent;
  public readonly handleGraphRevert = handleGraphRevert;
  public readonly handleGraphCherryPickRange = handleGraphCherryPickRange;
  public readonly handleGraphCreateTagHere = handleGraphCreateTagHere;
  public readonly handleGraphCreateBranchHere = handleGraphCreateBranchHere;
  public readonly handleGraphCheckoutCommit = handleGraphCheckoutCommit;
  public readonly handleGraphOpenRepositoryFileAtRevision = handleGraphOpenRepositoryFileAtRevision;
  public readonly handleCompareWithRevisionSwapDirection = handleCompareWithRevisionSwapDirection;
  public readonly handleWorkingTreeCompareOpenFileDiff = handleWorkingTreeCompareOpenFileDiff;
  public readonly handleGraphCopyCommitMessage = handleGraphCopyCommitMessage;
  public readonly handleGraphCopyCommitId = handleGraphCopyCommitId;
  public readonly handleGraphOpenCommitRangeDetails = handleGraphOpenCommitRangeDetails;
  public readonly handleGraphOpenDetails = handleGraphOpenDetails;
  public readonly handleStashPreviewPatch = handleStashPreviewPatch;
  public readonly handleStashRename = handleStashRename;
  public readonly handleStashDrop = handleStashDrop;
  public readonly handleStashPop = handleStashPop;
  public readonly handleStashApply = handleStashApply;
  public readonly handleStashUnshelve = handleStashUnshelve;
  public readonly handleBranchCompareWithCurrent = handleBranchCompareWithCurrent;
  public readonly handleBranchRebaseOnto = handleBranchRebaseOnto;
  public readonly handleBranchMergeIntoCurrent = handleBranchMergeIntoCurrent;
  public readonly handleBranchUntrack = handleBranchUntrack;
  public readonly handleBranchTrack = handleBranchTrack;
  public readonly handleBranchDelete = handleBranchDelete;
  public readonly handleBranchRename = handleBranchRename;
  public readonly handleRemoteDelete = handleRemoteDelete;
  public readonly handleRemoteAdd = handleRemoteAdd;
  public readonly handleTagCreateCurrent = handleTagCreateCurrent;
  public readonly handleTagCreatePatch = handleTagCreatePatch;
  public readonly handleTagCompareWithCurrent = handleTagCompareWithCurrent;
  public readonly handleTagShowRepositoryAtRevision = handleTagShowRepositoryAtRevision;
  public readonly handleTagCopyRevisionNumber = handleTagCopyRevisionNumber;
  public readonly handleTagCheckout = handleTagCheckout;
  public readonly handleTagCheckoutNewBranch = handleTagCheckoutNewBranch;
  public readonly handleBranchCreate = handleBranchCreate;
  public readonly handleTagOpenCommits = handleTagOpenCommits;
  public readonly handleBranchCheckout = handleBranchCheckout;
  public readonly handleBranchSearchRefresh = handleBranchSearchRefresh;
  public readonly handleBranchOpenCommits = handleBranchOpenCommits;
  public readonly handleBranchActionHub = handleBranchActionHub;
  public readonly handleQuickActions = handleQuickActions;
  public readonly handleCommitViewClose = handleCommitViewClose;
  public readonly handleRefresh = handleRefresh;
}
