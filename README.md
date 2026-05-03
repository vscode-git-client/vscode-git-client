# IntelliGit Client (VS Code Extension)

IntelliGit is an IntelliJ-like Git client extension for VS Code focused on core parity and your requested UI:

- Left sidebar sections: `Changes`, `Branches`, `Stashes`, `Git Graph`
- Main editor workflows: `3-way merge`, `side-by-side diff`, `branch comparison`

## Implemented Features

### Changes (Webview)
- Working tree and index status grouped by state (modified, staged, untracked, conflicted)
- File diff from change entry
- Conflict resolution shortcuts:
  - Accept Ours
  - Accept Theirs
  - Accept Both (open merge editor)
- In-progress operation banner (merge / rebase / cherry-pick) with Continue, Skip, Abort actions
- Stash selected changes

### Branches (Tree View)
- Hierarchical branch tree grouped by prefix (`feature/*`, `release/*`, etc.)
- Local + remote branches
- Current branch marker + upstream/ahead/behind info
- Branch actions:
  - Checkout
  - Create
  - Rename
  - Delete
  - Track / untrack upstream
  - Merge into current
  - Rebase current onto selected branch
  - Reset current branch to selected commit (`soft|mixed|hard`) with confirmation
  - Compare with current branch
- Branch search/filter command

### Stashes (Tree View)
- Stash list with message, author, timestamp, file count
- Stash actions:
  - Create stash (include untracked, keep index)
  - Apply
  - Pop
  - Drop (guarded)
  - Rename message
  - Patch preview (diff document)
  - Unshelve (apply stash to working tree without removing)
  - Stash selected changes from Changes view

### Git Graph (Tree View)
- Commit list with graph-like glyph, refs, metadata, author/date
- Commit details view:
  - Full message
  - Parent SHAs
  - Changed files
  - Stats (files/insertions/deletions)
- Commit actions:
  - Checkout commit (detached, guarded)
  - Create branch at commit
  - Create tag at commit
  - Cherry-pick commit
  - Revert commit
  - Cherry-pick range
  - Compare commit with current branch
  - Interactive rebase from selected commit
  - Go to parent commit
  - Create patch from commit
  - Open file at revision
  - Show repository at revision
- Graph filters:
  - branch/ref
  - author
  - message text
  - since / until dates

### Main Editor Workflows
- 3-way merge: integrates with VS Code merge editor
  - Open conflicted file in merge editor
  - Next/previous conflict commands
  - Finalize guard: blocks if unresolved conflicts remain
- Side-by-side diff entry points:
  - Working tree vs HEAD
  - Index vs HEAD
  - Commit vs parent
  - Any two refs for a file
- Branch comparison tab:
  - Dedicated webview for `A..B`, `B..A`, changed files
  - Drill down into file-level diff
  - Recent compare pairs persisted in workspace state
- Shared commit context menu for Filter Graph and Branch Comparison. See `docs/context-menus.md`.

### Cross-cutting Features
- Quick Git Actions command palette entry
- Push/pull previews (incoming/outgoing commit summaries)
- Fetch --prune
- Partial staging (`git add -p`)
- Stage file / unstage file
- Amend last commit
- File history and blame from active editor file
- Guardrails for destructive operations with modal confirmation
- Output channel logging of executed Git commands
- Deterministic state refresh after mutating operations

## Architecture

- `src/services/gitService.ts`
  - Native `git` CLI wrapper with typed methods
  - Error normalization and command logging
- `src/state/stateStore.ts`
  - Central cached state for branches/stashes/graph/compare
  - Auto-refresh on `.git` file changes
- `src/providers/*TreeProvider.ts`
  - Branch, stash, and graph sidebar tree providers
- `src/providers/changesWebviewProvider.ts`
  - Webview-based Changes panel (working tree status, conflict resolution, operation banner)
- `src/commands/commandController.ts`
  - Command registration, action orchestration, guardrails
- `src/editor/editorOrchestrator.ts`
  - Merge/diff/compare tab orchestration
- `src/views/compareView.ts`
  - Branch comparison webview UI

## Available Commands

Not exhaustive list of key command IDs:

- `intelliGit.quickActions`
- `intelliGit.refresh`
- `intelliGit.branch.*`
- `intelliGit.stash.*`
- `intelliGit.graph.*`
- `intelliGit.diff.open`
- `intelliGit.compare.open`
- `intelliGit.merge.*`
- `intelliGit.conflict.*` (acceptOurs, acceptTheirs, acceptBoth)
- `intelliGit.operation.*` (abort, continue, skip)
- `intelliGit.git.*`
- `intelliGit.stage.*`
- `intelliGit.changes.*`
- `intelliGit.commit.amend`
- `intelliGit.fileHistory.open`
- `intelliGit.fileBlame.open`

## Run Locally

1. Install deps:

```bash
npm install
```

2. Compile:

```bash
npm run compile
```

3. Open this folder in VS Code and press `F5` to launch the extension host.

4. In the launched window, open Activity Bar > `IntelliGit`.

## Notes / Current v1 Boundaries

- Single-repo per window (first workspace folder)
- Native Git CLI required on system path (or configure `intelliGit.gitPath`)
- Uses built-in VS Code merge/diff editors for reliability
- Graph is tree-based rendering (with glyph hints), not a fully custom canvas DAG yet
- PR/issue tracker integrations are intentionally not included in this core-parity scope

## Settings

- `intelliGit.gitPath` (default: `git`)
- `intelliGit.commandTimeoutMs` (default: `15000`)
- `intelliGit.maxGraphCommits` (default: `200`)
