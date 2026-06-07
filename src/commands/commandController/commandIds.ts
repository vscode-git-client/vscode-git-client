/** All VS Code command IDs registered by this extension. */
export enum CommandId {
  // ── General ─────────────────────────────────────────────────────────────
  Refresh = 'vscodeGitClient.refresh',
  CommitViewClose = 'vscodeGitClient.commitView.close',
  QuickActions = 'vscodeGitClient.quickActions',

  // ── Branch ──────────────────────────────────────────────────────────────
  BranchActionHub = 'vscodeGitClient.branch.actionHub',
  BranchOpenCommits = 'vscodeGitClient.branch.openCommits',
  BranchSearch = 'vscodeGitClient.branch.search',
  BranchSearchRefresh = 'vscodeGitClient.branch.search.refresh',
  BranchCheckout = 'vscodeGitClient.branch.checkout',
  BranchCreate = 'vscodeGitClient.branch.create',
  BranchRename = 'vscodeGitClient.branch.rename',
  BranchDelete = 'vscodeGitClient.branch.delete',
  BranchTrack = 'vscodeGitClient.branch.track',
  BranchUntrack = 'vscodeGitClient.branch.untrack',
  BranchMergeIntoCurrent = 'vscodeGitClient.branch.mergeIntoCurrent',
  BranchRebaseOnto = 'vscodeGitClient.branch.rebaseOnto',
  BranchResetCurrentToCommit = 'vscodeGitClient.branch.resetCurrentToCommit',
  BranchCompareWithCurrent = 'vscodeGitClient.branch.compareWithCurrent',

  // ── Tag ─────────────────────────────────────────────────────────────────
  TagOpenCommits = 'vscodeGitClient.tag.openCommits',
  TagCheckoutNewBranch = 'vscodeGitClient.tag.checkoutNewBranch',
  TagCheckout = 'vscodeGitClient.tag.checkout',
  TagCopyRevisionNumber = 'vscodeGitClient.tag.copyRevisionNumber',
  TagShowRepositoryAtRevision = 'vscodeGitClient.tag.showRepositoryAtRevision',
  TagCompareWithCurrent = 'vscodeGitClient.tag.compareWithCurrent',
  TagCreatePatch = 'vscodeGitClient.tag.createPatch',
  TagCreateCurrent = 'vscodeGitClient.tag.createCurrent',

  // ── Remote ──────────────────────────────────────────────────────────────
  RemoteSetUrl = 'vscodeGitClient.remote.setUrl',
  RemoteChangeUrl = 'vscodeGitClient.remote.changeUrl',
  RemoteSetUrlMissing = 'vscodeGitClient.remote.setUrlMissing',
  RemoteAdd = 'vscodeGitClient.remote.add',
  RemoteDelete = 'vscodeGitClient.remote.delete',

  // ── Stash ────────────────────────────────────────────────────────────────
  StashCreate = 'vscodeGitClient.stash.create',
  StashUnshelve = 'vscodeGitClient.stash.unshelve',
  StashApply = 'vscodeGitClient.stash.apply',
  StashPop = 'vscodeGitClient.stash.pop',
  StashDrop = 'vscodeGitClient.stash.drop',
  StashRename = 'vscodeGitClient.stash.rename',
  StashPreviewPatch = 'vscodeGitClient.stash.previewPatch',

  // ── Graph ────────────────────────────────────────────────────────────────
  GraphOpenDetails = 'vscodeGitClient.graph.openDetails',
  GraphCopyCommitId = 'vscodeGitClient.graph.copyCommitId',
  GraphCopyCommitMessage = 'vscodeGitClient.graph.copyCommitMessage',
  GraphOpenFileDiff = 'vscodeGitClient.graph.openFileDiff',
  GraphOpenRepositoryFileAtRevision = 'vscodeGitClient.graph.openRepositoryFileAtRevision',
  GraphCheckoutCommit = 'vscodeGitClient.graph.checkoutCommit',
  GraphCreateBranchHere = 'vscodeGitClient.graph.createBranchHere',
  GraphCreateTagHere = 'vscodeGitClient.graph.createTagHere',
  GraphCherryPick = 'vscodeGitClient.graph.cherryPick',
  GraphCherryPickRange = 'vscodeGitClient.graph.cherryPickRange',
  GraphRevert = 'vscodeGitClient.graph.revert',
  GraphCompareWithCurrent = 'vscodeGitClient.graph.compareWithCurrent',
  GraphRebaseInteractiveFromHere = 'vscodeGitClient.graph.rebaseInteractiveFromHere',
  GraphEditCommitMessage = 'vscodeGitClient.graph.editCommitMessage',
  GraphGoToParentCommit = 'vscodeGitClient.graph.goToParentCommit',
  GraphGoToChildCommit = 'vscodeGitClient.graph.goToChildCommit',
  GraphPushAllUpToHere = 'vscodeGitClient.graph.pushAllUpToHere',
  GraphCreatePatch = 'vscodeGitClient.graph.createPatch',
  GraphShowRepositoryAtRevision = 'vscodeGitClient.graph.showRepositoryAtRevision',
  GraphFilter = 'vscodeGitClient.graph.filter',
  GraphClearFilter = 'vscodeGitClient.graph.clearFilter',
  GraphLoadMore = 'vscodeGitClient.graph.loadMore',

  // ── Working-tree compare ─────────────────────────────────────────────────
  WorkingTreeCompareOpenFileDiff = 'vscodeGitClient.workingTreeCompare.openFileDiff',

  // ── Compare with revision ─────────────────────────────────────────────────
  CompareWithRevision = 'vscodeGitClient.compareWithRevision',
  CompareWithRevisionSwapDirection = 'vscodeGitClient.compareWithRevision.swapDirection',

  // ── Commit ───────────────────────────────────────────────────────────────
  CommitRevertSelectedChanges = 'vscodeGitClient.commit.revertSelectedChanges',
  CommitCherryPickSelectedChanges = 'vscodeGitClient.commit.cherryPickSelectedChanges',
  CommitCreatePatchSelectedChanges = 'vscodeGitClient.commit.createPatchSelectedChanges',
  CommitApplyPatch = 'vscodeGitClient.commit.applyPatch',
  CommitAmend = 'vscodeGitClient.commit.amend',

  // ── Diff / Compare ────────────────────────────────────────────────────────
  DiffOpen = 'vscodeGitClient.diff.open',
  CompareOpen = 'vscodeGitClient.compare.open',

  // ── Merge ─────────────────────────────────────────────────────────────────
  MergeOpenConflict = 'vscodeGitClient.merge.openConflict',
  MergeNext = 'vscodeGitClient.merge.next',
  MergePrevious = 'vscodeGitClient.merge.previous',
  MergeFinalize = 'vscodeGitClient.merge.finalize',

  // ── Conflict ──────────────────────────────────────────────────────────────
  ConflictAcceptOurs = 'vscodeGitClient.conflict.acceptOurs',
  ConflictAcceptTheirs = 'vscodeGitClient.conflict.acceptTheirs',
  ConflictAcceptBoth = 'vscodeGitClient.conflict.acceptBoth',

  // ── Operation ─────────────────────────────────────────────────────────────
  OperationAbort = 'vscodeGitClient.operation.abort',
  OperationContinue = 'vscodeGitClient.operation.continue',
  OperationSkip = 'vscodeGitClient.operation.skip',

  // ── Git ───────────────────────────────────────────────────────────────────
  GitPushWithPreview = 'vscodeGitClient.git.pushWithPreview',
  GitPullWithPreview = 'vscodeGitClient.git.pullWithPreview',
  GitFetchPrune = 'vscodeGitClient.git.fetchPrune',

  // ── Stage / Unstage ───────────────────────────────────────────────────────
  StagePatch = 'vscodeGitClient.stage.patch',
  StageFile = 'vscodeGitClient.stage.file',
  UnstageFile = 'vscodeGitClient.unstage.file',

  // ── SCM ───────────────────────────────────────────────────────────────────
  ScmShelveResource = 'vscodeGitClient.scm.shelveResource',
  ScmCommitTemplate = 'vscodeGitClient.scm.commitTemplate',
  ScmGenerateCommitMessage = 'vscodeGitClient.scm.generateCommitMessage',
  ScmAmendFromInput = 'vscodeGitClient.scm.amendFromInput',

  // ── Directory timeline ────────────────────────────────────────────────────
  DirectoryTimelineOpen = 'vscodeGitClient.directoryTimeline.open',

  // ── File blame ────────────────────────────────────────────────────────────
  FileBlameOpen = 'vscodeGitClient.fileBlame.open',

  // ── Worktree ──────────────────────────────────────────────────────────────
  WorktreeRefresh = 'vscodeGitClient.worktree.refresh',
  WorktreeOpen = 'vscodeGitClient.worktree.open',
  WorktreeOpenInNewWindow = 'vscodeGitClient.worktree.openInNewWindow',
  WorktreeAddFromBranch = 'vscodeGitClient.worktree.addFromBranch',
  WorktreeAddNewBranch = 'vscodeGitClient.worktree.addNewBranch',
  WorktreeAddDetached = 'vscodeGitClient.worktree.addDetached',
  WorktreeRemove = 'vscodeGitClient.worktree.remove',
  WorktreeRemoveForce = 'vscodeGitClient.worktree.removeForce',
  WorktreeLock = 'vscodeGitClient.worktree.lock',
  WorktreeUnlock = 'vscodeGitClient.worktree.unlock',
  WorktreePrunePreview = 'vscodeGitClient.worktree.prunePreview',
  WorktreePrune = 'vscodeGitClient.worktree.prune',
  WorktreeRevealInFinder = 'vscodeGitClient.worktree.revealInFinder',
  WorktreeOpenTerminal = 'vscodeGitClient.worktree.openTerminal',

  // ── Submodule ─────────────────────────────────────────────────────────────
  SubmoduleRefresh = 'vscodeGitClient.submodule.refresh',
  SubmoduleInit = 'vscodeGitClient.submodule.init',
  SubmoduleInitAll = 'vscodeGitClient.submodule.initAll',
  SubmoduleUpdate = 'vscodeGitClient.submodule.update',
  SubmoduleUpdateAll = 'vscodeGitClient.submodule.updateAll',
  SubmoduleUpdateRecursive = 'vscodeGitClient.submodule.updateRecursive',
  SubmoduleSync = 'vscodeGitClient.submodule.sync',
  SubmoduleSyncAll = 'vscodeGitClient.submodule.syncAll',
  SubmoduleOpen = 'vscodeGitClient.submodule.open',
  SubmoduleOpenInNewWindow = 'vscodeGitClient.submodule.openInNewWindow',
  SubmoduleOpenTerminal = 'vscodeGitClient.submodule.openTerminal',
  SubmoduleCheckoutRecorded = 'vscodeGitClient.submodule.checkoutRecorded',
  SubmodulePullTrackedBranch = 'vscodeGitClient.submodule.pullTrackedBranch',
  SubmoduleDiffPointer = 'vscodeGitClient.submodule.diffPointer',
  SubmoduleStagePointerChange = 'vscodeGitClient.submodule.stagePointerChange',
  SubmoduleDeinit = 'vscodeGitClient.submodule.deinit',
}
