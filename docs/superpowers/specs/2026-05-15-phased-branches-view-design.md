# Phased Branches View Loading

**Date:** 2026-05-15
**Status:** Design — pending implementation
**Scope:** `src/services/gitService.ts`, `src/state/stateStore.ts`

## Problem

The Branches view shows nothing for several seconds after activation (and after every `refs` refresh). The culprit is `StateStore.loadRefs()`, which awaits `getBranches()` and `getTags()` in parallel before publishing any state. `getTags()` is dominated by `getTagAvailabilityByRemote()`, which runs `git ls-remote --tags <remote>` for *every* configured remote — a network round-trip per remote. Until that completes, even the local branches stay invisible.

## Goals

1. Local branches appear as soon as the (very fast) `git for-each-ref refs/heads` returns.
2. Remote branches appear next, independently.
3. Tags appear with their per-remote availability icons already correct — no flicker between "no remote" and "available on remotes". (Earlier two-phase tag draft caused icon flicker and was rejected.)
4. The existing `RefreshScheduler` single-in-flight guarantee remains intact.
5. No regression: ahead/behind indicators, date sorting, tag tooltips, and per-remote tag icons all still work — they just arrive in their natural latency order.

## Non-goals

- Replacing the git CLI with the VS Code Git API for ref enumeration. The API does not expose ahead/behind, commit dates, peeled tag SHAs, remote URLs, or per-remote tag availability, and internally uses the same `for-each-ref` we'd run.
- Adding a "loading skeleton" UI. Empty sections in the tree collapse cleanly; partial data is not visually wrong.
- Caching branch/tag results across refreshes (out of scope; future work).
- Phasing scopes other than `refs`.

## Design

### Phases

`StateStore.loadRefs()` becomes a private method that runs three phases sequentially, emitting state after each:

| Phase | Git work | State mutation | Emit? |
| ----- | -------- | -------------- | ----- |
| A — Local branches | `git for-each-ref refs/heads` (with the same format string used today) | Set `_branches` to local-only list, preserving sort | Yes if changed |
| B — Remote branches | `git remote -v` + `git for-each-ref refs/remotes` | Append remotes to `_branches`, re-sort | Yes if changed |
| C — Tags (with per-remote availability merged in) | `git for-each-ref refs/tags` + `git ls-remote --tags <remote>` per remote, then `mergeTagAvailability` | Set `_tags` in a single assignment with `availableOnRemotes` already populated | Yes if changed |

**Why tags are not split into two phases.** Earlier drafts of this design had a phase C (basic tag names with empty `availableOnRemotes`) followed by a phase D (populate availability). User feedback flagged that this caused tag icons to flicker — first rendered without any remote icon, then re-rendered with the remote icon. Publishing tags only after both lookups complete eliminates the flicker at the cost of tags appearing slightly later than they otherwise could. If the `ls-remote` step fails, the basic tag list still publishes (with empty availability), so the section is not left blank.

After phase D the existing fingerprint check in `executeRefresh` still runs; if other scopes also changed, their emit fires as today.

### How phases interact with `executeRefresh`

`executeRefresh()` currently does `await Promise.all(updates)` where each update awaits one `load*` call, then fires one final emit if the fingerprint differs from `previousFingerprint`. The new behaviour:

- The `refs` slot of `updates` is replaced with the phased loader. The phased loader fires `this.emitter` directly after each phase that changes state, then resolves.
- The outer fingerprint check at the end of `executeRefresh` still runs and may fire one additional emit if a *non-refs* scope also changed. This is acceptable — extra emits are cheap; redundant emits are filtered by `createStateFingerprint` when nothing changed.
- Within the phased loader, the per-phase emit is also gated by a local "did this phase change anything" check (compare phase output to `this._branches` / `this._tags` before assigning) so a no-op refresh stays quiet.

### Error handling

Each phase is wrapped in its own try/catch. A failure in phase B/C logs through `this.logger.warn` and **does not** clear the data published by earlier phases. Within phase C, the inner `getTagAvailabilityByRemote` call is also independently guarded: if `ls-remote` fails, the basic tag list still publishes with empty availability so the section is not blank.

### GitService refactor

`getBranches()` and `getTags()` stay as public methods (their existing callers — compare views, graph filters, branch search — continue to work). Internally they delegate to:

- `getLocalBranches(): Promise<BranchRef[]>` — `refs/heads` only.
- `getRemoteBranches(remoteUrls: Map<string, string>): Promise<BranchRef[]>` — `refs/remotes` + URL fill-in.
- `getRemoteFetchUrls()` — already exists, becomes effectively public to the state store (via a thin accessor, or by passing the map through).
- `getTagsBasic(): Promise<TagRef[]>` — `for-each-ref refs/tags`, leaves `availableOnRemotes: []`.
- `getTagAvailabilityByRemote()` — already exists; the phased loader calls it directly and merges results into the existing `_tags` array.

`getBranches()` becomes: `concat(getLocalBranches(), getRemoteBranches(await getRemoteFetchUrls()))` with the same final sort. `getTags()` becomes: `getTagsBasic()` merged with `getTagAvailabilityByRemote()`. Both keep their current return shape so external callers are unaffected.

### Concurrency invariant

`RefreshScheduler` is unchanged. Only one `executeRefresh` runs at a time; mid-refresh requests are queued as today. The new mid-refresh emits originate from within the same in-flight `executeRefresh` and therefore do not violate the single-cycle invariant.

## Testing

- Add a focused unit test for the phased loader in a new file `src/test/stateStoreRefs.test.ts`. The test injects a stub `GitService` whose four split methods resolve in controlled order (each gated by a deferred) and asserts:
  - `state.branches` contains only locals after phase A resolves.
  - `state.branches` contains locals + remotes after phase B resolves.
  - `state.tags` is still empty after `getTagsBasic` resolves but `getTagAvailabilityByRemote` has not — this is the flicker-prevention guarantee.
  - `state.tags` populates in a single step with `availableOnRemotes` already filled in once both tag lookups complete.
  - A failure of `getTagAvailabilityByRemote` still publishes the basic tag list (with empty availability) rather than blanking the section.
  - `emitter` fires at least three times during the cycle (A, B, C tags-once).
- Existing tests must continue to pass. `getBranches()` and `getTags()` wrappers preserve their public shape.

## Files

- `src/services/gitService.ts` — extract `getLocalBranches`, `getRemoteBranches`, `getTagsBasic`; keep `getBranches`/`getTags` as wrappers.
- `src/state/stateStore.ts` — replace `loadRefs` body with phased flow; add the per-phase change detection.
- `src/test/stateStoreRefs.test.ts` (new) — phased loader test.
- `CHANGELOG.md` — one line under `[Unreleased] / Changed`.

## Acceptance criteria

- Local branches visible in the Branches view within ~200 ms of activation (typical workstation, warm git).
- Remote branches appear within ~400 ms.
- Tags appear with per-remote icons already correct (no flicker). They appear after branches because they wait for the slow `ls-remote` step; this is intentional.
- A network failure on one or more remotes does not blank out previously published branch or tag data; tags still render without per-remote icons.
- Pre-existing tests pass; new phased-loader test passes.
