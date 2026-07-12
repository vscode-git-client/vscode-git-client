import * as vscode from 'vscode';
import { type CommandController } from './index';
import { GitCommand } from '../../config/commands';

export function register(this: CommandController, context: vscode.ExtensionContext): void {
  const register = (command: string, callback: (...args: unknown[]) => Promise<void>): void => {
    const run = async (...args: unknown[]): Promise<void> => {
      try {
        await callback(...args);
      } catch (error) {
        this.logger.error(`Command failed: ${command}`, error);
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`VS Code Git Client: ${message}`);
      }
    };
    const legacy = this.legacyCommandId(command);
    context.subscriptions.push(
      vscode.commands.registerCommand(command, run),
      ...(legacy ? [vscode.commands.registerCommand(legacy, run)] : [])
    );
  };

  register(GitCommand.Refresh, this.handleRefresh.bind(this));

  register(GitCommand.CommitViewClose, this.handleCommitViewClose.bind(this));

  register(GitCommand.QuickActions, this.handleQuickActions.bind(this));

  register(GitCommand.BranchActionHub, this.handleBranchActionHub.bind(this));

  register(GitCommand.BranchOpenCommits, this.handleBranchOpenCommits.bind(this));

  register(GitCommand.BranchSearch, this.handleBranchSearch.bind(this));

  register(GitCommand.BranchSearchRefresh, this.handleBranchSearchRefresh.bind(this));

  register(GitCommand.BranchCheckout, this.handleBranchCheckout.bind(this));

  register(GitCommand.TagOpenCommits, this.handleTagOpenCommits.bind(this));

  register(GitCommand.BranchCreate, this.handleBranchCreate.bind(this));

  register(GitCommand.TagCheckoutNewBranch, this.handleTagCheckoutNewBranch.bind(this));

  register(GitCommand.TagCheckout, this.handleTagCheckout.bind(this));

  register(GitCommand.TagCopyRevisionNumber, this.handleTagCopyRevisionNumber.bind(this));

  register(
    GitCommand.TagShowRepositoryAtRevision,
    this.handleTagShowRepositoryAtRevision.bind(this)
  );

  register(GitCommand.TagCompareWithCurrent, this.handleTagCompareWithCurrent.bind(this));

  register(GitCommand.TagCreatePatch, this.handleTagCreatePatch.bind(this));

  register(GitCommand.TagCreateCurrent, this.handleTagCreateCurrent.bind(this));

  register(GitCommand.RemoteSetUrl, this.handleSetRemoteUrl.bind(this));
  register(GitCommand.RemoteChangeUrl, this.handleSetRemoteUrl.bind(this));
  register(GitCommand.RemoteSetUrlMissing, this.handleSetRemoteUrl.bind(this));

  register(GitCommand.RemoteAdd, this.handleRemoteAdd.bind(this));

  register(GitCommand.RemoteDelete, this.handleRemoteDelete.bind(this));

  register(GitCommand.BranchRename, this.handleBranchRename.bind(this));

  register(GitCommand.BranchDelete, this.handleBranchDelete.bind(this));

  register(GitCommand.BranchTrack, this.handleBranchTrack.bind(this));

  register(GitCommand.BranchUntrack, this.handleBranchUntrack.bind(this));

  register(GitCommand.BranchMergeIntoCurrent, this.handleBranchMergeIntoCurrent.bind(this));

  register(GitCommand.BranchRebaseOnto, this.handleBranchRebaseOnto.bind(this));

  register(GitCommand.BranchResetCurrentToCommit, this.handleResetCurrentToCommit.bind(this));

  register(GitCommand.BranchCompareWithCurrent, this.handleBranchCompareWithCurrent.bind(this));

  register(GitCommand.StashCreate, this.handleStashCreate.bind(this));

  register(GitCommand.StashUnshelve, this.handleStashUnshelve.bind(this));

  register(GitCommand.StashApply, this.handleStashApply.bind(this));
  register(GitCommand.StashPop, this.handleStashPop.bind(this));

  register(GitCommand.StashDrop, this.handleStashDrop.bind(this));

  register(GitCommand.StashRename, this.handleStashRename.bind(this));

  register(GitCommand.StashPreviewPatch, this.handleStashPreviewPatch.bind(this));

  register(GitCommand.GraphOpenDetails, this.handleGraphOpenDetails.bind(this));

  register(
    GitCommand.GraphOpenCommitRangeDetails,
    this.handleGraphOpenCommitRangeDetails.bind(this)
  );

  register(GitCommand.GraphCopyCommitId, this.handleGraphCopyCommitId.bind(this));

  register(GitCommand.GraphCopyCommitMessage, this.handleGraphCopyCommitMessage.bind(this));

  register(GitCommand.GraphOpenFileDiff, this.handleOpenFileDiff.bind(this));

  register(
    GitCommand.WorkingTreeCompareOpenFileDiff,
    this.handleWorkingTreeCompareOpenFileDiff.bind(this)
  );

  register(
    GitCommand.CompareWithRevisionSwapDirection,
    this.handleCompareWithRevisionSwapDirection.bind(this)
  );

  register(
    GitCommand.GraphOpenRepositoryFileAtRevision,
    this.handleGraphOpenRepositoryFileAtRevision.bind(this)
  );

  register(GitCommand.GraphCheckoutCommit, this.handleGraphCheckoutCommit.bind(this));

  register(GitCommand.GraphCreateBranchHere, this.handleGraphCreateBranchHere.bind(this));

  register(GitCommand.GraphCreateTagHere, this.handleGraphCreateTagHere.bind(this));

  register(GitCommand.GraphCherryPick, this.handleCherryPick.bind(this));

  register(GitCommand.GraphCherryPickRange, this.handleGraphCherryPickRange.bind(this));

  register(GitCommand.GraphRevert, this.handleGraphRevert.bind(this));

  register(GitCommand.CommitRevertSelectedChanges, this.handleRevertSelectedChanges.bind(this));

  register(
    GitCommand.CommitCherryPickSelectedChanges,
    this.handleCherryPickSelectedChanges.bind(this)
  );

  register(
    GitCommand.CommitCreatePatchSelectedChanges,
    this.handleCreatePatchSelectedChanges.bind(this)
  );

  register(GitCommand.CommitApplyPatch, this.handleApplyPatch.bind(this));

  register(GitCommand.GraphCompareWithCurrent, this.handleGraphCompareWithCurrent.bind(this));

  register(
    GitCommand.GraphRebaseInteractiveFromHere,
    this.handleGraphRebaseInteractiveFromHere.bind(this)
  );

  register(GitCommand.GraphEditCommitMessage, this.handleEditCommitMessage.bind(this));

  register(GitCommand.GraphGoToParentCommit, this.handleGraphGoToParentCommit.bind(this));

  register(GitCommand.GraphGoToChildCommit, this.handleGraphGoToChildCommit.bind(this));

  register(GitCommand.GraphPushAllUpToHere, this.handlePushAllUpToHere.bind(this));

  register(GitCommand.GraphCreatePatch, this.handleGraphCreatePatch.bind(this));

  register(GitCommand.GraphCreatePatchForRange, this.handleGraphCreatePatchForRange.bind(this));

  register(
    GitCommand.GraphShowRepositoryAtRevision,
    this.handleGraphShowRepositoryAtRevision.bind(this)
  );

  register(GitCommand.GraphFilter, this.handleGraphFilter.bind(this));

  register(GitCommand.GraphClearFilter, this.handleGraphClearFilter.bind(this));

  register(GitCommand.GraphLoadMore, this.handleGraphLoadMore.bind(this));

  register(GitCommand.DiffOpen, this.handleDiffOpen.bind(this));

  register(GitCommand.CompareOpen, this.handleCompareOpen.bind(this));

  register(GitCommand.MergeOpenConflict, this.handleMergeOpenConflict.bind(this));

  register(GitCommand.MergeNext, this.handleMergeNext.bind(this));

  register(GitCommand.MergePrevious, this.handleMergePrevious.bind(this));

  register(GitCommand.MergeFinalize, this.handleMergeFinalize.bind(this));

  register(GitCommand.ConflictAcceptOurs, this.handleConflictAcceptOurs.bind(this));
  register(GitCommand.ConflictAcceptTheirs, this.handleConflictAcceptTheirs.bind(this));
  register(GitCommand.ConflictAcceptBoth, this.handleConflictAcceptBoth.bind(this));

  register(GitCommand.OperationAbort, this.handleOperationAbort.bind(this));

  register(GitCommand.OperationContinue, this.handleOperationContinue.bind(this));

  register(GitCommand.OperationSkip, this.handleOperationSkip.bind(this));

  register(GitCommand.GitPushWithPreview, this.handleGitPushWithPreview.bind(this));

  register(GitCommand.GitPullWithPreview, this.handleGitPullWithPreview.bind(this));

  register(GitCommand.GitFetchPrune, this.handleGitFetchPrune.bind(this));

  register(GitCommand.GitSshPullGithub, this.handleGitSshPullGithub.bind(this));

  register(GitCommand.GitSshPullGitlab, this.handleGitSshPullGitlab.bind(this));

  register(GitCommand.GitSshPullBitbucket, this.handleGitSshPullBitbucket.bind(this));

  register(GitCommand.GitSshPullCustom, this.handleGitSshPullCustom.bind(this));

  register(GitCommand.StagePatch, this.handleStagePatch.bind(this));

  register(GitCommand.StageFile, this.handleStageFile.bind(this));

  register(GitCommand.ScmShelveResource, this.handleShelveResource.bind(this));

  register(GitCommand.UnstageFile, this.handleUnstageFile.bind(this));

  register(GitCommand.CommitAmend, this.handleCommitAmend.bind(this));

  register(GitCommand.ScmCommitTemplate, this.handleCommitTemplate.bind(this));

  register(GitCommand.ScmGenerateCommitMessage, this.handleGenerateCommitMessage.bind(this));

  register(GitCommand.ScmAmendFromInput, this.handleScmAmendFromInput.bind(this));

  register(GitCommand.CompareWithRevision, this.handleCompareWithRevision.bind(this));

  register(GitCommand.DirectoryTimelineOpen, this.handleDirectoryTimelineOpen.bind(this));

  register(GitCommand.FileBlameOpen, this.handleFileBlameOpen.bind(this));

  // ── Worktree commands ──────────────────────────────────────────────────

  register(GitCommand.WorktreeRefresh, this.handleWorktreeRefresh.bind(this));

  register(GitCommand.WorktreeOpen, this.handleWorktreeOpen.bind(this));

  register(GitCommand.WorktreeOpenInNewWindow, this.handleWorktreeOpenInNewWindow.bind(this));

  register(GitCommand.WorktreeAddFromBranch, this.handleWorktreeAddFromBranch.bind(this));

  register(GitCommand.WorktreeAddNewBranch, this.handleWorktreeAddNewBranch.bind(this));

  register(GitCommand.WorktreeAddDetached, this.handleWorktreeAddDetached.bind(this));

  register(GitCommand.WorktreeRemove, this.handleWorktreeRemove.bind(this));

  register(GitCommand.WorktreeRemoveForce, this.handleWorktreeRemoveForce.bind(this));

  register(GitCommand.WorktreeLock, this.handleWorktreeLock.bind(this));

  register(GitCommand.WorktreeUnlock, this.handleWorktreeUnlock.bind(this));

  register(GitCommand.WorktreePrunePreview, this.handleWorktreePrunePreview.bind(this));

  register(GitCommand.WorktreePrune, this.handleWorktreePrune.bind(this));

  register(GitCommand.WorktreeRevealInFinder, this.handleWorktreeRevealInFinder.bind(this));

  register(GitCommand.WorktreeOpenTerminal, this.handleWorktreeOpenTerminal.bind(this));

  // ── Submodule commands ─────────────────────────────────────────────────

  register(GitCommand.SubmoduleRefresh, this.handleSubmoduleRefresh.bind(this));

  register(GitCommand.SubmoduleInit, this.handleSubmoduleInit.bind(this));

  register(GitCommand.SubmoduleInitAll, this.handleSubmoduleInitAll.bind(this));

  register(GitCommand.SubmoduleUpdate, this.handleSubmoduleUpdate.bind(this));

  register(GitCommand.SubmoduleUpdateAll, this.handleSubmoduleUpdateAll.bind(this));

  register(GitCommand.SubmoduleUpdateRecursive, this.handleSubmoduleUpdateRecursive.bind(this));

  register(GitCommand.SubmoduleSync, this.handleSubmoduleSync.bind(this));

  register(GitCommand.SubmoduleSyncAll, this.handleSubmoduleSyncAll.bind(this));

  register(GitCommand.SubmoduleOpen, this.handleSubmoduleOpen.bind(this));

  register(GitCommand.SubmoduleOpenInNewWindow, this.handleSubmoduleOpenInNewWindow.bind(this));

  register(GitCommand.SubmoduleOpenTerminal, this.handleSubmoduleOpenTerminal.bind(this));

  register(GitCommand.SubmoduleCheckoutRecorded, this.handleSubmoduleCheckoutRecorded.bind(this));

  register(GitCommand.SubmodulePullTrackedBranch, this.handleSubmodulePullTrackedBranch.bind(this));

  register(GitCommand.SubmoduleDiffPointer, this.handleSubmoduleDiffPointer.bind(this));

  register(
    GitCommand.SubmoduleStagePointerChange,
    this.handleSubmoduleStagePointerChange.bind(this)
  );

  register(GitCommand.SubmoduleDeinit, this.handleSubmoduleDeinit.bind(this));
}
