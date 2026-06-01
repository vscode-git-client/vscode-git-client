# Submodule Init/Update Streaming Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route submodule mutating operations through a streaming, cancellable spawn primitive that writes git's live output into the VS Code Output channel, eliminating the 15-second timeout that kills init/update on repos with many submodules.

**Architecture:** A new `spawnGitStreaming` helper inside `SubmoduleService` spawns git with no timeout, line-buffers stdout/stderr, and forwards each line through a `SubmoduleLogSink` interface. The command controller wraps each invocation in `vscode.window.withProgress` (with Cancel) and uses an adapter that forwards lines into the existing `"VS Code Git Client"` channel via a new `Logger.appendRaw` method. Bulk ops auto-reveal the channel; per-item ops stream silently. Read-only submodule queries keep the existing `runGit` path with its 15s timeout — unchanged.

**Tech Stack:** TypeScript, VS Code Extension API (`window.withProgress`, `OutputChannel`, `CancellationToken`), Node `child_process.spawn`, `node:test` test runner.

**Spec:** `docs/superpowers/specs/2026-06-01-submodule-streaming-output-design.md`

---

## File Structure

| Path | Status | Responsibility |
| --- | --- | --- |
| `src/services/submoduleLogSink.ts` | **new** | Defines the `SubmoduleLogSink` interface + `NULL_SINK` no-op. Zero dependencies on `vscode` so it's freely importable from tests. |
| `src/services/submoduleService.ts` | modify | Adds private `spawnGitStreaming`. Mutating methods accept `{sink?, signal?}` and return `{exitCode}`. Read-only methods unchanged. |
| `src/services/gitService.ts` | modify | Pass-through wrappers forward the options bag and the new `{exitCode}` return shape (lines ~1895-1916). |
| `src/logger.ts` | modify | Add `appendRaw(line)` — writes a line to the channel with no `[info]`/`[warn]` prefix. |
| `src/commands/commandController.ts` | modify | Wrap submodule mutating commands with a file-local `withSubmoduleProgress` helper that builds an adapter sink + handles Cancel + auto-show + warning toast on non-zero exit. |
| `src/test/submoduleStreaming.test.ts` | **new** | Unit tests for `spawnGitStreaming` using `node -e '…'` shell scripts for deterministic stdout/stderr/exit/abort behavior. |
| `src/test/submoduleService.test.ts` | **new** | Unit tests for `SubmoduleService` mutating ops — subclass-override pattern (matches `src/test/lazyStash.test.ts`). |
| `CHANGELOG.md` | modify | Add entry under `[Unreleased] → Changed` noting streamed submodule output + Cancel. |
| `README.md` | modify | One-line note in the `Manage Submodules` section pointing users to the Output channel for long ops. |

---

## Task 0: Add SubmoduleLogSink interface

**Goal:** A `vscode`-free sink interface usable by `SubmoduleService` and tests.

**Files:**
- Create: `src/services/submoduleLogSink.ts`

**Acceptance Criteria:**
- [ ] Interface exports `header`, `stdout`, `stderr`, `done`, `error`.
- [ ] `NULL_SINK` constant provided (all methods no-op).
- [ ] No `import * as vscode` in the file.

**Verify:** `npm run check-types` → no errors mentioning `submoduleLogSink.ts`.

**Steps:**

- [ ] **Step 1: Create the file**

```ts
// src/services/submoduleLogSink.ts
export interface SubmoduleLogSink {
  /** Called once per git invocation, with the equivalent shell command line. */
  header(line: string): void;
  /** Called per newline-delimited chunk of stdout. */
  stdout(line: string): void;
  /** Called per newline-delimited chunk of stderr (git progress lives here). */
  stderr(line: string): void;
  /** Called exactly once after child exit. exitCode is `null` if the child was killed or never spawned. */
  done(exitCode: number | null, durationMs: number): void;
  /** Called when the child fails to spawn or emits a process-level error. */
  error(err: Error): void;
}

export const NULL_SINK: SubmoduleLogSink = {
  header() { /* noop */ },
  stdout() { /* noop */ },
  stderr() { /* noop */ },
  done() { /* noop */ },
  error() { /* noop */ }
};
```

- [ ] **Step 2: Compile check**

Run: `npm run check-types`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/submoduleLogSink.ts
git commit -m "feat: add SubmoduleLogSink interface for streaming submodule output"
```

---

## Task 1: Implement `spawnGitStreaming` with TDD

**Goal:** A line-buffered, cancellable, no-timeout git spawn primitive on `SubmoduleService`. Tests written first; helper extracted as a top-level export so it can be unit-tested without instantiating `SubmoduleService` (which depends on a workspace configuration shape).

**Files:**
- Create: `src/test/submoduleStreaming.test.ts`
- Modify: `src/services/submoduleService.ts` (add export `spawnGitStreaming` + private wrapper method)

**Acceptance Criteria:**
- [ ] No `setTimeout` / `commandTimeoutMs` applied to streaming spawns.
- [ ] stdout chunks split on `\n`; trailing partial line flushed on close.
- [ ] stderr chunks split on `\n`; intra-segment `\r`-only progress redraws collapsed to the last segment.
- [ ] `signal.abort()` calls `child.kill()` and resolves with `{exitCode: null}`.
- [ ] Resolves with `{exitCode}` on close; never rejects for non-zero exit.
- [ ] `sink.header` called by the caller (not by `spawnGitStreaming` itself) — keeps the helper a pure spawner.
- [ ] `sink.error(err)` fires only for `child.on('error', ...)`; promise still resolves with `{exitCode: null}`.

**Verify:**
```
npm run compile && node --require ./scripts/register-vscode-mock.js --test dist/test/submoduleStreaming.test.js
```
Expected: all tests pass.

**Steps:**

- [ ] **Step 1: Write failing tests**

```ts
// src/test/submoduleStreaming.test.ts
import * as assert from 'assert';
import { describe, it } from 'node:test';
import { spawnGitStreaming } from '../services/submoduleService';
import type { SubmoduleLogSink } from '../services/submoduleLogSink';

interface RecordedCall {
  type: 'stdout' | 'stderr' | 'done' | 'error';
  payload: unknown;
}

function recorder(): { sink: SubmoduleLogSink; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  return {
    calls,
    sink: {
      header(line) { calls.push({ type: 'stdout', payload: `HEADER:${line}` }); },
      stdout(line) { calls.push({ type: 'stdout', payload: line }); },
      stderr(line) { calls.push({ type: 'stderr', payload: line }); },
      done(exitCode, durationMs) { calls.push({ type: 'done', payload: { exitCode, durationMs } }); },
      error(err) { calls.push({ type: 'error', payload: err.message }); }
    }
  };
}

// Helper: spawn `node -e '<script>'` instead of git, so tests are deterministic.
function runNode(script: string, signal?: AbortSignal) {
  const { sink, calls } = recorder();
  return {
    calls,
    promise: spawnGitStreaming(
      'node',
      ['-e', script],
      { gitRoot: process.cwd(), sink, signal }
    )
  };
}

describe('spawnGitStreaming', () => {
  it('forwards stdout lines individually', async () => {
    const { promise, calls } = runNode(`process.stdout.write('one\\ntwo\\nthree\\n');`);
    const result = await promise;
    assert.strictEqual(result.exitCode, 0);
    const stdouts = calls.filter(c => c.type === 'stdout').map(c => c.payload);
    assert.deepStrictEqual(stdouts, ['one', 'two', 'three']);
  });

  it('flushes a trailing partial line on close', async () => {
    const { promise, calls } = runNode(`process.stdout.write('partial');`);
    await promise;
    const stdouts = calls.filter(c => c.type === 'stdout').map(c => c.payload);
    assert.deepStrictEqual(stdouts, ['partial']);
  });

  it('resolves with non-zero exit code without throwing', async () => {
    const { promise, calls } = runNode(`process.stderr.write('boom\\n'); process.exit(2);`);
    const result = await promise;
    assert.strictEqual(result.exitCode, 2);
    const stderrs = calls.filter(c => c.type === 'stderr').map(c => c.payload);
    assert.deepStrictEqual(stderrs, ['boom']);
  });

  it('collapses \\r-only progress segments to the final segment per chunk', async () => {
    const { promise, calls } = runNode(
      `process.stderr.write('Receiving 1%\\rReceiving 50%\\rReceiving 100%\\n');`
    );
    await promise;
    const stderrs = calls.filter(c => c.type === 'stderr').map(c => c.payload);
    assert.deepStrictEqual(stderrs, ['Receiving 100%']);
  });

  it('honors AbortSignal by killing the child', async () => {
    const controller = new AbortController();
    const { promise, calls } = runNode(
      `setInterval(() => process.stdout.write('tick\\n'), 50);`,
      controller.signal
    );
    setTimeout(() => controller.abort(), 100);
    const result = await promise;
    assert.strictEqual(result.exitCode, null);
    const doneCall = calls.find(c => c.type === 'done');
    assert.ok(doneCall, 'expected done() to be called');
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm run compile && node --require ./scripts/register-vscode-mock.js --test dist/test/submoduleStreaming.test.js`
Expected: FAIL with "Cannot find module" / "spawnGitStreaming is not a function".

- [ ] **Step 3: Implement `spawnGitStreaming`**

Add to `src/services/submoduleService.ts`, exported alongside `resolveSubmoduleCwd`:

```ts
import { SubmoduleLogSink, NULL_SINK } from './submoduleLogSink';

// Replace the top imports block to include the new ones:
// import * as cp from 'child_process';
// import * as path from 'path';
// import * as vscode from 'vscode';
// import { getConfigValue } from '../configuration';
// import { SubmoduleConfigEntry, SubmoduleEntry, SubmoduleStatusEntry, GitCommandResult } from '../types';
// import { GitCommandQueue } from './gitCommandQueue';
// import { parseSubmoduleConfig, parseSubmoduleStatus } from './submoduleParsing';
// import { SubmoduleLogSink, NULL_SINK } from './submoduleLogSink';

export interface SpawnGitStreamingOptions {
  gitRoot: string;
  cwd?: string;          // resolved via resolveSubmoduleCwd when provided
  sink: SubmoduleLogSink;
  signal?: AbortSignal;
}

export interface SpawnGitStreamingResult {
  exitCode: number | null;
}

/**
 * Spawn a git invocation with no timeout, line-buffered stdout/stderr
 * forwarded through the sink, and AbortSignal-based cancellation.
 *
 * - Never rejects on non-zero exit; caller checks exitCode.
 * - The exec name (`gitPath`) is passed explicitly so tests can substitute `node -e ...`.
 * - sink.header is NOT called by this helper — the caller writes the header so it can
 *   show the user a human-readable command line (with `--`, paths, etc.).
 */
export function spawnGitStreaming(
  execPath: string,
  args: string[],
  options: SpawnGitStreamingOptions
): Promise<SpawnGitStreamingResult> {
  const { gitRoot, cwd, sink, signal } = options;
  const fullCwd = cwd ? resolveSubmoduleCwd(gitRoot, cwd) : gitRoot;
  const startedAt = Date.now();

  return new Promise<SpawnGitStreamingResult>((resolve) => {
    let settled = false;
    const settle = (exitCode: number | null) => {
      if (settled) { return; }
      settled = true;
      sink.done(exitCode, Date.now() - startedAt);
      resolve({ exitCode });
    };

    let child: cp.ChildProcessWithoutNullStreams;
    try {
      child = cp.spawn(execPath, args, { cwd: fullCwd, windowsHide: true });
    } catch (err) {
      sink.error(err instanceof Error ? err : new Error(String(err)));
      settle(null);
      return;
    }

    const stdoutBuf = makeLineBuffer((line) => sink.stdout(line));
    const stderrBuf = makeLineBuffer((line) => sink.stderr(line));

    child.stdout.on('data', (chunk: Buffer) => stdoutBuf.push(chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => stderrBuf.push(chunk.toString()));
    child.on('error', (err: Error) => {
      sink.error(err);
      settle(null);
    });
    child.on('close', (code: number | null) => {
      stdoutBuf.flush();
      stderrBuf.flush();
      settle(code);
    });

    if (signal) {
      const abort = () => { try { child.kill(); } catch { /* already exited */ } };
      if (signal.aborted) { abort(); }
      else { signal.addEventListener('abort', abort, { once: true }); }
    }
  });
}

/**
 * Splits a stream of incoming string chunks into newline-delimited lines,
 * forwarding each completed line via `onLine`. Carriage-return-only progress
 * redraws inside a single line segment are collapsed to the last segment.
 */
function makeLineBuffer(onLine: (line: string) => void) {
  let pending = '';
  const emit = (segment: string) => {
    // segment ends at \n, so collapse \r-only redraws inside it.
    const parts = segment.split('\r');
    const last = parts[parts.length - 1];
    if (last.length > 0) { onLine(last); }
  };
  return {
    push(chunk: string) {
      pending += chunk;
      let idx = pending.indexOf('\n');
      while (idx !== -1) {
        emit(pending.slice(0, idx));
        pending = pending.slice(idx + 1);
        idx = pending.indexOf('\n');
      }
    },
    flush() {
      if (pending.length > 0) {
        emit(pending);
        pending = '';
      }
    }
  };
}
```

Inside the `SubmoduleService` class, add a private wrapper that reads `gitPath` from config and delegates:

```ts
  private spawnGitStreaming(
    args: string[],
    options: { cwd?: string; sink?: SubmoduleLogSink; signal?: AbortSignal }
  ): Promise<SpawnGitStreamingResult> {
    const gitPath = getConfigValue<string>('gitPath', 'git');
    return spawnGitStreaming(gitPath, args, {
      gitRoot: this.gitRoot,
      cwd: options.cwd,
      sink: options.sink ?? NULL_SINK,
      signal: options.signal
    });
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run compile && node --require ./scripts/register-vscode-mock.js --test dist/test/submoduleStreaming.test.js`
Expected: all five tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/submoduleService.ts src/test/submoduleStreaming.test.ts
git commit -m "feat: add spawnGitStreaming primitive with line-buffered, cancellable output"
```

---

## Task 2: Switch submodule mutating ops to the streaming path

**Goal:** Every mutating method on `SubmoduleService` (and its `GitService` pass-throughs) spawns through `spawnGitStreaming`, writes a header line, returns `{exitCode: number | null}`, and accepts `{sink?, signal?}`.

**Files:**
- Modify: `src/services/submoduleService.ts` (rewrite `initSubmodule`, `initAllSubmodules`, `updateSubmodule`, `updateAllSubmodules`, `syncSubmodule`, `deinitSubmodule`, `checkoutRecordedSubmoduleCommit`, `pullSubmoduleTrackedBranch`)
- Modify: `src/services/gitService.ts` lines ~1895-1920 (pass-through wrappers)
- Create: `src/test/submoduleService.test.ts`

**Acceptance Criteria:**
- [ ] All eight mutating methods spawn via `spawnGitStreaming`.
- [ ] Each calls `sink.header('$ git ' + args.join(' '))` before spawn.
- [ ] Each method's signature is `(…existingArgs, opts?: { sink?: SubmoduleLogSink; signal?: AbortSignal })` and returns `Promise<{exitCode: number | null}>`.
- [ ] `pullSubmoduleTrackedBranch` passes the submodule path as `cwd` (it runs git **inside** the submodule, matching the previous `runGitAt` behavior).
- [ ] Read-only methods are unmodified.
- [ ] `GitService` wrappers forward the new signatures verbatim.

**Verify:**
```
npm run check-types
npm run compile && node --require ./scripts/register-vscode-mock.js --test dist/test/submoduleService.test.js
```
Expected: both pass.

**Steps:**

- [ ] **Step 1: Write failing tests for `SubmoduleService` mutating ops**

```ts
// src/test/submoduleService.test.ts
import * as assert from 'assert';
import { describe, it } from 'node:test';
import { SubmoduleService } from '../services/submoduleService';
import type { SubmoduleLogSink } from '../services/submoduleLogSink';

interface Captured { args: string[]; cwd?: string; }

class FakeSubmoduleService extends SubmoduleService {
  readonly spawned: Captured[] = [];
  readonly headers: string[] = [];

  constructor() {
    super(
      { get: <T>(_k: string, d: T) => d } as never,
      '/repo',
      async () => ({ stdout: '', stderr: '' })
    );
  }

  // Override the private wrapper. Cast through unknown to bypass private access in tests.
  override async ['spawnGitStreaming'](
    args: string[],
    options: { cwd?: string; sink?: SubmoduleLogSink }
  ): Promise<{ exitCode: number | null }> {
    this.spawned.push({ args, cwd: options.cwd });
    return { exitCode: 0 };
  }
}

function recordingSink(): { sink: SubmoduleLogSink; lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    sink: {
      header(line) { lines.push(`H:${line}`); },
      stdout(line) { lines.push(`O:${line}`); },
      stderr(line) { lines.push(`E:${line}`); },
      done() { /* noop */ },
      error() { /* noop */ }
    }
  };
}

describe('SubmoduleService streaming ops', () => {
  it('initAllSubmodules spawns `submodule init` and writes a header', async () => {
    const svc = new FakeSubmoduleService();
    const { sink, lines } = recordingSink();
    const result = await svc.initAllSubmodules({ sink });
    assert.strictEqual(result.exitCode, 0);
    assert.deepStrictEqual(svc.spawned[0].args, ['submodule', 'init']);
    assert.ok(lines.some(l => l === 'H:$ git submodule init'));
  });

  it('updateAllSubmodules(true) adds --recursive', async () => {
    const svc = new FakeSubmoduleService();
    await svc.updateAllSubmodules(true, { sink: recordingSink().sink });
    assert.deepStrictEqual(svc.spawned[0].args, ['submodule', 'update', '--init', '--recursive']);
  });

  it('updateSubmodule passes the path after `--`', async () => {
    const svc = new FakeSubmoduleService();
    await svc.updateSubmodule('libs/foo', false, { sink: recordingSink().sink });
    assert.deepStrictEqual(svc.spawned[0].args, ['submodule', 'update', '--init', '--', 'libs/foo']);
  });

  it('syncSubmodule with no path syncs all', async () => {
    const svc = new FakeSubmoduleService();
    await svc.syncSubmodule(undefined, true, { sink: recordingSink().sink });
    assert.deepStrictEqual(svc.spawned[0].args, ['submodule', 'sync', '--recursive']);
  });

  it('deinitSubmodule honors force', async () => {
    const svc = new FakeSubmoduleService();
    await svc.deinitSubmodule('libs/foo', true, { sink: recordingSink().sink });
    assert.deepStrictEqual(svc.spawned[0].args, ['submodule', 'deinit', '-f', '--', 'libs/foo']);
  });

  it('pullSubmoduleTrackedBranch sets cwd to the submodule path', async () => {
    const svc = new FakeSubmoduleService();
    await svc.pullSubmoduleTrackedBranch('libs/foo', { sink: recordingSink().sink });
    assert.deepStrictEqual(svc.spawned[0].args, ['pull']);
    assert.strictEqual(svc.spawned[0].cwd, 'libs/foo');
  });

  it('checkoutRecordedSubmoduleCommit spawns submodule update -- <path>', async () => {
    const svc = new FakeSubmoduleService();
    await svc.checkoutRecordedSubmoduleCommit('libs/foo', { sink: recordingSink().sink });
    assert.deepStrictEqual(svc.spawned[0].args, ['submodule', 'update', '--', 'libs/foo']);
  });

  it('initSubmodule passes the path after `--`', async () => {
    const svc = new FakeSubmoduleService();
    await svc.initSubmodule('libs/foo', { sink: recordingSink().sink });
    assert.deepStrictEqual(svc.spawned[0].args, ['submodule', 'init', '--', 'libs/foo']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run compile && node --require ./scripts/register-vscode-mock.js --test dist/test/submoduleService.test.js`
Expected: FAIL (method signatures don't match yet).

- [ ] **Step 3: Rewrite the eight mutating methods in `SubmoduleService`**

Replace the existing methods (currently `initSubmodule` … `pullSubmoduleTrackedBranch`) with:

```ts
  async initSubmodule(
    submodulePath: string,
    opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
  ): Promise<SpawnGitStreamingResult> {
    const args = ['submodule', 'init', '--', submodulePath];
    opts.sink?.header(`$ git ${args.join(' ')}`);
    return this.spawnGitStreaming(args, opts);
  }

  async initAllSubmodules(
    opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
  ): Promise<SpawnGitStreamingResult> {
    const args = ['submodule', 'init'];
    opts.sink?.header(`$ git ${args.join(' ')}`);
    return this.spawnGitStreaming(args, opts);
  }

  async updateSubmodule(
    submodulePath: string,
    recursive = false,
    opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
  ): Promise<SpawnGitStreamingResult> {
    const args = ['submodule', 'update', '--init'];
    if (recursive) { args.push('--recursive'); }
    args.push('--', submodulePath);
    opts.sink?.header(`$ git ${args.join(' ')}`);
    return this.spawnGitStreaming(args, opts);
  }

  async updateAllSubmodules(
    recursive = false,
    opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
  ): Promise<SpawnGitStreamingResult> {
    const args = ['submodule', 'update', '--init'];
    if (recursive) { args.push('--recursive'); }
    opts.sink?.header(`$ git ${args.join(' ')}`);
    return this.spawnGitStreaming(args, opts);
  }

  async syncSubmodule(
    submodulePath?: string,
    recursive = false,
    opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
  ): Promise<SpawnGitStreamingResult> {
    const args = ['submodule', 'sync'];
    if (recursive) { args.push('--recursive'); }
    if (submodulePath) { args.push('--', submodulePath); }
    opts.sink?.header(`$ git ${args.join(' ')}`);
    return this.spawnGitStreaming(args, opts);
  }

  async deinitSubmodule(
    submodulePath: string,
    force = false,
    opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
  ): Promise<SpawnGitStreamingResult> {
    const args = ['submodule', 'deinit'];
    if (force) { args.push('-f'); }
    args.push('--', submodulePath);
    opts.sink?.header(`$ git ${args.join(' ')}`);
    return this.spawnGitStreaming(args, opts);
  }

  async checkoutRecordedSubmoduleCommit(
    submodulePath: string,
    opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
  ): Promise<SpawnGitStreamingResult> {
    const args = ['submodule', 'update', '--', submodulePath];
    opts.sink?.header(`$ git ${args.join(' ')}`);
    return this.spawnGitStreaming(args, opts);
  }

  async pullSubmoduleTrackedBranch(
    submodulePath: string,
    opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
  ): Promise<SpawnGitStreamingResult> {
    const args = ['pull'];
    opts.sink?.header(`$ git -C ${submodulePath} ${args.join(' ')}`);
    return this.spawnGitStreaming(args, { ...opts, cwd: submodulePath });
  }
```

- [ ] **Step 4: Update `GitService` pass-through wrappers (lines ~1895-1920)**

```ts
  async initSubmodule(
    submodulePath: string,
    opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
  ): Promise<SpawnGitStreamingResult> {
    return this.submoduleSvc.initSubmodule(submodulePath, opts);
  }

  async initAllSubmodules(
    opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
  ): Promise<SpawnGitStreamingResult> {
    return this.submoduleSvc.initAllSubmodules(opts);
  }

  async updateSubmodule(
    submodulePath: string,
    recursive = false,
    opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
  ): Promise<SpawnGitStreamingResult> {
    return this.submoduleSvc.updateSubmodule(submodulePath, recursive, opts);
  }

  async updateAllSubmodules(
    recursive = false,
    opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
  ): Promise<SpawnGitStreamingResult> {
    return this.submoduleSvc.updateAllSubmodules(recursive, opts);
  }

  async syncSubmodule(
    submodulePath?: string,
    recursive = false,
    opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
  ): Promise<SpawnGitStreamingResult> {
    return this.submoduleSvc.syncSubmodule(submodulePath, recursive, opts);
  }

  async deinitSubmodule(
    submodulePath: string,
    force = false,
    opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
  ): Promise<SpawnGitStreamingResult> {
    return this.submoduleSvc.deinitSubmodule(submodulePath, force, opts);
  }

  async checkoutRecordedSubmoduleCommit(
    submodulePath: string,
    opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
  ): Promise<SpawnGitStreamingResult> {
    return this.submoduleSvc.checkoutRecordedSubmoduleCommit(submodulePath, opts);
  }

  async pullSubmoduleTrackedBranch(
    submodulePath: string,
    opts: { sink?: SubmoduleLogSink; signal?: AbortSignal } = {}
  ): Promise<SpawnGitStreamingResult> {
    return this.submoduleSvc.pullSubmoduleTrackedBranch(submodulePath, opts);
  }
```

Add the imports at the top of `src/services/gitService.ts`:

```ts
import { SpawnGitStreamingResult } from './submoduleService';
import { SubmoduleLogSink } from './submoduleLogSink';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run compile && node --require ./scripts/register-vscode-mock.js --test dist/test/submoduleService.test.js`
Expected: all eight tests pass.

- [ ] **Step 6: Type-check the whole project**

Run: `npm run check-types`
Expected: exits 0. (The remaining call sites in `commandController.ts` will still type-check — TypeScript treats `Promise<{exitCode}>` as awaitable to a value that callers can ignore.)

- [ ] **Step 7: Commit**

```bash
git add src/services/submoduleService.ts src/services/gitService.ts src/test/submoduleService.test.ts
git commit -m "feat: route submodule mutating ops through streaming spawn"
```

---

## Task 3: Add `Logger.appendRaw` and `SubmoduleProgress` adapter in `CommandController`

**Goal:** Each `vscodeGitClient.submodule.*` mutating command now runs inside a `vscode.window.withProgress` notification, streams output into the existing channel, cancels via the notification's Cancel button, and shows a warning toast on non-zero exit.

**Files:**
- Modify: `src/logger.ts` (add `appendRaw`)
- Modify: `src/commands/commandController.ts` (add file-local `withSubmoduleProgress`; update each `submodule.*` registration; remove the existing one-shot `showInformationMessage('Updating … submodule(s)…')` toasts because the progress notification supersedes them)

**Acceptance Criteria:**
- [ ] `Logger.appendRaw(line)` writes the line verbatim (no `[info]` prefix).
- [ ] Each mutating submodule command is wrapped by `withSubmoduleProgress`.
- [ ] Bulk ops (`initAll`, `updateAll`, `updateRecursive`, `syncAll`) call `logger.show(true)` before starting.
- [ ] Per-item ops (`init`, `update`, `sync`, `deinit`, `checkoutRecorded`, `pullTrackedBranch`) do NOT auto-show.
- [ ] Notification has a Cancel button; clicking it kills the child process within ~1s.
- [ ] On non-zero exit (and not cancelled), `vscode.window.showWarningMessage` displays `"<command> failed; see Output for details."` with a `"Show Output"` action that opens the channel.
- [ ] `state.refreshSubmodules()` runs in `finally`, regardless of success / failure / cancel.
- [ ] The old `void vscode.window.showInformationMessage('Updating …')` lines are removed (progress notification replaces them).

**Verify:**
```
npm run check-types && npm run lint
```
Expected: both exit 0. (Behavioral verification is manual — covered in Task 4.)

**Steps:**

- [ ] **Step 1: Add `appendRaw` to `Logger`**

In `src/logger.ts`, add after `error(...)`:

```ts
  /** Write a line verbatim, with no severity prefix. Used for streamed git output. */
  appendRaw(line: string): void {
    this.channel.appendLine(line);
  }
```

- [ ] **Step 2: Add the `withSubmoduleProgress` helper near the top of `commandController.ts`**

Place it as a module-private function (outside the class) below the imports:

```ts
import { Logger } from '../logger';
import { SubmoduleLogSink } from '../services/submoduleLogSink';

interface WithSubmoduleProgressOptions {
  title: string;
  autoShow: boolean;
  command: string;          // human-readable name for the warning toast, e.g. "Submodule update"
}

async function withSubmoduleProgress(
  logger: Logger,
  options: WithSubmoduleProgressOptions,
  run: (args: { sink: SubmoduleLogSink; signal: AbortSignal }) => Promise<{ exitCode: number | null }>
): Promise<{ exitCode: number | null; cancelled: boolean }> {
  if (options.autoShow) {
    logger.show(true);
  }
  let cancelled = false;
  const controller = new AbortController();

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: options.title,
      cancellable: true
    },
    async (progress, token) => {
      token.onCancellationRequested(() => {
        cancelled = true;
        controller.abort();
      });

      const sink: SubmoduleLogSink = {
        header(line) { logger.appendRaw(line); },
        stdout(line) { logger.appendRaw(line); },
        stderr(line) {
          logger.appendRaw(line);
          progress.report({ message: line });
        },
        done(exitCode, durationMs) {
          const secs = (durationMs / 1000).toFixed(1);
          if (cancelled) {
            logger.appendRaw(`[cancelled after ${secs}s]`);
          } else {
            logger.appendRaw(`[done in ${secs}s, exit ${exitCode}]`);
          }
        },
        error(err) {
          logger.appendRaw(`[error] ${err.message}`);
        }
      };

      return run({ sink, signal: controller.signal });
    }
  );

  if (!cancelled && result.exitCode !== 0) {
    const action = await vscode.window.showWarningMessage(
      `${options.command} failed; see Output for details.`,
      'Show Output'
    );
    if (action === 'Show Output') {
      logger.show(true);
    }
  }

  return { exitCode: result.exitCode, cancelled };
}
```

- [ ] **Step 3: Update each `submodule.*` command registration**

Replace the eight mutating-op registrations in `commandController.ts` (lines ~2180-2335 in current source) with the versions below. Other submodule commands (`refresh`, `open`, `openInNewWindow`, `openTerminal`, `diffPointer`, `stagePointerChange`) stay unchanged.

```ts
    register('vscodeGitClient.submodule.init', async (arg?: unknown) => {
      const item = arg instanceof SubmoduleTreeItem ? arg : undefined;
      if (!item) { return; }
      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Initializing submodule ${item.submodule.path}…`,
            autoShow: false,
            command: 'Submodule init'
          },
          ({ sink, signal }) => this.git.initSubmodule(item.submodule.path, { sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });

    register('vscodeGitClient.submodule.initAll', async () => {
      const count = this.state.submodules.length;
      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Initializing ${count} submodule(s)…`,
            autoShow: true,
            command: 'Submodule init (all)'
          },
          ({ sink, signal }) => this.git.initAllSubmodules({ sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });

    register('vscodeGitClient.submodule.update', async (arg?: unknown) => {
      const item = arg instanceof SubmoduleTreeItem ? arg : undefined;
      if (!item) { return; }
      if (item.submodule.isDirty) {
        const confirmed = await confirmDangerousAction({
          title: 'Update dirty submodule',
          detail: `${item.submodule.path} has uncommitted changes.`,
          acceptLabel: 'Update anyway'
        });
        if (!confirmed) { return; }
      }
      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Updating submodule ${item.submodule.path}…`,
            autoShow: false,
            command: 'Submodule update'
          },
          ({ sink, signal }) => this.git.updateSubmodule(item.submodule.path, false, { sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });

    register('vscodeGitClient.submodule.updateAll', async () => {
      const submodules = this.state.submodules;
      const dirtyCount = submodules.filter((s) => s.isDirty).length;
      if (dirtyCount > 0) {
        const confirmed = await confirmDangerousAction({
          title: 'Update all submodules',
          detail: `${dirtyCount} submodule(s) have uncommitted changes.`,
          acceptLabel: 'Update all'
        });
        if (!confirmed) { return; }
      }
      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Updating ${submodules.length} submodule(s)…`,
            autoShow: true,
            command: 'Submodule update (all)'
          },
          ({ sink, signal }) => this.git.updateAllSubmodules(false, { sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });

    register('vscodeGitClient.submodule.updateRecursive', async () => {
      const submodules = this.state.submodules;
      const dirtyCount = submodules.filter((s) => s.isDirty).length;
      const confirmed = await confirmDangerousAction({
        title: 'Update all submodules recursively',
        detail: dirtyCount > 0
          ? `${submodules.length} submodule(s) will be updated recursively. ${dirtyCount} have uncommitted changes.`
          : `${submodules.length} submodule(s) will be updated recursively.`,
        acceptLabel: 'Update Recursive'
      });
      if (!confirmed) { return; }
      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Recursively updating ${submodules.length} submodule(s)…`,
            autoShow: true,
            command: 'Submodule update (recursive)'
          },
          ({ sink, signal }) => this.git.updateAllSubmodules(true, { sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });

    register('vscodeGitClient.submodule.sync', async (arg?: unknown) => {
      const item = arg instanceof SubmoduleTreeItem ? arg : undefined;
      if (!item) { return; }
      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Syncing submodule ${item.submodule.path}…`,
            autoShow: false,
            command: 'Submodule sync'
          },
          ({ sink, signal }) => this.git.syncSubmodule(item.submodule.path, false, { sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });

    register('vscodeGitClient.submodule.syncAll', async () => {
      const count = this.state.submodules.length;
      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Syncing ${count} submodule(s)…`,
            autoShow: true,
            command: 'Submodule sync (all)'
          },
          ({ sink, signal }) => this.git.syncSubmodule(undefined, true, { sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });

    register('vscodeGitClient.submodule.checkoutRecorded', async (arg?: unknown) => {
      const item = arg instanceof SubmoduleTreeItem ? arg : undefined;
      if (!item) { return; }
      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Checking out recorded commit for ${item.submodule.path}…`,
            autoShow: false,
            command: 'Submodule checkout recorded'
          },
          ({ sink, signal }) => this.git.checkoutRecordedSubmoduleCommit(item.submodule.path, { sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });

    register('vscodeGitClient.submodule.pullTrackedBranch', async (arg?: unknown) => {
      const item = arg instanceof SubmoduleTreeItem ? arg : undefined;
      if (!item) { return; }
      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Pulling tracked branch in ${item.submodule.path}…`,
            autoShow: false,
            command: 'Submodule pull'
          },
          ({ sink, signal }) => this.git.pullSubmoduleTrackedBranch(item.submodule.path, { sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });

    register('vscodeGitClient.submodule.deinit', async (arg?: unknown) => {
      const item = arg instanceof SubmoduleTreeItem ? arg : undefined;
      if (!item) { return; }
      if (item.submodule.isDirty) {
        const confirmed = await confirmDangerousAction({
          title: 'Deinit dirty submodule',
          detail: `${item.submodule.path} has uncommitted changes that will be lost.`,
          acceptLabel: 'Deinit'
        });
        if (!confirmed) { return; }
      } else {
        const confirmed = await confirmDangerousAction({
          title: 'Deinit submodule',
          detail: `This will remove ${item.submodule.path} from the working tree.`,
          acceptLabel: 'Deinit'
        });
        if (!confirmed) { return; }
      }
      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Deiniting submodule ${item.submodule.path}…`,
            autoShow: false,
            command: 'Submodule deinit'
          },
          ({ sink, signal }) => this.git.deinitSubmodule(item.submodule.path, item.submodule.isDirty, { sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });
```

Note: the previous one-shot `void vscode.window.showInformationMessage('Updating … submodule(s)…')` toasts in `updateAll` / `updateRecursive` are intentionally removed — the progress notification supersedes them.

- [ ] **Step 4: Run check-types + lint**

Run: `npm run check-types && npm run lint`
Expected: exits 0.

- [ ] **Step 5: Run the test suite to confirm no regressions**

Run: `npm test`
Expected: all tests pass (existing tests + the two new ones added in Tasks 1 and 2).

- [ ] **Step 6: Commit**

```bash
git add src/logger.ts src/commands/commandController.ts
git commit -m "feat: stream submodule init/update output to Output channel with progress + cancel"
```

---

## Task 4: Manual smoke verification (Extension Development Host)

**Goal:** Confirm the user-facing behavior matches the spec on a real repo with submodules.

**Files:** (none — manual verification only)

**Acceptance Criteria:**
- [ ] On a repo with ≥2 submodules, "Update All Submodules" auto-reveals the `VS Code Git Client` Output channel, shows a progress notification with title "Updating N submodule(s)…" and a Cancel button.
- [ ] The Output channel contains `$ git submodule update --init` header, live progress lines from git, and a final `[done in Ns, exit 0]` (or non-zero) line.
- [ ] Per-submodule "Update submodule" runs without auto-showing the channel; the notification still appears.
- [ ] Clicking Cancel mid-update kills the git process within ~1s, the channel shows `[cancelled after Ns]`, and the Submodules tree refreshes.
- [ ] Forcing a failure (e.g. with a known-bad submodule URL) produces a `[done in Ns, exit <non-zero>]` line and a warning toast `"Submodule update (all) failed; see Output for details."` with a `"Show Output"` action.
- [ ] No 15-second timeout error appears for slow init/update operations.

**Verify:**

```bash
# In a scratch directory with multiple submodules:
git clone --recurse-submodules=false <repo-with-submodules> /tmp/smoke-test
code --extensionDevelopmentPath=$PWD /tmp/smoke-test
```

Then in the Extension Development Host:
1. Open the Submodules view in the activity bar.
2. Run "Update All Submodules" from the view title menu.
3. Observe the progress notification + Output channel.
4. Repeat with a manually-introduced broken submodule URL (`git config --file .gitmodules submodule.<name>.url https://invalid.example/x.git && git submodule sync`).

**Steps:**

- [ ] **Step 1: Launch Extension Development Host** with a repo that has multiple submodules.

- [ ] **Step 2: Walk the acceptance criteria above**, ticking each as you verify.

- [ ] **Step 3: If any criterion fails**, file the discrepancy and return to Task 3 to fix.

- [ ] **Step 4: No commit** for this task — verification only.

---

## Task 5: Update CHANGELOG and README

**Goal:** Document the user-visible behavior change.

**Files:**
- Modify: `CHANGELOG.md` (add entry under `[Unreleased] → Changed`)
- Modify: `README.md` (one-line note in `Manage Submodules` section)

**Acceptance Criteria:**
- [ ] `CHANGELOG.md` has a bullet describing streamed output + Cancel + Output channel + removal of the 15s timeout for these ops.
- [ ] `README.md`'s `Manage Submodules` section mentions the Output channel for long-running operations.

**Verify:**
```
git diff CHANGELOG.md README.md
```
Expected: changes confined to the documented sections.

**Steps:**

- [ ] **Step 1: Add CHANGELOG entry**

In `CHANGELOG.md`, under `## [Unreleased]` → `### Changed`, append:

```markdown
- **Submodule operations stream output and can be cancelled** — `Init`, `Update`, `Update Recursive`, `Sync`, `Deinit`, `Checkout Recorded`, and `Pull Tracked Branch` now run with no fixed timeout and stream `git` output live to the `VS Code Git Client` Output channel. A VS Code progress notification with a `Cancel` button drives each operation; cancelling kills the running `git` child process. Bulk operations (`Init All`, `Update All`, `Update Recursive`, `Sync All`) auto-reveal the Output channel; per-submodule operations stream silently. On non-zero exit, a warning toast offers a `Show Output` action to jump to the log.
```

- [ ] **Step 2: Add README note**

In `README.md`, find the `### Manage Submodules` section. After the bullet list of available actions (after the `- Deinit a submodule.` line), insert:

```markdown

Long-running submodule operations (`Init All`, `Update All`, `Update Recursive`) stream `git` output live to the **VS Code Git Client** Output channel and can be cancelled from the progress notification. Per-submodule operations also stream to the channel; click `Show Output` on any failure toast to jump to the log.
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md README.md
git commit -m "docs: note streaming submodule output in CHANGELOG and README"
```

---

## Self-Review Summary

- **Spec coverage:** Every section of the spec (scope, components, data flow, error handling, testing, docs) is covered by Tasks 0-5. The "manual smoke checks" section of the spec is Task 4.
- **No placeholders:** All code blocks contain real, runnable code. All file paths are absolute or repo-relative. All test code uses real assertions.
- **Type consistency:** `SpawnGitStreamingResult = { exitCode: number | null }` is used everywhere — `spawnGitStreaming` returns it, all eight mutating methods return it, all `GitService` wrappers return it, `withSubmoduleProgress` consumes it. Method signatures match across the service, wrapper, and command-controller layers.
- **Open risks:** Test in Task 1 uses `node -e` instead of `git`, so it doesn't exercise git's real progress output format. This is intentional — git's output behavior is the user's git binary's responsibility, not ours; we test our line-buffering and abort semantics. Real progress output is covered by Task 4's manual checks.
