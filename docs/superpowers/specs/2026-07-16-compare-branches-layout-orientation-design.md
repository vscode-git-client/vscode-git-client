# Compare Branches — Horizontal/Vertical Layout Toggle

**Date:** 2026-07-16
**Status:** Approved

## Summary

Add a Horizontal/Vertical layout toggle to the Compare Branches List mode, so users can switch the left/right commit panes from the current stacked (vertical) layout to a side-by-side (horizontal) layout. Styled as a second `.mode-toggle` button group next to the existing List/Graph toggle. Graph mode is unaffected — it already renders a single interleaved list with no left/right split, so the toggle is hidden there.

## Setting

`vscodeGitClient.compare.listLayout` in `package.json`, next to `vscodeGitClient.compare.exportFormat`:

```json
"vscodeGitClient.compare.listLayout": {
  "type": "string",
  "enum": ["vertical", "horizontal"],
  "default": "vertical",
  "description": "Default pane layout for Compare Branches List mode. vertical stacks the two branches' commit tables; horizontal places them side by side."
}
```

## Persistence & State

New type in `src/views/compareView.ts`:

```ts
export type CompareLayoutOrientation = 'vertical' | 'horizontal';

export interface CompareLayoutOrientationStore {
  getCompareLayoutOrientation(): CompareLayoutOrientation;
  setCompareLayoutOrientation(orientation: CompareLayoutOrientation): Promise<void>;
}
```

Implemented in `src/state/stateStore.ts`, mirroring `getCompareViewMode`/`setCompareViewMode`:

- New `GitCommand.CompareLayoutOrientationKey = 'vscodeGitClient.compareLayoutOrientation'` in `src/config/commands.ts`.
- `getCompareLayoutOrientation()`: reads the workspaceState key. If never set, falls back to `getConfigValue('compare.listLayout', 'vertical')` — i.e. the setting is only the *initial* value; once toggled, workspaceState wins for the rest of the workspace's lifetime (same lifecycle as `CompareViewMode`).
- `setCompareLayoutOrientation(orientation)`: writes to workspaceState.

## Message Protocol

New message, webview → extension host:

```ts
interface SetCompareLayoutMessage {
  readonly type: 'setCompareLayout';
  readonly orientation: CompareLayoutOrientation;
}
```

Type guard `isSetCompareLayoutMessage` added alongside `isSetCompareModeMessage`.

## `CompareView` changes (`src/views/compareView.ts`)

1. Add `CompareLayoutOrientation`, `CompareLayoutOrientationStore`, `SetCompareLayoutMessage`, `isSetCompareLayoutMessage`.
2. Constructor takes a new `private readonly layoutStore: CompareLayoutOrientationStore` parameter (alongside the existing `modeStore`).
3. `render`/`rerender` pass `this.layoutStore.getCompareLayoutOrientation()` into `renderCompareHtml`.
4. `renderCompareHtml` adds `orientation` and `isHorizontalLayout: orientation === 'horizontal'` to the template data.
5. In `handleMessage`, add:
   ```ts
   if (isSetCompareLayoutMessage(message)) {
     await this.layoutStore.setCompareLayoutOrientation(message.orientation);
     this.rerender();
     return;
   }
   ```

## `EditorOrchestrator` changes (`src/editor/editorOrchestrator.ts`)

In `ensureCompareView()`, pass a new constructor argument (object literal, same shape as the existing `modeStore` argument):

```ts
{
  getCompareLayoutOrientation: () => this.state.getCompareLayoutOrientation(),
  setCompareLayoutOrientation: (orientation) => this.state.setCompareLayoutOrientation(orientation)
}
```

## Template changes (`src/views/templates/compareView.hbs`)

- In `.filter-options-actions`, add a second `.mode-toggle` group right after the existing List/Graph one, wrapped in `{{#if isListMode}}` (hidden entirely in Graph mode):
  ```html
  {{#if isListMode}}
  <div class="mode-toggle" role="tablist" aria-label="Compare pane layout">
    <button id="layout-toggle-vertical" type="button" role="tab" aria-selected="{{#unless isHorizontalLayout}}true{{else}}false{{/unless}}" class="{{#unless isHorizontalLayout}}active{{/unless}}" data-layout="vertical">Vertical</button>
    <button id="layout-toggle-horizontal" type="button" role="tab" aria-selected="{{#if isHorizontalLayout}}true{{else}}false{{/if}}" class="{{#if isHorizontalLayout}}active{{/if}}" data-layout="horizontal">Horizontal</button>
  </div>
  {{/if}}
  ```
- CSS: add `.grid.horizontal { flex-direction: row; }` (existing `.grid` stays `flex-direction: column` as the vertical default).
- Apply the class: `<div class="grid{{#if isHorizontalLayout}} horizontal{{/if}}">`.
- JS: wire `layout-toggle-vertical`/`layout-toggle-horizontal` click handlers to post `{ type: 'setCompareLayout', orientation }` when different from the current server-rendered `compareLayoutOrientation`, mirroring the existing `sendModeChange` helper.

## Docs

Update `README.md` (Compare Branches feature bullet) and `CHANGELOG.md` per project convention.

## Out of Scope

- Any orientation control in Graph mode.
- Independent column widths/resizing in horizontal mode (both panes stay `flex: 1`, same as today's vertical rows).
