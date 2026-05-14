# Development

## Setup

Install dependencies:

```bash
npm install
```

Compile:

```bash
npm run compile
```

Open this folder in VS Code and press `F5` to launch the extension host.

## Architecture Map

| Module                                                     | Purpose                                                                                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/services/gitService.ts`                               | Git command wrapper with typed methods, VS Code Git API integrations, error normalization, and command logging |
| `src/services/gitParsing.ts`                               | Output parsers for branches, stashes, log, status, and blame                                                   |
| `src/services/repositoryContext.ts`                        | Resolves the active Git repository root                                                                        |
| `src/services/submoduleService.ts` / `submoduleParsing.ts` | Submodule discovery and command wrappers                                                                       |
| `src/services/worktreeParsing.ts`                          | Worktree list parser                                                                                           |
| `src/state/stateStore.ts`                                  | Cached state for branches, stashes, graph, compare, worktree, submodule, and working-tree changes              |
| `src/state/changelistStore.ts`                             | Tracks selected changes in the Commit Details view                                                             |
| `src/state/commitTemplates.ts`                             | Loads and resolves commit message templates                                                                    |
| `src/providers/branchTreeProvider.ts`                      | Branch and tag tree provider                                                                                   |
| `src/providers/stashTreeProvider.ts`                       | Stash tree provider                                                                                            |
| `src/providers/graphTreeProvider.ts`                       | Git Graph tree provider                                                                                        |
| `src/providers/commitFilesTreeProvider.ts`                 | Commit Details tree provider                                                                                   |
| `src/providers/worktreeTreeProvider.ts`                    | Worktree tree provider                                                                                         |
| `src/providers/submoduleTreeProvider.ts`                   | Submodule tree provider                                                                                        |
| `src/commands/commandController.ts`                        | Command registration, action orchestration, and guardrails                                                     |
| `src/editor/editorOrchestrator.ts`                         | Merge, diff, revision, and compare-tab orchestration                                                           |
| `src/editor/gutterDecorationController.ts`                 | Inline gutter change markers vs `HEAD`                                                                         |
| `src/editor/virtualGitContentProvider.ts`                  | Virtual document provider for revision content                                                                 |
| `src/views/compareView.ts`                                 | Branch comparison webview                                                                                      |
| `src/views/graphFilterView.ts`                             | Filter Graph webview                                                                                           |
| `src/views/branchSearchView.ts`                            | Branch search webview                                                                                          |
| `src/views/commitActions.ts`                               | Shared context-menu action model for commit webviews                                                           |
| `src/views/templateRenderer.ts`                            | Handlebars template renderer for webviews                                                                      |

## Command ID Reference

Key command IDs, not exhaustive:

- `vscodeGitClient.quickActions` - Quick Git Actions palette
- `vscodeGitClient.refresh` - Refresh all views
- `vscodeGitClient.branch.*` - Checkout, create, rename, delete, track, merge, rebase, reset, compare, search, actionHub, openCommits
- `vscodeGitClient.tag.*` - Checkout, checkoutNewBranch, copyRevisionNumber, showRepositoryAtRevision, compareWithCurrent, createPatch, openCommits
- `vscodeGitClient.stash.*` - Create, apply, pop, drop, rename, previewPatch, unshelve
- `vscodeGitClient.graph.*` - openDetails, openFileDiff, checkoutCommit, createBranchHere, createTagHere, cherryPick, cherryPickRange, revert, rebaseInteractiveFromHere, compareWithCurrent, createPatch, showRepositoryAtRevision, openRepositoryFileAtRevision, goToParentCommit, filter, clearFilter
- `vscodeGitClient.commit.*` - revertSelectedChanges, cherryPickSelectedChanges, amend
- `vscodeGitClient.compare.open` - Open branch comparison
- `vscodeGitClient.compareWithRevision` - Compare Explorer files or folders with a revision
- `vscodeGitClient.merge.*` - openConflict, next, previous, finalize
- `vscodeGitClient.operation.*` - abort, continue, skip
- `vscodeGitClient.git.*` - pushWithPreview, pullWithPreview, fetchPrune
- `vscodeGitClient.stage.*` / `vscodeGitClient.unstage.file` - stage and unstage actions
- `vscodeGitClient.scm.*` - shelveResource, commitTemplate, generateCommitMessage, amendFromInput
- `vscodeGitClient.worktree.*` - worktree actions
- `vscodeGitClient.submodule.*` - submodule actions
- `vscodeGitClient.fileBlame.open` - File blame

Legacy `intelliGit.*` command aliases are registered after activation so existing keybindings and integrations keep working during migration.
