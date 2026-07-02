# Text Compare — Design

**Status:** Approved for implementation
**Date:** 2026-07-02
**Owner:** thanhtung.uet@gmail.com

## Summary

Add a generic, Git-agnostic text comparison feature to the VS Code Git Client extension. Users can open a two-column diff editor from the Command Palette or the Explorer context menu, loading each side from a workspace file, the clipboard, or an empty text buffer. Both sides are editable temporary untitled files that are automatically discarded when the comparison tab closes.

## Goals

- Compare any two text sources side by side without relying on Git state.
- Each side can come from:
  - A workspace file.
  - The current clipboard contents.
  - An empty text buffer.
- Both sides are editable.
- The diff title shows the source of each side (filename, `Clipboard`, or `Empty`).
- Closing the comparison tab discards both temporary files without save prompts.

## Non-Goals

- Git-aware comparison (the extension already has Compare Branches and Compare with Revision).
- Persistent comparison sessions across window reloads.
- Saving temporary content back to a file automatically.
- Comparing binary files.

## User Flow

### From the Command Palette

1. Run `Text Compare: Compare Files...`.
2. Pick the **left** source:
   - `Open file...` → file dialog → file contents.
   - `Paste from Clipboard` → clipboard read silently.
   - `Empty text` → empty string.
3. Pick the **right** source with the same options.
4. The native diff editor opens with title `leftLabel ↔ rightLabel · Text Compare`.
5. Edit either side freely.
6. Close the tab → both untitled files are disposed.

### From the Explorer Context Menu

1. Right-click a file → `Text Compare`.
2. The picked file is pre-selected as one side (default left).
3. Pick the other source as above.
4. Diff opens with the file side labeled by its filename.

## Architecture

- A new orchestrator `TextCompareOrchestrator` owns the entire comparison lifecycle.
- A helper `TextCompareSourcePicker` drives the QuickPick for choosing each side.
- A session object `TextCompareSession` manages the two untitled documents, opens `vscode.diff`, and cleans up when the tab is closed.
- The existing `CommandController` registers the new command and wires the Explorer context menu.

### New files

- `src/editor/textCompareOrchestrator.ts`
  - `TextCompareOrchestrator.open(options?: { seedFile?: vscode.Uri; seedSide?: 'left' | 'right' })`
- `src/editor/textCompareSourcePicker.ts`
  - `pickTextCompareSource(label: string, seed?: { file: vscode.Uri; side: 'left' | 'right' })`
  - `TextSource` type
- `src/editor/textCompareSession.ts`
  - `TextCompareSession.create(left, right)`
  - cleanup via `vscode.window.tabGroups.onDidChangeTabs`

### Modified files

- `src/commands/commandController.ts` — register `vscodeGitClient.textCompare.open` and Explorer handler.
- `package.json` — command, activation event, Command Palette entry, Explorer context menu entry.
- `README.md`, `CHANGELOG.md`, `docs/` — documentation.

## Components

### `TextCompareOrchestrator`

- Accepts an optional seeded file URI from the context menu.
- Decides which side the seed occupies (default `left`).
- Calls `pickTextCompareSource` for the missing side(s).
- Builds a `TextCompareSession` and opens the diff.

### `TextCompareSourcePicker`

- Shows a QuickPick with three items:
  - `$(file) Open file...`
  - `$(clippy) Paste from Clipboard`
  - `$(circle-outline) Empty text`
- For `Open file...`, opens `vscode.window.showOpenDialog` restricted to the workspace.
- For `Paste from Clipboard`, reads `vscode.env.clipboard.readText()`.
- Returns a `TextSource` value carrying content and a display label.

### `TextCompareSession`

- Creates two untitled documents with `vscode.workspace.openTextDocument({ content, language })`.
- Language is inferred from the file extension when the source is a file; otherwise plain text.
- Opens `vscode.diff` with the two untitled URIs.
- Listens to tab changes. When neither untitled document is visible in any tab group, closes both documents via `vscode.commands.executeCommand('workbench.action.closeActiveEditor')` or similar.

## Data Flow

```
Command palette / Explorer right-click
  → commandController: vscodeGitClient.textCompare.open
  → textCompareOrchestrator.open({ seedFile? })
      ├── pickTextCompareSource('Left')  → TextSource
      └── pickTextCompareSource('Right') → TextSource
  → textCompareSession.create(leftSource, rightSource)
      ├── openTextDocument({ content: left.content, language }) → leftUri
      ├── openTextDocument({ content: right.content, language }) → rightUri
      └── vscode.diff(leftUri, rightUri, title, { preview: false })
  → on tab close: close both untitled documents
```

## Error Handling

| Condition | Behavior |
|---|---|
| Clipboard empty / non-text | Treat as empty string |
| File read fails | `showErrorMessage`, abort comparison |
| User cancels picker or file dialog | Silent abort, no editor changes |
| Untitled document creation fails | `showErrorMessage`, abort comparison |
| Diff tab closed before cleanup attaches | Close untitled documents immediately |
| One side tab closed manually | Close the paired side too |

## Testing

### Unit tests

- `src/test/textCompareSourcePicker.test.ts` — label formatting and source-kind detection.
- `src/test/textCompareSession.test.ts` — title formatting and URI scheme detection.

### Manual test plan

1. Command palette → compare two files.
2. Command palette → file vs clipboard.
3. Command palette → clipboard vs clipboard.
4. Explorer right-click → seed file as one side, pick other source.
5. Edit both sides in the diff editor, close tab → no save prompts.
6. Close one side tab → the other side closes too.
7. Cancel picker mid-flow → no editors opened.
8. Pick a large file → diff opens without hanging.

## Documentation Updates

- `README.md` — add Text Compare to the feature list and command reference.
- `CHANGELOG.md` — entry under `## [Unreleased]`.
- `docs/` — release notes for the version that ships the feature.

## Open Questions

None at design-approval time.
