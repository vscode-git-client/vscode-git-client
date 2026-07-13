import { EditorOrchestrator } from '../../editor/editorOrchestrator';
import { Logger } from '../../logger';
import {
  CommitActionContext,
  CommitFileTreeItem,
  CommitSelectableFileTreeItem
} from '../../providers/commitFilesTreeProvider';
import { GitService } from '../../services/gitService';
import { StateStore } from '../../state/stateStore';
import { openBranchActionHub } from './openBranchActionHub';
import { openCompareWorkflow } from './openCompareWorkflow';
import { openQuickActions } from './openQuickActions';
import { register } from './register';

import { applyPatchToWorkingTree } from './applyPatchToWorkingTree';
import { asBranchItem } from './asBranchItem';
import { asBranchRemoteItem } from './asBranchRemoteItem';
import { asCommitRangeFileItem } from './asCommitRangeFileItem';
import { asCommitViewFileItem } from './asCommitViewFileItem';
import { asFileResourceUri } from './asFileResourceUri';
import { asGraphFileItem } from './asGraphFileItem';
import { asGraphItem } from './asGraphItem';
import { asRevisionViewFileItem } from './asRevisionViewFileItem';
import { asStashItem } from './asStashItem';
import { asTagItem } from './asTagItem';
import { asWorkingTreeCompareFileItem } from './asWorkingTreeCompareFileItem';
import { classifyCherryPickIssue } from './classifyCherryPickIssue';
import { classifyMergeIssue } from './classifyMergeIssue';
import { classifyRebaseIssue } from './classifyRebaseIssue';
import { extractSelectableItem } from './extractSelectableItem';
import { getActiveFilePath } from './getActiveFilePath';
import { getBuiltInGitRepository } from './getBuiltInGitRepository';
import { getErrorSummary } from './getErrorSummary';
import { handleApplyPatch } from './handleApplyPatch';
import { handleBranchActionHub } from './handleBranchActionHub';
import { handleBranchCheckout } from './handleBranchCheckout';
import { handleBranchCompareWithCurrent } from './handleBranchCompareWithCurrent';
import { handleBranchCreate } from './handleBranchCreate';
import { handleBranchDelete } from './handleBranchDelete';
import { handleBranchMergeIntoCurrent } from './handleBranchMergeIntoCurrent';
import { handleBranchOpenCommits } from './handleBranchOpenCommits';
import { handleBranchRebaseOnto } from './handleBranchRebaseOnto';
import { handleBranchRename } from './handleBranchRename';
import { handleBranchSearch } from './handleBranchSearch';
import { handleBranchSearchRefresh } from './handleBranchSearchRefresh';
import { handleBranchTrack } from './handleBranchTrack';
import { handleBranchUntrack } from './handleBranchUntrack';
import { handleCherryPick } from './handleCherryPick';
import { handleCherryPickSelectedChanges } from './handleCherryPickSelectedChanges';
import { handleCommitAmend } from './handleCommitAmend';
import { handleCommitTemplate } from './handleCommitTemplate';
import { handleCommitViewClose } from './handleCommitViewClose';
import { handleCompareOpen } from './handleCompareOpen';
import { handleCompareWithRevision } from './handleCompareWithRevision';
import { handleCompareWithRevisionSwapDirection } from './handleCompareWithRevisionSwapDirection';
import { handleConflictAcceptBoth } from './handleConflictAcceptBoth';
import { handleConflictAcceptOurs } from './handleConflictAcceptOurs';
import { handleConflictAcceptTheirs } from './handleConflictAcceptTheirs';
import { handleConflictResolve } from './handleConflictResolve';
import { handleCreatePatchSelectedChanges } from './handleCreatePatchSelectedChanges';
import { handleDiffOpen } from './handleDiffOpen';
import { handleDirectoryTimelineOpen } from './handleDirectoryTimelineOpen';
import { handleEditCommitMessage } from './handleEditCommitMessage';
import { handleFileBlameOpen } from './handleFileBlameOpen';
import { handleGenerateCommitMessage } from './handleGenerateCommitMessage';
import { handleGitFetchPrune } from './handleGitFetchPrune';
import { handleGitPullWithPreview } from './handleGitPullWithPreview';
import { handleGitPushWithPreview } from './handleGitPushWithPreview';
import { handleGitSshPullBitbucket } from './handleGitSshPullBitbucket';
import { handleGitSshPullCustom } from './handleGitSshPullCustom';
import { handleGitSshPullGithub } from './handleGitSshPullGithub';
import { handleGitSshPullGitlab } from './handleGitSshPullGitlab';
import { handleGraphCheckoutCommit } from './handleGraphCheckoutCommit';
import { handleGraphCherryPickRange } from './handleGraphCherryPickRange';
import { handleGraphClearFilter } from './handleGraphClearFilter';
import { handleGraphCompareWithCurrent } from './handleGraphCompareWithCurrent';
import { handleGraphCopyCommitId } from './handleGraphCopyCommitId';
import { handleGraphCopyCommitMessage } from './handleGraphCopyCommitMessage';
import { handleGraphCreateBranchHere } from './handleGraphCreateBranchHere';
import { handleGraphCreatePatch } from './handleGraphCreatePatch';
import { handleGraphCreatePatchForRange } from './handleGraphCreatePatchForRange';
import { handleGraphCreateTagHere } from './handleGraphCreateTagHere';
import { handleGraphFilter } from './handleGraphFilter';
import { handleGraphGoToChildCommit } from './handleGraphGoToChildCommit';
import { handleGraphGoToParentCommit } from './handleGraphGoToParentCommit';
import { handleGraphLoadMore } from './handleGraphLoadMore';
import { handleGraphOpenCommitRangeDetails } from './handleGraphOpenCommitRangeDetails';
import { handleGraphOpenDetails } from './handleGraphOpenDetails';
import { handleGraphOpenRepositoryFileAtRevision } from './handleGraphOpenRepositoryFileAtRevision';
import { handleGraphRebaseInteractiveFromHere } from './handleGraphRebaseInteractiveFromHere';
import { handleGraphRevert } from './handleGraphRevert';
import { handleGraphShowRepositoryAtRevision } from './handleGraphShowRepositoryAtRevision';
import { handleMergeFinalize } from './handleMergeFinalize';
import { handleMergeNext } from './handleMergeNext';
import { handleMergeOpenConflict } from './handleMergeOpenConflict';
import { handleMergePrevious } from './handleMergePrevious';
import { handleOpenFileDiff } from './handleOpenFileDiff';
import { handleOperationAbort } from './handleOperationAbort';
import { handleOperationConflict } from './handleOperationConflict';
import { handleOperationContinue } from './handleOperationContinue';
import { handleOperationSkip } from './handleOperationSkip';
import { handlePushAllUpToHere } from './handlePushAllUpToHere';
import { handleQuickActions } from './handleQuickActions';
import { handleRebaseConflict } from './handleRebaseConflict';
import { handleRefresh } from './handleRefresh';
import { handleRemoteAdd } from './handleRemoteAdd';
import { handleRemoteDelete } from './handleRemoteDelete';
import { handleRemoteFetch } from './handleRemoteFetch';
import { handleRemoteFetchAll } from './handleRemoteFetchAll';
import { handleResetCurrentToCommit } from './handleResetCurrentToCommit';
import { handleRevertSelectedChanges } from './handleRevertSelectedChanges';
import { handleScmAmendFromInput } from './handleScmAmendFromInput';
import { handleSetRemoteUrl } from './handleSetRemoteUrl';
import { handleShelveResource } from './handleShelveResource';
import { handleStageFile } from './handleStageFile';
import { handleStagePatch } from './handleStagePatch';
import { handleStashApply } from './handleStashApply';
import { handleStashApplyPop } from './handleStashApplyPop';
import { handleStashCreate } from './handleStashCreate';
import { handleStashDrop } from './handleStashDrop';
import { handleStashPop } from './handleStashPop';
import { handleStashPreviewPatch } from './handleStashPreviewPatch';
import { handleStashRename } from './handleStashRename';
import { handleStashUnshelve } from './handleStashUnshelve';
import { handleSubmoduleCheckoutRecorded } from './handleSubmoduleCheckoutRecorded';
import { handleSubmoduleDeinit } from './handleSubmoduleDeinit';
import { handleSubmoduleDiffPointer } from './handleSubmoduleDiffPointer';
import { handleSubmoduleInit } from './handleSubmoduleInit';
import { handleSubmoduleInitAll } from './handleSubmoduleInitAll';
import { handleSubmoduleOpen } from './handleSubmoduleOpen';
import { handleSubmoduleOpenInNewWindow } from './handleSubmoduleOpenInNewWindow';
import { handleSubmoduleOpenTerminal } from './handleSubmoduleOpenTerminal';
import { handleSubmodulePullTrackedBranch } from './handleSubmodulePullTrackedBranch';
import { handleSubmoduleRefresh } from './handleSubmoduleRefresh';
import { handleSubmoduleStagePointerChange } from './handleSubmoduleStagePointerChange';
import { handleSubmoduleSync } from './handleSubmoduleSync';
import { handleSubmoduleSyncAll } from './handleSubmoduleSyncAll';
import { handleSubmoduleUpdate } from './handleSubmoduleUpdate';
import { handleSubmoduleUpdateAll } from './handleSubmoduleUpdateAll';
import { handleSubmoduleUpdateRecursive } from './handleSubmoduleUpdateRecursive';
import { handleTagCheckout } from './handleTagCheckout';
import { handleTagCheckoutNewBranch } from './handleTagCheckoutNewBranch';
import { handleTagCompareWithCurrent } from './handleTagCompareWithCurrent';
import { handleTagCopyRevisionNumber } from './handleTagCopyRevisionNumber';
import { handleTagCreateCurrent } from './handleTagCreateCurrent';
import { handleTagCreatePatch } from './handleTagCreatePatch';
import { handleTagOpenCommits } from './handleTagOpenCommits';
import { handleTagShowRepositoryAtRevision } from './handleTagShowRepositoryAtRevision';
import { handleUnstageFile } from './handleUnstageFile';
import { handleWorkingTreeCompareOpenFileDiff } from './handleWorkingTreeCompareOpenFileDiff';
import { handleWorktreeAddDetached } from './handleWorktreeAddDetached';
import { handleWorktreeAddFromBranch } from './handleWorktreeAddFromBranch';
import { handleWorktreeAddNewBranch } from './handleWorktreeAddNewBranch';
import { handleWorktreeLock } from './handleWorktreeLock';
import { handleWorktreeOpen } from './handleWorktreeOpen';
import { handleWorktreeOpenInNewWindow } from './handleWorktreeOpenInNewWindow';
import { handleWorktreeOpenTerminal } from './handleWorktreeOpenTerminal';
import { handleWorktreePrune } from './handleWorktreePrune';
import { handleWorktreePrunePreview } from './handleWorktreePrunePreview';
import { handleWorktreeRefresh } from './handleWorktreeRefresh';
import { handleWorktreeRemove } from './handleWorktreeRemove';
import { handleWorktreeRemoveForce } from './handleWorktreeRemoveForce';
import { handleWorktreeRevealInFinder } from './handleWorktreeRevealInFinder';
import { handleWorktreeUnlock } from './handleWorktreeUnlock';
import { legacyCommandId } from './legacyCommandId';
import { normalizeBranchActionHubArg } from './normalizeBranchActionHubArg';
import { openBranchCommits } from './openBranchCommits';
import { openCommitActionContextDiffs } from './openCommitActionContextDiffs';
import { openCommitDetails } from './openCommitDetails';
import { openDiffWorkflow } from './openDiffWorkflow';
import { openDirectoryTimeline } from './openDirectoryTimeline';
import { openOperationConflictEditors } from './openOperationConflictEditors';
import { openRefCommits } from './openRefCommits';
import { openSelectedFileDiffs } from './openSelectedFileDiffs';
import { orderShasForCherryPick } from './orderShasForCherryPick';
import { pickBranchName } from './pickBranchName';
import { pickCommitSha } from './pickCommitSha';
import { pickConflictPath } from './pickConflictPath';
import { pickConflictPathArg } from './pickConflictPathArg';
import { pickFileFromWorkspace } from './pickFileFromWorkspace';
import { pickPatchOutputTarget } from './pickPatchOutputTarget';
import { pickPatchSource } from './pickPatchSource';
import { pickStashRef } from './pickStashRef';
import { pickWorktreeRevision } from './pickWorktreeRevision';
import { pickWorktreeTargetPath } from './pickWorktreeTargetPath';
import { readPatchFromFile } from './readPatchFromFile';
import { resolveBranchNameForActionHub } from './resolveBranchNameForActionHub';
import { resolveCommitSubject } from './resolveCommitSubject';
import { resolveSelectedCommitFiles } from './resolveSelectedCommitFiles';
import { showRebaseProgressFeedback } from './showRebaseProgressFeedback';
import { sshPull } from './sshPull';
import { startMergeOperation } from './startMergeOperation';
import { startRebaseOperation } from './startRebaseOperation';
import { toBranchName } from './toBranchName';
import { toCommitSha } from './toCommitSha';
import { toCommitSubject } from './toCommitSubject';
import { toExplorerResourceUris } from './toExplorerResourceUris';
import { toGraphCommitShas } from './toGraphCommitShas';
import { toRepoFilePath } from './toRepoFilePath';
import { toSelectedChangeTarget } from './toSelectedChangeTarget';
import { toSelectedItems } from './toSelectedItems';
import { toTagRef } from './toTagRef';
import { toTagRevision } from './toTagRevision';

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

  public readonly handleRemoteFetch = handleRemoteFetch;

  public readonly handleRemoteFetchAll = handleRemoteFetchAll;

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
