# Filter Graph Logic Fixes

**Date:** 2026-05-29
**Scope:** Filter Graph webview filtering, pagination state, and shared commit context menu availability.

## Goals

- Keep the current Filter Graph UI style unchanged.
- Fix logic mismatches that can make the current UI show incorrect results.
- Preserve Filter Graph isolation from the main Git Graph TreeView.
- Add focused regression coverage where the behavior is testable from the extension side.

## Fix Plan

### 1. Branch filter hides valid branch history

The backend branch filter uses `git log <branch-ref>` semantics and returns commits reachable from the branch. The webview currently applies a second branch check against decorated refs, which can hide ancestor commits that belong to the branch but are not decorated with that branch name.

Tasks:

- Treat `branch` as server-authoritative in the webview after a filtered snapshot arrives.
- Keep local preview filtering for fields that match commit-local data: message, author, since, and until.
- Avoid visual changes to the current Filter Graph layout.

### 2. Load-more can race with a new filter apply

`GraphFilterSession.loadMore()` and `GraphFilterSession.apply()` mutate the same session state. If load-more resolves after a newer apply, an old page can append into the newer filter session.

Tasks:

- Increment the session epoch on apply and clear.
- Capture the epoch, filters, and skip at load-more start.
- Append a loaded page only when the session epoch is still current.
- Add regression coverage for stale load-more results.

### 3. Empty placeholder disappears during pagination

`appendRows()` clears placeholder rows before checking whether the appended page has visible matches. When a page has no visible rows, the table can become blank.

Tasks:

- Clear the placeholder only when there are rows to append.
- Restore or preserve the empty-state row when no commit rows are visible.
- Keep the existing header behavior.

### 4. Multi-select context menu disables supported copy actions

The shared handler already supports batch `copyCommitId` and `copyCommitMessage`, but the webview menu availability list disables those actions for multi-select.

Tasks:

- Add `copyCommitId` and `copyCommitMessage` to the shared multi-select action allowlist.
- Confirm the shared menu remains consistent for Filter Graph, Compare Branches, and shared commit-list webviews.

## Verification

- Run `npm test`.
- Run `npx gitnexus detect-changes` before committing or finalizing the change scope.
- Confirm generated templates still compile through the normal build/test pipeline.
