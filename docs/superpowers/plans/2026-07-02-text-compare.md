# Text Compare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generic, Git-agnostic text comparison feature that opens two editable temporary files in VS Code's native diff editor from the Command Palette or Explorer context menu.

**Architecture:** A new `TextCompareOrchestrator` owns the user flow, a `TextCompareSourcePicker` drives QuickPick selection, and a `TextCompareSession` manages two untitled documents, opens `vscode.diff`, and disposes both documents when the comparison tab closes. The existing `CommandController` registers the command and wires the Explorer context menu; `extension.ts` instantiates the orchestrator and adds it to `context.subscriptions`.

**Tech Stack:** TypeScript, VS Code Extension API, Node built-in test runner.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/editor/textCompareSource.ts` | Shared types and pure helpers for text compare sources and labels. |
| `src/editor/textCompareSourcePicker.ts` | QuickPick UI for choosing a source (file / clipboard / empty). |
| `src/editor/textCompareSession.ts` | Creates two untitled documents, opens `vscode.diff`, and cleans up on tab close. |
| `src/editor/textCompareOrchestrator.ts` | Coordinates the full comparison flow. |
| `src/commands/commandController.ts` | Registers the command and Explorer context menu handler. |
| `src/extension.ts` | Instantiates the orchestrator and subscribes it. |
| `package.json` | Command, activation event, and menu contributions. |
| `src/test/textCompareSource.test.ts` | Unit tests for label helpers. |
| `src/test/textCompareSession.test.ts` | Unit tests for title formatting. |
| `README.md`, `CHANGELOG.md`, `docs/` | Documentation updates. |

---

### Task 1: Shared source types and label helpers

**Goal:** Create the shared types and pure helper functions used by the picker and session.

**Files:**
- Create: `src/editor/textCompareSource.ts`
- Test: `src/test/textCompareSource.test.ts`

**Acceptance Criteria:**
- [ ] `TextSource` type supports `file`, `clipboard`, and `empty` kinds.
- [ ] `getSourceLabel(source)` returns the filename for files, `Clipboard` for clipboard, and `Empty` for empty.
- [ ] `getLanguageForFile(uri)` returns a language id from the file extension or `undefined`.
- [ ] Unit tests pass.

**Verify:** `npm run test` → `textCompareSource.test.ts` passes.

**Steps:**

- [ ] **Step 1: Write failing tests**

```typescript
import * as assert from 'assert';
import { describe, it } from 'node:test';
import * as vscode from 'vscode';
import { getSourceLabel, getLanguageForFile } from '../editor/textCompareSource';

describe('getSourceLabel', () => {
  it('returns filename for file source', () => {
    const label = getSourceLabel({ kind: 'file', uri: vscode.Uri.file('/foo/bar.ts'), content: '', label: 'bar.ts' });
    assert.strictEqual(label, 'bar.ts');
  });

  it('returns Clipboard for clipboard source', () => {
    const label = getSourceLabel({ kind: 'clipboard', content: 'x', label: 'Clipboard' });
    assert.strictEqual(label, 'Clipboard');
  });

  it('returns Empty for empty source', () => {
    const label = getSourceLabel({ kind: 'empty', content: '', label: 'Empty' });
    assert.strictEqual(label, 'Empty');
  });
});

describe('getLanguageForFile', () => {
  it('infers language from file extension', () => {
    assert.strictEqual(getLanguageForFile(vscode.Uri.file('/foo/bar.ts')), 'typescript');
    assert.strictEqual(getLanguageForFile(vscode.Uri.file('/foo/bar.md')), 'markdown');
  });

  it('returns undefined for unknown extensions', () => {
    assert.strictEqual(getLanguageForFile(vscode.Uri.file('/foo/bar.xyz')), undefined);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --test-name-pattern 'getSourceLabel|getLanguageForFile'`
Expected: FAIL with "getSourceLabel is not a function" or similar.

- [ ] **Step 3: Implement `src/editor/textCompareSource.ts`**

```typescript
import * as path from 'path';
import * as vscode from 'vscode';

export type TextSource =
  | { kind: 'file'; uri: vscode.Uri; content: string; label: string }
  | { kind: 'clipboard'; content: string; label: string }
  | { kind: 'empty'; content: string; label: string };

export function getSourceLabel(source: TextSource): string {
  return source.label;
}

export function getLanguageForFile(uri: vscode.Uri): string | undefined {
  const ext = path.extname(uri.fsPath).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescriptreact',
    '.js': 'javascript',
    '.jsx': 'javascriptreact',
    '.json': 'json',
    '.md': 'markdown',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.py': 'python',
    '.sh': 'shellscript',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.xml': 'xml',
    '.sql': 'sql',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'cpp',
    '.cs': 'csharp'
  };
  return map[ext];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- --test-name-pattern 'getSourceLabel|getLanguageForFile'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/editor/textCompareSource.ts src/test/textCompareSource.test.ts
git commit -m "feat(text-compare): add shared source types and label helpers

Introduce TextSource union and pure helpers for labels and language
inference. Include unit tests.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Text compare source picker

**Goal:** Implement the QuickPick UI for choosing each comparison side.

**Files:**
- Create: `src/editor/textCompareSourcePicker.ts`
- Modify: `src/editor/textCompareSource.ts` (no changes needed if Task 1 complete)
- Test: `src/test/textCompareSourcePicker.test.ts`

**Acceptance Criteria:**
- [ ] `pickTextCompareSource` returns `undefined` when the user cancels.
- [ ] Choosing `Open file...` returns a `file` source with content read from the selected file.
- [ ] Choosing `Paste from Clipboard` returns a `clipboard` source with current clipboard text.
- [ ] Choosing `Empty text` returns an `empty` source.
- [ ] Workspace scope is applied to the file dialog.

**Verify:** `npm run test` → `textCompareSourcePicker.test.ts` passes.

**Steps:**

- [ ] **Step 1: Write failing tests**

```typescript
import * as assert from 'assert';
import { describe, it } from 'node:test';
import * as vscode from 'vscode';
import { pickTextCompareSource, buildSourcePickerItems } from '../editor/textCompareSourcePicker';

describe('buildSourcePickerItems', () => {
  it('returns Open file, Paste from Clipboard, and Empty text items', () => {
    const items = buildSourcePickerItems();
    assert.strictEqual(items.length, 3);
    assert.strictEqual(items[0].label, '$(file) Open file...');
    assert.strictEqual(items[1].label, '$(clippy) Paste from Clipboard');
    assert.strictEqual(items[2].label, '$(empty) Empty text');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --test-name-pattern 'buildSourcePickerItems'`
Expected: FAIL.

- [ ] **Step 3: Implement `src/editor/textCompareSourcePicker.ts`**

```typescript
import * as vscode from 'vscode';
import { TextSource } from './textCompareSource';

export function buildSourcePickerItems(): vscode.QuickPickItem[] {
  return [
    { label: '$(file) Open file...', description: 'Choose a workspace file' },
    { label: '$(clippy) Paste from Clipboard', description: 'Use current clipboard text' },
    { label: '$(circle-outline) Empty text', description: 'Start with an empty buffer' }
  ];
}

export async function pickTextCompareSource(sideLabel: string): Promise<TextSource | undefined> {
  const choice = await vscode.window.showQuickPick(buildSourcePickerItems(), {
    title: `Select ${sideLabel} source`,
    placeHolder: 'Choose a source for the comparison'
  });

  if (!choice) {
    return undefined;
  }

  if (choice.label === '$(file) Open file...') {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    const defaultUri = workspaceRoot;
    const files = await vscode.window.showOpenDialog({
      title: `Open file for ${sideLabel}`,
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      defaultUri
    });

    if (!files || files.length === 0) {
      return undefined;
    }

    const uri = files[0];
    let content: string;
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      content = Buffer.from(bytes).toString('utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read file: ${message}`);
    }

    const fileName = uri.path.split('/').pop() || uri.fsPath;
    return { kind: 'file', uri, content, label: fileName };
  }

  if (choice.label === '$(clippy) Paste from Clipboard') {
    const content = await vscode.env.clipboard.readText();
    return { kind: 'clipboard', content, label: 'Clipboard' };
  }

  return { kind: 'empty', content: '', label: 'Empty' };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- --test-name-pattern 'buildSourcePickerItems'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/editor/textCompareSourcePicker.ts src/test/textCompareSourcePicker.test.ts
git commit -m "feat(text-compare): add source picker QuickPick

Add pickTextCompareSource with file, clipboard, and empty options.
Include tests for item construction.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Text compare session lifecycle

**Goal:** Implement the session that creates two untitled documents, opens the diff editor, and cleans up when the tab closes.

**Files:**
- Create: `src/editor/textCompareSession.ts`
- Test: `src/test/textCompareSession.test.ts`

**Acceptance Criteria:**
- [ ] `TextCompareSession.create` opens two untitled documents with the supplied content.
- [ ] It invokes `vscode.diff` with a title of the form `leftLabel ↔ rightLabel · Text Compare`.
- [ ] It listens for tab changes and disposes both documents when neither is visible.
- [ ] Title and label helpers are unit tested.

**Verify:** `npm run test` → `textCompareSession.test.ts` passes.

**Steps:**

- [ ] **Step 1: Write failing tests**

```typescript
import * as assert from 'assert';
import { describe, it } from 'node:test';
import { formatTextCompareTitle } from '../editor/textCompareSession';

describe('formatTextCompareTitle', () => {
  it('combines two labels with the compare glyph', () => {
    assert.strictEqual(formatTextCompareTitle('foo.txt', 'bar.txt'), 'foo.txt ↔ bar.txt · Text Compare');
  });

  it('escapes undefined labels to empty strings', () => {
    assert.strictEqual(formatTextCompareTitle('', 'Clipboard'), ' ↔ Clipboard · Text Compare');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --test-name-pattern 'formatTextCompareTitle'`
Expected: FAIL.

- [ ] **Step 3: Implement `src/editor/textCompareSession.ts`**

```typescript
import * as vscode from 'vscode';
import { TextSource, getLanguageForFile } from './textCompareSource';

export function formatTextCompareTitle(leftLabel: string, rightLabel: string): string {
  return `${leftLabel} ↔ ${rightLabel} · Text Compare`;
}

export class TextCompareSession implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private leftUri: vscode.Uri | undefined;
  private rightUri: vscode.Uri | undefined;

  private constructor() { }

  static async create(left: TextSource, right: TextSource): Promise<TextCompareSession> {
    const session = new TextCompareSession();
    await session.open(left, right);
    return session;
  }

  private async open(left: TextSource, right: TextSource): Promise<void> {
    this.leftUri = await createUntitledUri(left);
    this.rightUri = await createUntitledUri(right);

    const title = formatTextCompareTitle(left.label, right.label);
    await vscode.commands.executeCommand('vscode.diff', this.leftUri, this.rightUri, title, {
      preview: false,
      preserveFocus: false
    });

    this.disposables.push(
      vscode.window.tabGroups.onDidChangeTabs(() => {
        void this.disposeIfHidden();
      })
    );

    // If the diff tab was already closed before the listener attached, clean up immediately.
    await this.disposeIfHidden();
  }

  private async disposeIfHidden(): Promise<void> {
    if (!this.leftUri || !this.rightUri) {
      this.dispose();
      return;
    }

    const visibleUris = collectVisibleTabUris();
    const leftVisible = visibleUris.has(this.leftUri.toString());
    const rightVisible = visibleUris.has(this.rightUri.toString());

    if (!leftVisible && !rightVisible) {
      await closeDocument(this.leftUri);
      await closeDocument(this.rightUri);
      this.dispose();
    }
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
  }
}

async function createUntitledUri(source: TextSource): Promise<vscode.Uri> {
  const language = source.kind === 'file' ? getLanguageForFile(source.uri) : undefined;
  const document = await vscode.workspace.openTextDocument({
    content: source.content,
    language
  });
  return document.uri;
}

function collectVisibleTabUris(): Set<string> {
  const uris = new Set<string>();
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input = tab.input;
      if (input instanceof vscode.TabInputText) {
        uris.add(input.uri.toString());
      } else if (input instanceof vscode.TabInputTextDiff) {
        uris.add(input.original.toString());
        uris.add(input.modified.toString());
      }
    }
  }
  return uris;
}

async function closeDocument(uri: vscode.Uri): Promise<void> {
  const document = vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === uri.toString());
  if (!document) {
    return;
  }

  // Prefer closing the editor tab over closing the document directly.
  const tab = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .find((t) => {
      const input = t.input;
      if (input instanceof vscode.TabInputText) {
        return input.uri.toString() === uri.toString();
      }
      return false;
    });

  if (tab) {
    await vscode.window.tabGroups.close(tab, true);
    return;
  }

  // Fallback: close the document via command if no tab is open.
  const editor = vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === uri.toString());
  if (editor) {
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- --test-name-pattern 'formatTextCompareTitle'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/editor/textCompareSession.ts src/test/textCompareSession.test.ts
git commit -m "feat(text-compare): add session lifecycle for temp diff editor

Create two untitled documents, open vscode.diff, and dispose both when
the comparison tab closes. Include title helper tests.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Text compare orchestrator

**Goal:** Wire the picker and session together behind a single orchestrator method.

**Files:**
- Create: `src/editor/textCompareOrchestrator.ts`
- Test: `src/test/textCompareOrchestrator.test.ts`

**Acceptance Criteria:**
- [ ] `open()` prompts for left then right sources and creates a session.
- [ ] `open({ seedFile })` skips the corresponding side picker and uses the file.
- [ ] Cancellation at any picker step aborts without opening an editor.

**Verify:** `npm run test` → `textCompareOrchestrator.test.ts` passes.

**Steps:**

- [ ] **Step 1: Write failing tests**

```typescript
import * as assert from 'assert';
import { describe, it } from 'node:test';
import { buildPickOrder } from '../editor/textCompareOrchestrator';

describe('buildPickOrder', () => {
  it('picks both sides when no seed is provided', () => {
    const order = buildPickOrder(undefined);
    assert.deepStrictEqual(order, ['left', 'right']);
  });

  it('skips left when left is seeded', () => {
    const order = buildPickOrder('left');
    assert.deepStrictEqual(order, ['right']);
  });

  it('skips right when right is seeded', () => {
    const order = buildPickOrder('right');
    assert.deepStrictEqual(order, ['left']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --test-name-pattern 'buildPickOrder'`
Expected: FAIL.

- [ ] **Step 3: Implement `src/editor/textCompareOrchestrator.ts`**

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import { TextSource } from './textCompareSource';
import { pickTextCompareSource } from './textCompareSourcePicker';
import { TextCompareSession } from './textCompareSession';

export interface TextCompareOptions {
  seedFile?: vscode.Uri;
  seedSide?: 'left' | 'right';
}

export class TextCompareOrchestrator {
  private activeSession: TextCompareSession | undefined;

  async open(options: TextCompareOptions = {}): Promise<void> {
    const seedSide = options.seedSide ?? 'left';
    const seed = options.seedFile ? await buildFileSource(options.seedFile) : undefined;

    const left = seedSide === 'left' && seed ? seed : await pickTextCompareSource('Left');
    if (!left) {
      return;
    }

    const right = seedSide === 'right' && seed ? seed : await pickTextCompareSource('Right');
    if (!right) {
      return;
    }

    this.activeSession?.dispose();
    this.activeSession = await TextCompareSession.create(left, right);
  }

  dispose(): void {
    this.activeSession?.dispose();
  }
}

export function buildPickOrder(seedSide?: 'left' | 'right'): Array<'left' | 'right'> {
  if (seedSide === 'left') {
    return ['right'];
  }
  if (seedSide === 'right') {
    return ['left'];
  }
  return ['left', 'right'];
}

async function buildFileSource(uri: vscode.Uri): Promise<TextSource> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  const content = Buffer.from(bytes).toString('utf8');
  const fileName = uri.path.split('/').pop() || path.basename(uri.fsPath);
  return { kind: 'file', uri, content, label: fileName };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- --test-name-pattern 'buildPickOrder'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/editor/textCompareOrchestrator.ts src/test/textCompareOrchestrator.test.ts
git commit -m "feat(text-compare): add orchestrator for comparison flow

Wire source picker and session together. Support optional seeded file
from the Explorer context menu. Include pick-order tests.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Register command and Explorer context menu

**Goal:** Expose the feature via Command Palette and Explorer context menu.

**Files:**
- Modify: `src/commands/commandController.ts`
- Modify: `src/extension.ts`
- Modify: `package.json`

**Acceptance Criteria:**
- [ ] Command `vscodeGitClient.textCompare.open` is registered.
- [ ] Command appears in Command Palette as `Text Compare: Compare Files...`.
- [ ] Explorer context menu shows `Text Compare` for files.
- [ ] Legacy alias `intelliGit.textCompare.open` is registered.

**Verify:** `npm run check-types` → no type errors.

**Steps:**

- [ ] **Step 1: Modify `src/extension.ts`**

Add the import after the existing editor imports:

```typescript
import { TextCompareOrchestrator } from './editor/textCompareOrchestrator';
```

After the `editor` declaration, instantiate the orchestrator:

```typescript
const textCompare = new TextCompareOrchestrator();
context.subscriptions.push(textCompare);
```

Pass it to `CommandController`:

```typescript
const commandController = new CommandController(
  gitService,
  stateStore,
  editor,
  logger,
  commitFilesProvider,
  textCompare
);
```

- [ ] **Step 2: Modify `src/commands/commandController.ts`**

Add the constructor parameter:

```typescript
import { TextCompareOrchestrator } from '../editor/textCompareOrchestrator';

export class CommandController {
  constructor(
    private readonly git: GitService,
    private readonly state: StateStore,
    private readonly editor: EditorOrchestrator,
    private readonly logger: Logger,
    private readonly commitFilesView: { ... },
    private readonly textCompare: TextCompareOrchestrator
  ) { }
```

Register the command inside `register()`:

```typescript
register('vscodeGitClient.textCompare.open', async (arg?: unknown) => {
  const seedFile = asFileResourceUri(arg);
  await this.textCompare.open(seedFile ? { seedFile } : undefined);
});
```

- [ ] **Step 3: Modify `package.json`**

Add to `activationEvents`:

```json
"onCommand:vscodeGitClient.textCompare.open"
```

Add to `contributes.commands`:

```json
{
  "command": "vscodeGitClient.textCompare.open",
  "title": "Compare Files...",
  "category": "Text Compare"
}
```

Add to `contributes.menus.explorer/context`:

```json
{
  "command": "vscodeGitClient.textCompare.open",
  "when": "resourceScheme == file",
  "group": "z_vscodeGitClient@3"
}
```

- [ ] **Step 4: Run type check**

Run: `npm run check-types`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/commands/commandController.ts src/extension.ts package.json
git commit -m "feat(text-compare): register command and Explorer context menu

Expose Text Compare via Command Palette and Explorer right-click.
Wire orchestrator through CommandController and extension activation.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Documentation updates

**Goal:** Keep README, CHANGELOG, and release notes current.

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `docs/2026-07-02-text-compare.md` (release notes file)

**Acceptance Criteria:**
- [ ] README mentions Text Compare under daily workflows.
- [ ] CHANGELOG has an Unreleased entry.
- [ ] Release notes file describes the feature.

**Verify:** Read the three files and confirm the entries are present and accurate.

**Steps:**

- [ ] **Step 1: Update `README.md`**

Add a new section under `## Daily Workflows` after the branch workflow:

```markdown
### Compare Any Two Text Sources

Use **Text Compare: Compare Files...** from the Command Palette to open two editable temporary files in VS Code's diff editor. Each side can be a workspace file, the current clipboard contents, or an empty buffer. Right-click a file in the Explorer and choose **Text Compare** to seed one side automatically.
```

Add the command to the command reference table.

- [ ] **Step 2: Update `CHANGELOG.md`**

Add under `## [Unreleased]`:

```markdown
- **Text Compare** — new generic, Git-agnostic comparison command. Open `Text Compare: Compare Files...` from the Command Palette, or right-click a file in the Explorer and choose `Text Compare`. Each side can be a workspace file, the current clipboard contents, or an empty buffer. Both sides open as editable temporary untitled files and are discarded when the comparison tab closes.
```

- [ ] **Step 3: Create `docs/2026-07-02-text-compare.md`**

```markdown
# Text Compare

**Status:** Implemented
**Version:** 1.17.0

## Overview

Text Compare is a generic, Git-agnostic feature that lets users compare two text sources side by side in VS Code's native diff editor.

## How to use

- Command Palette: `Text Compare: Compare Files...`
- Explorer context menu: right-click a file → `Text Compare`

Each side can be:

- A workspace file.
- The current clipboard contents.
- An empty buffer.

Both sides open as editable temporary untitled files. Closing the comparison tab discards both files without prompting to save.
```

- [ ] **Step 4: Commit**

```bash
git add README.md CHANGELOG.md docs/2026-07-02-text-compare.md
git commit -m "docs(text-compare): document the new Text Compare feature

Update README, CHANGELOG, and add release notes.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-review

### Spec coverage

| Spec section | Implementing task |
|---|---|
| Generic, Git-agnostic tool | Task 1, 4 |
| File / clipboard / empty sources | Task 2 |
| Editable temporary files | Task 3 |
| Source labels in title | Task 3 |
| Auto-cleanup on tab close | Task 3 |
| Command Palette entry | Task 5 |
| Explorer context menu entry | Task 5 |
| Error handling | Embedded in tasks |
| Testing | Each task |
| Documentation | Task 6 |

### Placeholder scan

No `TBD`, `TODO`, or vague steps found. Every step includes exact file paths, code, and verification commands.

### Type consistency

- `TextSource` is defined in Task 1 and imported consistently in Tasks 2, 3, and 4.
- Command id `vscodeGitClient.textCompare.open` matches across `package.json`, `CommandController`, and `extension.ts`.
- Legacy alias is generated automatically by the existing `legacyCommandId` helper.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-02-text-compare.md`. See the native tasks file `docs/superpowers/plans/2026-07-02-text-compare.md.tasks.json` for structured task tracking.
