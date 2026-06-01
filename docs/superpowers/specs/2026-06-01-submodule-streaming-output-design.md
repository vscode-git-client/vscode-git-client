# Submodule Init/Update Streaming Output — Design

**Status:** Draft
**Date:** 2026-06-01
**Area:** Submodules view

## Problem

When a repository has many submodules, `git submodule init` / `update`
takes longer than the extension's fixed 15-second `commandTimeoutMs`.
The current code path (`SubmoduleService` → `runGit`) buffers all
stdout/stderr in memory and only logs on completion, so the user has
no way to follow progress or inspect errors while the command is
running. The result is opaque timeouts.

This design routes submodule mutating operations through a
streaming, cancellable spawn primitive that forwards git's output
live to the existing VS Code Output channel.

## Scope

In scope — all submodule **mutating** operations:

- `initSubmodule`, `initAllSubmodules`
- `updateSubmodule`, `updateAllSubmodules` (incl. recursive)
- `syncSubmodule` (single + all)
- `deinitSubmodule`
- `checkoutRecordedSubmoduleCommit`
- `pullSubmoduleTrackedBranch`

Out of scope — read-only ops retain the existing `runGit` / `runGitAt`
path with the 15-second timeout:

- `getSubmodules`, `getSubmoduleStatus`, `getSubmoduleConfig`
- `getSubmoduleWorktreeStatus`, `getRecordedSubmoduleSha`
- `getSubmodulePointerDiff`

Other long-running git operations (clone, fetch) are also out of
scope. The new helper lives inside `SubmoduleService` rather than
`GitService` to keep the change narrowly focused; if a future feature
needs the same primitive elsewhere, it can be promoted upward.

## Approach

A second spawn site inside `SubmoduleService` — `spawnGitStreaming` —
that:

1. Does not apply `commandTimeoutMs`.
2. Buffers stdout / stderr into newline-delimited chunks before
   forwarding to a `SubmoduleLogSink`.
3. Honors an `AbortSignal` by killing the child.
4. Does not reject on non-zero exit — the caller decides what counts
   as failure.

The command controller wraps each invocation in
`vscode.window.withProgress` and threads a `CancellationToken` into
the `AbortController` that drives the spawn. The sink writes into the
existing `Logger` channel (`"VS Code Git Client"`) via a new
`Logger.appendRaw` method.

## Components

### `SubmoduleLogSink` (new — `src/services/submoduleLogSink.ts`)

```ts
export interface SubmoduleLogSink {
  header(line: string): void;     // e.g. "$ git submodule update --init"
  stdout(chunk: string): void;    // line-buffered stdout
  stderr(chunk: string): void;    // line-buffered stderr (git progress)
  done(exitCode: number | null, durationMs: number): void;
  error(err: Error): void;
}

export const NULL_SINK: SubmoduleLogSink = {
  header() {}, stdout() {}, stderr() {},
  done() {}, error() {}
};
```

A recording implementation lives in tests; the production
implementation lives in `CommandController` and writes through
`Logger.appendRaw`.

### `SubmoduleService.spawnGitStreaming` (new private method)

Signature:

```ts
private async spawnGitStreaming(
  args: string[],
  options: {
    cwd?: string;              // resolved against gitRoot; defaults to gitRoot
    sink: SubmoduleLogSink;
    signal?: AbortSignal;
  }
): Promise<{ exitCode: number | null }>
```

Behavior:

- Resolves `cwd` via `resolveSubmoduleCwd(this.gitRoot, options.cwd)`
  when `cwd` is provided; otherwise spawns in `gitRoot`.
- Reads `gitPath` from configuration (`getConfigValue<string>('gitPath', 'git')`).
- Spawns with `windowsHide: true`; **no `setTimeout` timer**.
- Subscribes to `signal.onabort` (or `signal.addEventListener('abort')`)
  to call `child.kill()`.
- Splits `stdout` and `stderr` Buffer chunks on `\n`, retaining any
  trailing partial line in a per-stream buffer that is flushed on
  `close`.
- For each emitted line: forwards through `sink.stdout(line)` /
  `sink.stderr(line)`.
- `\r`-only progress redraws within a single chunk are collapsed: the
  helper splits each pre-newline segment on `\r` and forwards only the
  last non-empty segment. This prevents the channel from filling with
  thousands of carriage-return redraws while still preserving the
  final progress text.
- On `child.on('error', ...)`: `sink.error(err)`, resolve with
  `exitCode: null`.
- On `child.on('close', code)`: flush trailing partial lines,
  `sink.done(code, durationMs)`, resolve with `{ exitCode: code }`.
- Does **not** route through `gitCommandQueue` — these are not
  read-only short ops.

### `SubmoduleService` mutating methods

Each gains an optional second parameter:

```ts
type StreamOptions = { sink?: SubmoduleLogSink; signal?: AbortSignal };

async initAllSubmodules(opts: StreamOptions = {}): Promise<{ exitCode: number | null }>
async updateAllSubmodules(recursive = false, opts: StreamOptions = {}): Promise<{ exitCode: number | null }>
// …same shape for the others
```

If `opts.sink` is omitted, `NULL_SINK` is used — preserves backward
compatibility for any caller that doesn't care about logs.

Each method writes a header line to the sink before spawning so the
channel reads like a transcript:

```
$ git submodule update --init
<git output>
[done in 12.3s, exit 0]
```

Return value changes from `Promise<void>` to
`Promise<{ exitCode: number | null }>` so the caller can decide
messaging. `GitService` pass-through wrappers in
`src/services/gitService.ts` match the new shape.

### `Logger.appendRaw` (new — `src/logger.ts`)

```ts
appendRaw(line: string): void {
  this.channel.appendLine(line);
}
```

Distinct from `info`/`warn`/`error` because those prefix with
`[info]` etc. — submodule output is verbatim git output and should
not be tagged.

### `SubmoduleProgress` adapter (in `src/commands/commandController.ts`)

A small helper, file-local:

```ts
function withSubmoduleProgress<T>(
  logger: Logger,
  options: { title: string; autoShow: boolean; command: string },
  run: (opts: { sink: SubmoduleLogSink; signal: AbortSignal }) => Promise<T>
): Promise<T>
```

Responsibilities:

1. If `autoShow`, call `logger.show(true)` before starting.
2. Run inside `vscode.window.withProgress({ location: Notification,
   cancellable: true, title }, ...)`.
3. Build an `AbortController`; bridge the `CancellationToken`'s
   `onCancellationRequested` to `abort()`.
4. Build a `SubmoduleLogSink` that:
   - `header` → `logger.appendRaw(line)`
   - `stdout` → `logger.appendRaw(line)`
   - `stderr` → `logger.appendRaw(line)` + `progress.report({ message: line })`
   - `done(exit, ms)` → `logger.appendRaw('[done in ' + (ms/1000).toFixed(1) + 's, exit ' + exit + ']')`
   - `error(err)` → `logger.appendRaw('[error] ' + err.message)`
5. After `run` resolves, handle exit code:
   - `0` → no toast.
   - `null` with cancellation token tripped → `[cancelled]` line.
   - non-zero → `vscode.window.showWarningMessage('<command> failed; see Output for details.', 'Show Output')` and reveal channel if user clicks.

Auto-show is enabled for **bulk** ops: `initAll`, `updateAll`,
`updateRecursive`, `syncAll`. Per-submodule ops run with `autoShow:
false`.

## Data flow

```
User triggers "Update All Submodules"
      │
      ▼
CommandController registers:
  withSubmoduleProgress(logger, {title:"Updating N submodule(s)…", autoShow:true,
                                 command:"git submodule update --init"}, async ({sink, signal}) =>
    git.updateAllSubmodules(false, { sink, signal })
  )
      │
      ▼
GitService.updateAllSubmodules → SubmoduleService.updateAllSubmodules({sink, signal})
      │
      ▼
sink.header("$ git submodule update --init")
spawnGitStreaming(['submodule','update','--init'], {sink, signal})
      │
      ▼  no timeout
   stdout chunk → split lines → sink.stdout(line) → channel
   stderr chunk → split lines → sink.stderr(line) → channel + progress.report
   close(code)  → flush trailing → sink.done(code, ms) → "[done in 12.3s, exit 0]"
   abort        → child.kill()    → sink.done(null, ms) → "[cancelled]"
      │
      ▼
finally: state.refreshSubmodules()   // always — partial state is valid state
      │
      ▼
if exitCode !== 0 && !cancelled → showWarningMessage(…, "Show Output")
```

## Error handling & edge cases

| Case | Handling |
| --- | --- |
| Non-zero exit | `spawnGitStreaming` resolves with `exitCode`. Adapter shows a warning toast with a "Show Output" action. Channel already has the transcript. |
| Spawn failure (git binary missing) | `child.on('error', err)` → `sink.error(err)` → resolve `exitCode: null`. Same warning path. |
| Cancellation | `AbortController.abort()` → `child.kill()` → `[cancelled after Ns]` line → `state.refreshSubmodules()` still runs. |
| Concurrent ops | Streaming spawn does not use `gitCommandQueue`. Two parallel "Update All" invocations both stream; channel headers distinguish them. No mutex added — accepted explicitly. |
| High output volume (progress redraws) | `\r`-only intra-chunk segments collapsed before forwarding. No per-line rate limit. |
| Partial trailing line at exit | Flushed via the same sink callback before `done`. |
| Memory | No accumulation in our code — every chunk forwarded and dropped. |
| Stale tree view on error/cancel | `state.refreshSubmodules()` always runs in `finally`. |

## Testing

### Unit tests for `spawnGitStreaming`
New file: `src/test/submoduleStreaming.test.ts`. Uses `node -e '...'`
shell scripts (not mocks) for deterministic stdout/stderr/exit-code
behavior.

- Multiple stdout lines → recording sink receives each via `stdout()` once.
- Partial trailing line → flushed on `close`.
- Non-zero exit with stderr → sink gets stderr lines + `done(2, …)`,
  promise resolves (no throw).
- Abort mid-run → `child.kill()` fires, `done(null, …)`, promise
  resolves within ~1s.
- `\r`-only progress chunks → only the final segment forwarded.

### Unit tests for `SubmoduleService` mutating ops
Subclass-override pattern matching `src/test/lazyStash.test.ts`:
override `spawnGitStreaming` with a stub that records argv + sink
calls.

- Each mutating method passes the right argv, calls `sink.header`
  first, forwards the signal.
- Read-only methods still go through `runGit` — unaffected.

### Manual smoke checks (documented, not automated)

- Repo with 3+ submodules: "Update All Submodules" auto-shows
  channel, progress notification with Cancel, completes.
- Repo with one broken submodule URL: channel shows fetch errors,
  warning toast appears with "Show Output", tree refreshes.
- Mid-update Cancel click: child killed within ~1s, `[cancelled]`
  line appended, tree refreshes.

## Files affected

- **New:** `src/services/submoduleLogSink.ts`
- **New:** `src/test/submoduleStreaming.test.ts`
- **Modified:** `src/services/submoduleService.ts` (add
  `spawnGitStreaming`, change mutating-op signatures + return shapes,
  add header lines)
- **Modified:** `src/services/gitService.ts` (pass-through wrappers
  forward the options bag and the new return shape)
- **Modified:** `src/logger.ts` (add `appendRaw`)
- **Modified:** `src/commands/commandController.ts` (wrap submodule
  commands with `withSubmoduleProgress`, handle warning toasts)

## Documentation updates

- `CHANGELOG.md`: add an entry under the next-version section noting
  streamed submodule output and Cancel support.
- `README.md`: if there's a submodules section, add a one-line note
  that long submodule operations log progress to the **VS Code Git
  Client** Output channel.

## Non-goals

- Streaming for other long-running git commands (clone, fetch).
- Per-submodule progress bars or structured progress parsing.
- Serializing submodule mutating ops via a mutex.
- A dedicated "Git Client: Submodules" output channel.
