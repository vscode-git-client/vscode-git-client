# CommandController Refactor — Extract Inline Callbacks to Private Methods

**Date:** 2026-07-07
**Type:** Refactor (internal)
**Tests:** 162 pass / 0 fail

## Problem

`CommandController.register()` was a 2,424-line method containing 117 inline
command registration callbacks. Every callback — from trivial one-liners to a
78-line cherry-pick handler with 5 branching outcome paths — was embedded
directly at the call site. There were no named handler methods. Understanding
what a command did required reading through a wall of closures.

Additionally, 21 type guard functions (`toBranchName`, `toCommitSha`,
`toGraphCommitShas`, `asGraphItem`, `asFileResourceUri`, etc.) were
closure-scoped inside `register()`, making them inaccessible to any code
outside that method.

## Solution

Extracted complex inline callbacks into private async methods on
`CommandController`, promoted type guard closures to private methods, and
consolidated near-identical command groups into parameterized handlers.

### Pattern

```typescript
// Before (inline):
register('vscodeGitClient.graph.cherryPick', async (arg, selected) => {
  // ... 78 lines of complex logic
});

// After (delegated):
register('vscodeGitClient.graph.cherryPick', this.handleCherryPick.bind(this));

private async handleCherryPick(arg?: unknown, selected?: unknown): Promise<void> {
  // ... same 78 lines, with this.toGraphCommitShas() instead of toGraphCommitShas()
}
```

### Key constraint

The `register()` wrapper (lines 180–195) wraps every callback with try/catch
error handling and registers both the primary `vscodeGitClient.*` command ID
and its legacy `intelliGit.*` alias. This wrapper was **not modified** — only
the callback passed to it changed from an inline arrow to
`this.handler.bind(this)`.

## Phases

### Phase 1 — Promote type guard closures to private methods

21 type guards moved from closure-scoped `const` inside `register()` to
`private` methods on `CommandController`. Each closure was replaced with a
one-line delegator (`const asBranchItem = (v) => this.asBranchItem(v)`).

Methods created: `asBranchItem`, `asBranchRemoteItem`, `asTagItem`,
`asStashItem`, `asGraphItem`, `asGraphFileItem`, `asCommitViewFileItem`,
`asCommitRangeFileItem`, `asRevisionViewFileItem`,
`asWorkingTreeCompareFileItem`, `asFileResourceUri`, `toExplorerResourceUris`,
`toBranchName`, `toRepoFilePath`, `toCommitSha`, `toCommitSubject`,
`resolveCommitSubject`, `toGraphCommitShas`, `toTagRef`, `toTagRevision`,
`legacyCommandId`.

### Phase 2 — Extract 10 complex commands (highest priority)

| # | Command ID | New Method | Complexity |
|---|------------|------------|------------|
| 1 | `graph.cherryPick` | `handleCherryPick` | 78 lines, loop over SHAs, error classification with 5 outcome paths (conflict / failed / all-success / empty-only / mixed), progress tracking (pickedShas, emptyShas, failedShas, conflictSha) |
| 2 | `graph.editCommitMessage` | `handleEditCommitMessage` | 50 lines, getCommitDetails → inputBox → confirm → getParentCommit → shell escaping with `sed`/`printf` → `startRebaseOperation` |
| 3 | `operation.continue` | `handleOperationContinue` | 50 lines, state detection, conflict checking, 4-way branching (merge finalize / rebase continue with error classification / cherry-pick / revert) |
| 4 | `operation.abort` | `handleOperationAbort` | 21 lines, state detection, confirm, 4-way switch (merge / rebase / cherry-pick / revert abort) |
| 5 | `graph.openFileDiff` | `handleOpenFileDiff` | 30 lines, tries `openSelectedFileDiffs`, then 4-way item-type dispatch (GraphFileItem / CommitRangeFileItem / CommitViewFileItem) |
| 6 | `graph.pushAllUpToHere` | `handlePushAllUpToHere` | 40 lines, ancestor check (`merge-base --is-ancestor`), singleton shortcut, `git log` preview, confirm |
| 7 | `commit.cherryPickSelectedChanges` | `handleCherryPickSelectedChanges` | 37 lines, `resolveSelectedCommitFiles`, `canCherryPick` guard, 3-way `kind` branching (commit / range / workingTreeCompare) |
| 8 | `commit.createPatchSelectedChanges` | `handleCreatePatchSelectedChanges` | 50 lines, 3-way `kind` branching for patch generation, `pickPatchOutputTarget` (clipboard / file), save dialog, optional auto-apply |
| 9 | `commit.revertSelectedChanges` | `handleRevertSelectedChanges` | 35 lines, 3-way `kind` branching for revert source |
| 10 | `commit.applyPatch` | `handleApplyPatch` | 20 lines, `pickPatchSource` (clipboard / file), clipboard read or file picker, `applyPatchToWorkingTree` |

### Phase 3 — Extract 8 medium-complexity commands

| # | Command ID | New Method | Description |
|---|------------|------------|-------------|
| 1 | `stash.create` | `handleStashCreate` | 20 lines, inputBox + 2× quickPick (includeUntracked / keepIndex) → `git.createStash` |
| 2 | `branch.resetCurrentToCommit` | `handleResetCurrentToCommit` | 30 lines, `toCommitSha` → quickPick (soft/mixed/hard) → confirm → reset |
| 3 | `compareWithRevision` | `handleCompareWithRevision` | 55 lines, multi-file/folder handling, git root normalization, `FileStat` checks, `pickRevisionToCompare`, directory vs file branching |
| 4 | `directoryTimeline.open` | `handleDirectoryTimelineOpen` | 30 lines, directory validation, `openDirectoryTimeline` |
| 5 | `scm.commitTemplate` | `handleCommitTemplate` | 35 lines, `getBuiltInGitRepository`, `loadTemplates`, quickPick, `expandTemplate`, set inputBox |
| 6 | `scm.amendFromInput` | `handleScmAmendFromInput` | 25 lines, `getBuiltInGitRepository`, confirm, amend, clear inputBox |
| 7 | `scm.shelveResource` | `handleShelveResource` | 30 lines, extract filePath → inputBox → `getChangedFiles` → conditional `includeUntracked` → `git.stashFiles` |
| 8 | `scm.generateCommitMessage` | `handleGenerateCommitMessage` | 25 lines, `getBuiltInGitRepository`, timeout, AI generation with cancellation, error classification |

### Phase 4 — Extract 2 view initializers

| # | Command ID | New Method | Description |
|---|------------|------------|-------------|
| 1 | `branch.search` | `handleBranchSearch` | 27 lines, initializes `BranchSearchView.open` with 5 callbacks, binds state getters, sets up listeners |
| 2 | `graph.filter` | `handleGraphFilter` | 37 lines, initializes `GraphFilterSession` + `GraphFilterView.open` with 5 callbacks, manages snapshot state |

### Phase 5 — Remove closure shadow variables

All 21 closure delegate lines (`const asBranchItem = (v) => this.asBranchItem(v)`)
were deleted. Remaining inline callbacks now call `this.toBranchName(arg)`
directly. The `register()` wrapper function remains intact.

### Phase 6 — Consolidate near-identical patterns

| Pattern | Before | After |
|---------|--------|-------|
| Conflict resolution trio | 3 separate inline callbacks (~21 lines total) | `register()` delegates to `handleConflictResolve(arg, 'ours'|'theirs'|'both')` (24-line private method) |
| Stash apply/pop | 2 near-identical inline callbacks (~12 lines each) | `register()` delegates to `handleStashApplyPop(arg, pop)` (7-line private method) |
| Remote URL setter | 1 local `const setRemoteUrlFromItem` function ~24 lines, called by 3 registers | `handleSetRemoteUrl` private method (24 lines), called by 3 `this.handleSetRemoteUrl.bind(this)` |
| Tag → graph duplicates | `tag.createPatch`, `tag.showRepositoryAtRevision`, `tag.compareWithCurrent` inline callbacks | Remained inline but simplified (one-liner early-returns, reduced indentation) |

## Risk Mitigation

- **One extraction at a time.** Each command was extracted, tested, and
  committed independently (parallel agents handled batches within phases).
- **`bind(this)` equivalence.** Arrow functions capture `this` from the
  enclosing scope. `this.handler.bind(this)` provides the same `this` and
  passes all arguments identically through the `register()` wrapper.
- **No test modifications.** All 162 existing tests pass without changes.
  The test harness monkey-patches `vscode.commands.registerCommand` to
  intercept handlers — the same `CommandController` class is instantiated,
  the same call to `controller.register(context)` populates the same
  command map, and the same handler logic executes.
- **Command IDs unchanged.** The first argument to `register()` never
  changed. Legacy `intelliGit.*` aliasing inside the `register()` wrapper
  (lines 190–194) was untouched.

## Results

| Metric | Before | After |
|--------|--------|-------|
| `register()` method lines | ~2,424 | ~826 (↓66%) |
| Inline callbacks | 117+ (all inline) | 92 inline + 25 extracted to private methods |
| Type guards | 21 closures | 21 private methods |
| Consolidated command groups | 0 | 3 (conflict resolution, stash apply/pop, remote URL) |
| Tests | 162 pass | 162 pass |
| Command IDs | 127 | 127 (unchanged) |
| Legacy `intelliGit.*` aliases | all present | all present (unchanged) |

## Files Changed

- `src/commands/commandController.ts` — the sole file modified (1,195 insertions, 1,128 deletions)
- `CHANGELOG.md` — summary entry added
