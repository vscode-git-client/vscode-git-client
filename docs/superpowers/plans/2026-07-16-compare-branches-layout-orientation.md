# Compare Branches — Horizontal/Vertical Layout Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Horizontal/Vertical layout toggle (styled like the existing List/Graph toggle) to Compare Branches List mode, defaulting to vertical but configurable via a new extension setting, with the user's in-session choice persisted per workspace.

**Architecture:** Mirror the existing `CompareViewMode` pattern end-to-end: a new `CompareLayoutOrientation` type + `CompareLayoutOrientationStore` interface in `compareView.ts`, a `getCompareLayoutOrientation`/`setCompareLayoutOrientation` pair on `StateStore` backed by `workspaceState` (with a settings-based fallback the mode getter doesn't have), a new webview→host message (`setCompareLayout`), and template/CSS additions reusing the `.mode-toggle` component style. Graph mode is untouched — the new toggle only renders inside the existing `{{#if isListMode}}` block.

**Tech Stack:** TypeScript, VS Code Webview API, Handlebars templates, Node's built-in `node:test` runner.

**Design doc:** `docs/superpowers/specs/2026-07-16-compare-branches-layout-orientation-design.md`

---

### Task 1: Add `CompareLayoutOrientationKey` command constant and the `listLayout` setting

**Goal:** Register the workspaceState key and the extension setting the rest of the feature depends on.

**Files:**
- Modify: `src/config/commands.ts:156-158`
- Modify: `package.json:1238-1246`

**Acceptance Criteria:**
- [ ] `GitCommand.CompareLayoutOrientationKey` exists and equals `'vscodeGitClient.compareLayoutOrientation'`.
- [ ] `package.json` declares `vscodeGitClient.compare.listLayout` as a string enum (`vertical`/`horizontal`), default `vertical`.
- [ ] `npm run compile` succeeds (confirms `package.json` is valid JSON and TS still compiles).

**Verify:** `npm run compile` → exits 0 with no errors.

**Steps:**

- [ ] **Step 1: Add the new `GitCommand` enum member**

In `src/config/commands.ts`, the enum currently ends with:

```ts
  // State keys
  ChangelistsStateKey = 'vscodeGitClient.changelists',
  RecentComparePairsKey = 'vscodeGitClient.recentComparePairs',
  CompareViewModeKey = 'vscodeGitClient.compareViewMode'
}
```

Change the last two lines to:

```ts
  // State keys
  ChangelistsStateKey = 'vscodeGitClient.changelists',
  RecentComparePairsKey = 'vscodeGitClient.recentComparePairs',
  CompareViewModeKey = 'vscodeGitClient.compareViewMode',
  CompareLayoutOrientationKey = 'vscodeGitClient.compareLayoutOrientation'
}
```

- [ ] **Step 2: Add the `vscodeGitClient.compare.listLayout` setting**

In `package.json`, immediately after the `vscodeGitClient.compare.exportFormat` block (currently lines 1238-1246):

```json
        "vscodeGitClient.compare.exportFormat": {
          "type": "string",
          "enum": [
            "csv",
            "excel"
          ],
          "default": "csv",
          "description": "Default export format for Compare Branches webview. CSV exports two branch-specific files; Excel exports one .xlsx with two sheets."
        },
```

add a new sibling entry directly after it:

```json
        "vscodeGitClient.compare.listLayout": {
          "type": "string",
          "enum": [
            "vertical",
            "horizontal"
          ],
          "default": "vertical",
          "description": "Default pane layout for Compare Branches List mode. vertical stacks the two branches' commit tables; horizontal places them side by side. Only used as the initial value for a workspace — once you use the Vertical/Horizontal toggle in the webview, that choice persists for the workspace."
        },
```

- [ ] **Step 3: Verify compile**

Run: `npm run compile`
Expected: exits 0, no TypeScript or JSON errors.

- [ ] **Step 4: Commit**

```bash
git add src/config/commands.ts package.json
git commit -m "feat: add compareLayoutOrientation state key and listLayout setting"
```

---

### Task 2: Add `CompareLayoutOrientation` get/set to `StateStore`

**Goal:** `StateStore` can read the persisted layout orientation (falling back to the `compare.listLayout` setting when unset) and persist a new choice.

**Files:**
- Modify: `src/state/stateStore.ts:26-30` (constants/type) and `:618-626` (methods)
- Test: `src/test/stateStoreCompareLayout.test.ts` (new)

**Acceptance Criteria:**
- [ ] `export type CompareLayoutOrientation = 'vertical' | 'horizontal';` declared in `stateStore.ts`.
- [ ] `getCompareLayoutOrientation()` returns the workspaceState value when present, otherwise falls back to `getConfigValue('compare.listLayout', 'vertical')`.
- [ ] `setCompareLayoutOrientation(orientation)` persists to workspaceState under `GitCommand.CompareLayoutOrientationKey`.
- [ ] New test file passes.

**Verify:** `npm test` → all tests pass, including the 3 new cases in `stateStoreCompareLayout.test.ts`.

**Steps:**

- [ ] **Step 1: Write the failing tests**

Create `src/test/stateStoreCompareLayout.test.ts`:

```ts
import * as assert from 'assert';
import { describe, it } from 'node:test';
import * as vscode from 'vscode';
import { StateStore } from '../state/stateStore';

function makeStubGit(): unknown {
  return {
    isRepo: async () => true,
    getLocalBranches: async () => [],
    getRemoteBranches: async () => [],
    getTagsBasic: async () => [],
    getTagAvailability: async () => new Map(),
    getStashes: async () => [],
    getWorkingTreeChanges: async () => [],
    getMergeConflicts: async () => [],
    getGraph: async () => [],
    getWorktrees: async () => [],
    getSubmodules: async () => []
  };
}

function makeLogger(): unknown {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
    dispose: () => undefined
  };
}

function makeWorkspaceState(): vscode.Memento {
  const data = new Map<string, unknown>();
  return {
    keys: () => Array.from(data.keys()) as readonly string[],
    get: <T>(key: string, defaultValue?: T): T | undefined =>
      data.has(key) ? (data.get(key) as T) : defaultValue,
    update: async (key: string, value: unknown) => {
      data.set(key, value);
    }
  } as vscode.Memento;
}

describe('StateStore compare layout orientation', () => {
  it('falls back to the vertical default when no workspaceState value is set', () => {
    const store = new StateStore(
      makeStubGit() as never,
      makeLogger() as never,
      { get: () => undefined } as never,
      makeWorkspaceState()
    );

    assert.strictEqual(store.getCompareLayoutOrientation(), 'vertical');
  });

  it('persists an explicit orientation across get calls', async () => {
    const store = new StateStore(
      makeStubGit() as never,
      makeLogger() as never,
      { get: () => undefined } as never,
      makeWorkspaceState()
    );

    await store.setCompareLayoutOrientation('horizontal');

    assert.strictEqual(store.getCompareLayoutOrientation(), 'horizontal');
  });

  it('normalizes an unexpected stored value back to vertical', async () => {
    const workspaceState = makeWorkspaceState();
    const store = new StateStore(
      makeStubGit() as never,
      makeLogger() as never,
      { get: () => undefined } as never,
      workspaceState
    );

    await workspaceState.update('vscodeGitClient.compareLayoutOrientation', 'sideways');

    assert.strictEqual(store.getCompareLayoutOrientation(), 'vertical');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Property 'getCompareLayoutOrientation' does not exist on type 'StateStore'` (TypeScript compile error from `npm run compile` inside `npm test`).

- [ ] **Step 3: Add the type, constant, and methods**

In `src/state/stateStore.ts`, change:

```ts
const RECENT_COMPARE_PAIRS_KEY = GitCommand.RecentComparePairsKey;
const LEGACY_RECENT_COMPARE_PAIRS_KEY = 'intelliGit.recentComparePairs';
const COMPARE_VIEW_MODE_KEY = GitCommand.CompareViewModeKey;

export type CompareViewMode = 'list' | 'graph';
```

to:

```ts
const RECENT_COMPARE_PAIRS_KEY = GitCommand.RecentComparePairsKey;
const LEGACY_RECENT_COMPARE_PAIRS_KEY = 'intelliGit.recentComparePairs';
const COMPARE_VIEW_MODE_KEY = GitCommand.CompareViewModeKey;
const COMPARE_LAYOUT_ORIENTATION_KEY = GitCommand.CompareLayoutOrientationKey;

export type CompareViewMode = 'list' | 'graph';
export type CompareLayoutOrientation = 'vertical' | 'horizontal';
```

Then, in the same file, change:

```ts
  getCompareViewMode(): CompareViewMode {
    const raw = this.workspaceState.get<string>(COMPARE_VIEW_MODE_KEY, 'list');
    return raw === 'graph' ? 'graph' : 'list';
  }

  async setCompareViewMode(mode: CompareViewMode): Promise<void> {
    await this.workspaceState.update(COMPARE_VIEW_MODE_KEY, mode);
  }
}
```

to:

```ts
  getCompareViewMode(): CompareViewMode {
    const raw = this.workspaceState.get<string>(COMPARE_VIEW_MODE_KEY, 'list');
    return raw === 'graph' ? 'graph' : 'list';
  }

  async setCompareViewMode(mode: CompareViewMode): Promise<void> {
    await this.workspaceState.update(COMPARE_VIEW_MODE_KEY, mode);
  }

  getCompareLayoutOrientation(): CompareLayoutOrientation {
    const defaultOrientation = getConfigValue<string>('compare.listLayout', 'vertical');
    const fallback: CompareLayoutOrientation = defaultOrientation === 'horizontal' ? 'horizontal' : 'vertical';
    const raw = this.workspaceState.get<string>(COMPARE_LAYOUT_ORIENTATION_KEY, fallback);
    return raw === 'horizontal' ? 'horizontal' : 'vertical';
  }

  async setCompareLayoutOrientation(orientation: CompareLayoutOrientation): Promise<void> {
    await this.workspaceState.update(COMPARE_LAYOUT_ORIENTATION_KEY, orientation);
  }
}
```

`getConfigValue` is already imported at the top of this file (`import { getConfigValue } from '../configuration';`), so no new import is needed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests including the 3 new `StateStore compare layout orientation` cases.

- [ ] **Step 5: Commit**

```bash
git add src/state/stateStore.ts src/test/stateStoreCompareLayout.test.ts
git commit -m "feat: add CompareLayoutOrientation getter/setter to StateStore"
```

---

### Task 3: Add `CompareLayoutOrientation` support to `CompareView`

**Goal:** `CompareView` accepts a `layoutStore`, threads the orientation into the rendered template data, and handles the new `setCompareLayout` message from the webview.

**Files:**
- Modify: `src/views/compareView.ts:10-15` (types), `:59-77` (messages/union), `:84-113` (constructor), `:127-146` (render/rerender), `:167-171` (handleMessage), `:374-400` (renderCompareHtml), `:611-619` (type guards)

**Acceptance Criteria:**
- [ ] `CompareLayoutOrientation`, `CompareLayoutOrientationStore`, `SetCompareLayoutMessage`, `isSetCompareLayoutMessage` are exported/declared.
- [ ] `CompareView` constructor takes a 5th parameter `layoutStore: CompareLayoutOrientationStore`.
- [ ] `renderCompareHtml` template data includes `orientation` and `isHorizontalLayout`.
- [ ] `handleMessage` persists `setCompareLayout` messages via `layoutStore.setCompareLayoutOrientation` and rerenders.
- [ ] `npm run compile` succeeds (this task alone will not compile cleanly until Task 5 updates the constructor call site — run `npm run compile` again after Task 5, but confirm no *new* errors are introduced beyond the expected constructor-arity mismatch at the `ensureCompareView()` call site).

**Verify:** `npx tsc --noEmit -p .` → only pre-existing/expected error is the `CompareView` constructor call in `editorOrchestrator.ts` needing a 4th argument (fixed in Task 5).

**Steps:**

- [ ] **Step 1: Add the new type and store interface**

In `src/views/compareView.ts`, change:

```ts
export type CompareViewMode = 'list' | 'graph';

export interface CompareViewModeStore {
  getCompareViewMode(): CompareViewMode;
  setCompareViewMode(mode: CompareViewMode): Promise<void>;
}
```

to:

```ts
export type CompareViewMode = 'list' | 'graph';

export interface CompareViewModeStore {
  getCompareViewMode(): CompareViewMode;
  setCompareViewMode(mode: CompareViewMode): Promise<void>;
}

export type CompareLayoutOrientation = 'vertical' | 'horizontal';

export interface CompareLayoutOrientationStore {
  getCompareLayoutOrientation(): CompareLayoutOrientation;
  setCompareLayoutOrientation(orientation: CompareLayoutOrientation): Promise<void>;
}
```

- [ ] **Step 2: Add the new message type and extend the union**

Change:

```ts
interface SetCompareModeMessage {
  readonly type: 'setCompareMode';
  readonly mode: CompareViewMode;
}
```

to:

```ts
interface SetCompareModeMessage {
  readonly type: 'setCompareMode';
  readonly mode: CompareViewMode;
}

interface SetCompareLayoutMessage {
  readonly type: 'setCompareLayout';
  readonly orientation: CompareLayoutOrientation;
}
```

Change:

```ts
type IncomingMessage =
  | CommitClickMessage
  | CommitRangeClickMessage
  | ExportCompareMessage
  | RefreshMessage
  | RefreshCompleteMessage
  | SetCompareModeMessage
  | SelectionChangeMessage;
```

to:

```ts
type IncomingMessage =
  | CommitClickMessage
  | CommitRangeClickMessage
  | ExportCompareMessage
  | RefreshMessage
  | RefreshCompleteMessage
  | SetCompareModeMessage
  | SetCompareLayoutMessage
  | SelectionChangeMessage;
```

- [ ] **Step 3: Add the constructor parameter**

Change:

```ts
  constructor(
    private readonly onCommitClick: (sha: string, subject: string) => Promise<void>,
    private readonly onCommitRangeClick: (selection: CompareCommitRangeSelection) => Promise<void>,
    private readonly modeStore: CompareViewModeStore,
    private readonly onRefresh: (leftRef: string, rightRef: string) => Promise<void>
  ) {
```

to:

```ts
  constructor(
    private readonly onCommitClick: (sha: string, subject: string) => Promise<void>,
    private readonly onCommitRangeClick: (selection: CompareCommitRangeSelection) => Promise<void>,
    private readonly modeStore: CompareViewModeStore,
    private readonly layoutStore: CompareLayoutOrientationStore,
    private readonly onRefresh: (leftRef: string, rightRef: string) => Promise<void>
  ) {
```

- [ ] **Step 4: Pass orientation into `renderCompareHtml` from `render`/`rerender`**

Change:

```ts
  render(result: CompareResult): void {
    this.currentResult = result;
    this.panel.title = `Compare ${result.leftRef} <> ${result.rightRef}`;
    this.panel.webview.html = renderCompareHtml(
      result,
      this.getCompareExportFormat(),
      this.modeStore.getCompareViewMode()
    );
  }

  private rerender(): void {
    if (!this.currentResult) {
      return;
    }
    this.panel.webview.html = renderCompareHtml(
      this.currentResult,
      this.getCompareExportFormat(),
      this.modeStore.getCompareViewMode()
    );
  }
```

to:

```ts
  render(result: CompareResult): void {
    this.currentResult = result;
    this.panel.title = `Compare ${result.leftRef} <> ${result.rightRef}`;
    this.panel.webview.html = renderCompareHtml(
      result,
      this.getCompareExportFormat(),
      this.modeStore.getCompareViewMode(),
      this.layoutStore.getCompareLayoutOrientation()
    );
  }

  private rerender(): void {
    if (!this.currentResult) {
      return;
    }
    this.panel.webview.html = renderCompareHtml(
      this.currentResult,
      this.getCompareExportFormat(),
      this.modeStore.getCompareViewMode(),
      this.layoutStore.getCompareLayoutOrientation()
    );
  }
```

- [ ] **Step 5: Handle the new message in `handleMessage`**

Change:

```ts
    if (isSetCompareModeMessage(message)) {
      await this.modeStore.setCompareViewMode(message.mode);
      this.rerender();
      return;
    }
```

to:

```ts
    if (isSetCompareModeMessage(message)) {
      await this.modeStore.setCompareViewMode(message.mode);
      this.rerender();
      return;
    }

    if (isSetCompareLayoutMessage(message)) {
      await this.layoutStore.setCompareLayoutOrientation(message.orientation);
      this.rerender();
      return;
    }
```

- [ ] **Step 6: Update `renderCompareHtml` signature and template data**

Change:

```ts
function renderCompareHtml(
  result: CompareResult,
  exportFormat: CompareExportFormat,
  mode: CompareViewMode
): string {
  const graphData = mode === 'graph' ? buildGraphRenderData(result) : undefined;
  return renderTemplate('compareView.hbs', {
    leftRef: result.leftRef,
    leftTotal: result.commitsOnlyLeft.length,
    leftCommits: renderCommitRows(result.commitsOnlyLeft, 'left'),
    rightRef: result.rightRef,
    rightTotal: result.commitsOnlyRight.length,
    rightCommits: renderCommitRows(result.commitsOnlyRight, 'right'),
    authorsJson: toInlineJson(
      collectDistinctAuthors(result.commitsOnlyLeft, result.commitsOnlyRight)
    ),
    exportFormat,
    exportButtonLabel: exportFormat === 'excel' ? 'Export Excel' : 'Export CSV',
    mode,
    isListMode: mode === 'list',
    isGraphMode: mode === 'graph',
    graphSvg: graphData ? graphData.svg : '',
    graphRows: graphData ? graphData.rows : '',
    graphSvgHeight: graphData ? graphData.svgHeight : 0,
    graphMergeBaseShort: result.mergeBase ? result.mergeBase.shortSha : ''
  });
}
```

to:

```ts
function renderCompareHtml(
  result: CompareResult,
  exportFormat: CompareExportFormat,
  mode: CompareViewMode,
  orientation: CompareLayoutOrientation
): string {
  const graphData = mode === 'graph' ? buildGraphRenderData(result) : undefined;
  return renderTemplate('compareView.hbs', {
    leftRef: result.leftRef,
    leftTotal: result.commitsOnlyLeft.length,
    leftCommits: renderCommitRows(result.commitsOnlyLeft, 'left'),
    rightRef: result.rightRef,
    rightTotal: result.commitsOnlyRight.length,
    rightCommits: renderCommitRows(result.commitsOnlyRight, 'right'),
    authorsJson: toInlineJson(
      collectDistinctAuthors(result.commitsOnlyLeft, result.commitsOnlyRight)
    ),
    exportFormat,
    exportButtonLabel: exportFormat === 'excel' ? 'Export Excel' : 'Export CSV',
    mode,
    isListMode: mode === 'list',
    isGraphMode: mode === 'graph',
    orientation,
    isHorizontalLayout: orientation === 'horizontal',
    graphSvg: graphData ? graphData.svg : '',
    graphRows: graphData ? graphData.rows : '',
    graphSvgHeight: graphData ? graphData.svgHeight : 0,
    graphMergeBaseShort: result.mergeBase ? result.mergeBase.shortSha : ''
  });
}
```

- [ ] **Step 7: Add the `isSetCompareLayoutMessage` type guard**

Change:

```ts
function isSetCompareModeMessage(value: unknown): value is SetCompareModeMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === 'setCompareMode' && (candidate.mode === 'list' || candidate.mode === 'graph')
  );
}
```

to:

```ts
function isSetCompareModeMessage(value: unknown): value is SetCompareModeMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === 'setCompareMode' && (candidate.mode === 'list' || candidate.mode === 'graph')
  );
}

function isSetCompareLayoutMessage(value: unknown): value is SetCompareLayoutMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === 'setCompareLayout' &&
    (candidate.orientation === 'vertical' || candidate.orientation === 'horizontal')
  );
}
```

- [ ] **Step 8: Verify (expect one known error until Task 5)**

Run: `npx tsc --noEmit -p .`
Expected: exactly one error, at `src/editor/editorOrchestrator.ts`'s `new CompareView(...)` call, reporting an argument-count mismatch (missing `layoutStore`). No other errors. This is fixed in Task 5.

- [ ] **Step 9: Commit**

```bash
git add src/views/compareView.ts
git commit -m "feat: thread CompareLayoutOrientation through CompareView"
```

---

### Task 4: Wire `layoutStore` into `EditorOrchestrator.ensureCompareView()`

**Goal:** Resolve the compile error from Task 3 by supplying the new constructor argument backed by `StateStore`.

**Files:**
- Modify: `src/editor/editorOrchestrator.ts:331-359`

**Acceptance Criteria:**
- [ ] `ensureCompareView()` passes a `layoutStore` object literal delegating to `this.state.getCompareLayoutOrientation`/`setCompareLayoutOrientation`.
- [ ] `npx tsc --noEmit -p .` reports zero errors.

**Verify:** `npx tsc --noEmit -p .` → exits 0, no errors.

**Steps:**

- [ ] **Step 1: Add the new constructor argument**

Change:

```ts
  private ensureCompareView(): CompareView {
    if (!this.compareView) {
      this.compareView = new CompareView(
        async (sha, subject) => {
          if (this.commitFilesView.isShowingCommit(sha)) {
            await this.commitFilesView.clear();
            return;
          }
          await this.commitFilesView.showCommit(sha, subject);
        },
        async (selection) => {
          await this.openCompareCommitRangeDetails(selection);
        },
        {
          getCompareViewMode: () => this.state.getCompareViewMode(),
          setCompareViewMode: (mode) => this.state.setCompareViewMode(mode)
        },
        async (leftRef, rightRef) => {
          const result = await this.state.compareBranches(leftRef, rightRef);
          this.compareView?.render(result);
        }
      );
      this.compareView.onDispose(() => {
        void this.commitFilesView.clear();
        this.compareView = undefined;
      });
    }
    return this.compareView;
  }
```

to:

```ts
  private ensureCompareView(): CompareView {
    if (!this.compareView) {
      this.compareView = new CompareView(
        async (sha, subject) => {
          if (this.commitFilesView.isShowingCommit(sha)) {
            await this.commitFilesView.clear();
            return;
          }
          await this.commitFilesView.showCommit(sha, subject);
        },
        async (selection) => {
          await this.openCompareCommitRangeDetails(selection);
        },
        {
          getCompareViewMode: () => this.state.getCompareViewMode(),
          setCompareViewMode: (mode) => this.state.setCompareViewMode(mode)
        },
        {
          getCompareLayoutOrientation: () => this.state.getCompareLayoutOrientation(),
          setCompareLayoutOrientation: (orientation) =>
            this.state.setCompareLayoutOrientation(orientation)
        },
        async (leftRef, rightRef) => {
          const result = await this.state.compareBranches(leftRef, rightRef);
          this.compareView?.render(result);
        }
      );
      this.compareView.onDispose(() => {
        void this.commitFilesView.clear();
        this.compareView = undefined;
      });
    }
    return this.compareView;
  }
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/editor/editorOrchestrator.ts
git commit -m "feat: wire compareLayoutOrientation store into ensureCompareView"
```

---

### Task 5: Add the Vertical/Horizontal toggle and CSS/JS to `compareView.hbs`

**Goal:** Render a second `.mode-toggle` button group (List mode only) and make the `.grid` layout respond to `isHorizontalLayout`.

**Files:**
- Modify: `src/views/templates/compareView.hbs:5-12` (CSS), `:296-304` (HTML), `:306-312` (grid class), `:974-984` (JS)

**Acceptance Criteria:**
- [ ] `.grid.horizontal { flex-direction: row; }` CSS rule added.
- [ ] `<div class="grid...">` applies `horizontal` class when `isHorizontalLayout` is true.
- [ ] A second `.mode-toggle` group (`layout-toggle-vertical` / `layout-toggle-horizontal`) renders only when `isListMode`, with correct `active`/`aria-selected` state.
- [ ] Clicking a layout button posts `{ type: 'setCompareLayout', orientation }` only when different from the current server-rendered orientation (mirrors `sendModeChange`).
- [ ] `npm run compile` succeeds (template is copied verbatim by `copy-templates.js`, but this confirms no syntax typos break the build).

**Verify:** `npm run compile` → exits 0. Manual smoke test in Task 6 confirms visual behavior.

**Steps:**

- [ ] **Step 1: Add the `.grid.horizontal` CSS rule**

Change:

```hbs
    .grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
      flex: 2;
      min-height: 0;
      margin-bottom: 16px;
    }
```

to:

```hbs
    .grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
      flex: 2;
      min-height: 0;
      margin-bottom: 16px;
    }
    .grid.horizontal {
      flex-direction: row;
    }
```

- [ ] **Step 2: Add the second `.mode-toggle` group after the List/Graph toggle**

Change:

```hbs
      <div class="filter-options-actions">
        <div class="mode-toggle" role="tablist" aria-label="Compare view mode">
          <button id="mode-toggle-list" type="button" role="tab" aria-selected="{{#if isListMode}}true{{else}}false{{/if}}" class="{{#if isListMode}}active{{/if}}" data-mode="list">List</button>
          <button id="mode-toggle-graph" type="button" role="tab" aria-selected="{{#if isGraphMode}}true{{else}}false{{/if}}" class="{{#if isGraphMode}}active{{/if}}" data-mode="graph">Graph</button>
        </div>
        <button id="btn-refresh" type="button" title="Refresh" aria-label="Refresh"><span class="refresh-icon">⟳</span></button>
        <button id="filter-export-excel" class="filter-export" type="button" title="{{exportButtonLabel}}">{{exportButtonLabel}}</button>
      </div>
```

to:

```hbs
      <div class="filter-options-actions">
        <div class="mode-toggle" role="tablist" aria-label="Compare view mode">
          <button id="mode-toggle-list" type="button" role="tab" aria-selected="{{#if isListMode}}true{{else}}false{{/if}}" class="{{#if isListMode}}active{{/if}}" data-mode="list">List</button>
          <button id="mode-toggle-graph" type="button" role="tab" aria-selected="{{#if isGraphMode}}true{{else}}false{{/if}}" class="{{#if isGraphMode}}active{{/if}}" data-mode="graph">Graph</button>
        </div>
        {{#if isListMode}}
        <div class="mode-toggle" role="tablist" aria-label="Compare pane layout">
          <button id="layout-toggle-vertical" type="button" role="tab" aria-selected="{{#unless isHorizontalLayout}}true{{else}}false{{/unless}}" class="{{#unless isHorizontalLayout}}active{{/unless}}" data-layout="vertical">Vertical</button>
          <button id="layout-toggle-horizontal" type="button" role="tab" aria-selected="{{#if isHorizontalLayout}}true{{else}}false{{/if}}" class="{{#if isHorizontalLayout}}active{{/if}}" data-layout="horizontal">Horizontal</button>
        </div>
        {{/if}}
        <button id="btn-refresh" type="button" title="Refresh" aria-label="Refresh"><span class="refresh-icon">⟳</span></button>
        <button id="filter-export-excel" class="filter-export" type="button" title="{{exportButtonLabel}}">{{exportButtonLabel}}</button>
      </div>
```

- [ ] **Step 3: Apply the `horizontal` class to the grid**

Change:

```hbs
  {{#if isListMode}}
  <div class="grid">
    {{> partials/compareCommitTable side="left" total=leftTotal ref=leftRef rows=leftCommits}}

    {{> partials/compareCommitTable side="right" total=rightTotal ref=rightRef rows=rightCommits}}
  </div>
  {{/if}}
```

to:

```hbs
  {{#if isListMode}}
  <div class="grid{{#if isHorizontalLayout}} horizontal{{/if}}">
    {{> partials/compareCommitTable side="left" total=leftTotal ref=leftRef rows=leftCommits}}

    {{> partials/compareCommitTable side="right" total=rightTotal ref=rightRef rows=rightCommits}}
  </div>
  {{/if}}
```

- [ ] **Step 4: Add JS element lookups and the click-handler wiring**

Change:

```hbs
    const compareViewMode = '{{mode}}';
    const isGraphMode = compareViewMode === 'graph';
    const modeToggleListBtn = document.getElementById('mode-toggle-list');
    const modeToggleGraphBtn = document.getElementById('mode-toggle-graph');
```

to:

```hbs
    const compareViewMode = '{{mode}}';
    const isGraphMode = compareViewMode === 'graph';
    const compareLayoutOrientation = '{{orientation}}';
    const modeToggleListBtn = document.getElementById('mode-toggle-list');
    const modeToggleGraphBtn = document.getElementById('mode-toggle-graph');
    const layoutToggleVerticalBtn = document.getElementById('layout-toggle-vertical');
    const layoutToggleHorizontalBtn = document.getElementById('layout-toggle-horizontal');
```

Then change:

```hbs
    const sendModeChange = (mode) => {
      if (mode !== compareViewMode) {
        vscode.postMessage({ type: 'setCompareMode', mode });
      }
    };
    if (modeToggleListBtn) {
      modeToggleListBtn.addEventListener('click', () => sendModeChange('list'));
    }
    if (modeToggleGraphBtn) {
      modeToggleGraphBtn.addEventListener('click', () => sendModeChange('graph'));
    }
  </script>
```

to:

```hbs
    const sendModeChange = (mode) => {
      if (mode !== compareViewMode) {
        vscode.postMessage({ type: 'setCompareMode', mode });
      }
    };
    if (modeToggleListBtn) {
      modeToggleListBtn.addEventListener('click', () => sendModeChange('list'));
    }
    if (modeToggleGraphBtn) {
      modeToggleGraphBtn.addEventListener('click', () => sendModeChange('graph'));
    }
    const sendLayoutChange = (orientation) => {
      if (orientation !== compareLayoutOrientation) {
        vscode.postMessage({ type: 'setCompareLayout', orientation });
      }
    };
    if (layoutToggleVerticalBtn) {
      layoutToggleVerticalBtn.addEventListener('click', () => sendLayoutChange('vertical'));
    }
    if (layoutToggleHorizontalBtn) {
      layoutToggleHorizontalBtn.addEventListener('click', () => sendLayoutChange('horizontal'));
    }
  </script>
```

- [ ] **Step 5: Verify**

Run: `npm run compile`
Expected: exits 0, no errors (template copy step succeeds).

- [ ] **Step 6: Commit**

```bash
git add src/views/templates/compareView.hbs
git commit -m "feat: add Vertical/Horizontal layout toggle to Compare Branches template"
```

---

### Task 6: Manual smoke test, docs updates, and final verification

**Goal:** Confirm the feature works end-to-end in the Extension Development Host, then update `README.md` and `CHANGELOG.md` per project convention.

**Files:**
- Modify: `README.md:93` (Compare Branches feature bullets), `README.md:235` (settings table)
- Modify: `CHANGELOG.md` (`## [Unreleased]` → `### Added`)

**Acceptance Criteria:**
- [ ] Manually verified in the Extension Development Host: toggle appears next to List/Graph only in List mode, switching persists across a panel close/reopen within the same workspace, and the `compare.listLayout` setting changes the *initial* orientation for a fresh workspace (no prior workspaceState value).
- [ ] `README.md` documents the new toggle and setting.
- [ ] `CHANGELOG.md` has a new `### Added` bullet following the existing bold-title-em-dash convention.
- [ ] `npm test` passes.
- [ ] GitNexus `detect_changes()` run and reviewed before considering the feature complete (per project CLAUDE.md).

**Verify:** `npm test` → all tests pass. Manual verification steps below.

**Steps:**

- [ ] **Step 1: Manual smoke test**

Run: `npm run compile && code --extensionDevelopmentPath=. .` (or use the VS Code "Run Extension" launch config), then:
1. Open `Compare Branches` between any two refs.
2. Confirm a second button group (`Vertical` / `Horizontal`) appears next to `List`/`Graph`, with `Vertical` active by default.
3. Click `Horizontal` — confirm the two commit panes switch from stacked to side-by-side.
4. Switch to `Graph` mode — confirm the Vertical/Horizontal toggle disappears entirely.
5. Switch back to `List` — confirm `Horizontal` is still selected (workspaceState persisted).
6. Close and reopen the Compare Branches panel — confirm it reopens in `Horizontal` (persisted for the workspace).
7. Set `vscodeGitClient.compare.listLayout` to `"horizontal"` in settings, then open Compare Branches in a *different* workspace (or clear workspaceState) — confirm it opens in `Horizontal` as the initial value.

- [ ] **Step 2: Update README.md feature description**

In `README.md`, the `### Compare Branches` section's bullet list (around line 93-103) currently ends with:

```markdown
- Fuzzy message, author, exclude-message regex, and from/to date filters. The message field also matches a pasted commit SHA (full or short), same as Filter Graph.
```

Add a new bullet immediately after it:

```markdown
- Fuzzy message, author, exclude-message regex, and from/to date filters. The message field also matches a pasted commit SHA (full or short), same as Filter Graph.
- List mode supports a Vertical/Horizontal pane layout toggle next to the List/Graph toggle. Vertical (default) stacks the two branches' commit tables; Horizontal places them side by side. Your choice persists for the workspace; `vscodeGitClient.compare.listLayout` sets the initial default.
```

- [ ] **Step 3: Update the README settings table**

In `README.md`, the settings table currently has (around line 235):

```markdown
| `vscodeGitClient.compare.exportFormat`                 | `"csv"`         | Compare Branches export format: `csv` for two files, or `excel` for one `.xlsx` with two sheets                                                                                  |
```

Add a new row directly after it:

```markdown
| `vscodeGitClient.compare.exportFormat`                 | `"csv"`         | Compare Branches export format: `csv` for two files, or `excel` for one `.xlsx` with two sheets                                                                                  |
| `vscodeGitClient.compare.listLayout`                   | `"vertical"`    | Initial Compare Branches List-mode pane layout (`vertical` stacked or `horizontal` side by side); only applies until the in-webview toggle is used, after which the choice persists per workspace |
```

(Match existing column padding/alignment style in the surrounding rows if the table is reformatted by a markdown linter — content correctness matters more than exact whitespace.)

- [ ] **Step 4: Add the CHANGELOG entry**

In `CHANGELOG.md`, the `## [Unreleased]` → `### Added` section currently includes (as its first entries):

```markdown
### Added
- **Text Compare** — new generic, Git-agnostic comparison command. Open `Text Compare: Compare Files...` from the Command Palette, or right-click a file in the Explorer and choose `Text Compare`. Each side can be a workspace file, the current clipboard contents, or an empty buffer. Both sides open as editable temporary untitled files and are discarded when the comparison tab closes.
```

Add a new bullet after the existing `**Compare Branches — Graph mode**` entry (so Compare Branches entries stay grouped):

```markdown
- **Compare Branches — Horizontal/Vertical layout toggle** — new button group next to the List/Graph toggle, visible only in List mode, to switch the two branches' commit tables between stacked (Vertical, default) and side-by-side (Horizontal). The choice persists per workspace; `vscodeGitClient.compare.listLayout` sets the initial default for a workspace that hasn't toggled yet.
```

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS, all tests including the 3 new `StateStore compare layout orientation` cases.

- [ ] **Step 6: Run GitNexus `detect_changes` before committing**

Run `detect_changes({ scope: "compare", base_ref: "main" })` via the GitNexus MCP tool and review the affected symbols/processes list to confirm only Compare Branches–related flows are impacted, per this repo's CLAUDE.md mandate.

- [ ] **Step 7: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: document Compare Branches layout orientation toggle"
```

---

## Out of Scope (carried over from the design doc)

- Any orientation control in Graph mode.
- Independent column widths/resizing in horizontal mode (both panes stay `flex: 1`, same as today's vertical rows).
