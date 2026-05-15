# Compare View — Graph Mode

Status: approved
Date: 2026-05-15

## Goal

Add a second visualization for the "Compare branches" webview: a Git graph showing the divergence of the two branches, from the oldest diff commit to the newest, joined at their merge base. Users toggle between the existing two-table **List** mode and the new **Graph** mode; both modes use the same filters and the same commit-click handler.

## Scope

Two-branch divergence only. The graph spans:

- All commits in `leftRef..rightRef` (right-only).
- All commits in `rightRef..leftRef` (left-only).
- The merge base of the two refs (one extra commit at the bottom, where the lanes converge).

Out of scope for v1: secondary-parent edges for internal merge commits within a branch, drag/zoom/pan of the canvas, showing commits in the merge base's history, fully topological lane packing.

## Data model

`CompareResult` (`src/types.ts`) gains one optional field:

```ts
readonly mergeBase?: GraphCommit;
```

`undefined` when the two refs share no history (unrelated histories, shallow clone, error).

`GitService.getCompare` adds:

1. `git merge-base leftRef rightRef` to resolve the base SHA.
2. `git log -1 --format=<existing format> <base SHA>` to populate a full `GraphCommit`.

Both calls are best-effort. Failure of either leaves `mergeBase` undefined; the rest of `getCompare` is unchanged.

## Lane algorithm

The compare view is a strict two-branch view, so lane assignment is fixed and trivial:

- **Lane 0** (left column) holds every commit in `commitsOnlyLeft`.
- **Lane 1** (right column) holds every commit in `commitsOnlyRight`.
- The **merge base** (if present) is rendered as a single node centered between the two lanes at the bottom.

Vertical ordering: all commits (both lanes interleaved) are sorted by author date descending — newest at top, oldest at bottom — matching `gitk` and `git log` defaults. The merge base node is rendered below the oldest commit of either lane regardless of its actual date.

Edges:

- Each commit has a vertical edge connecting it to the **next-older commit in the same lane**.
- The oldest commit in each lane has a diagonal edge converging on the merge-base node (a "Y" join).
- This deliberately ignores secondary-parent edges of internal merge commits; this is acceptable for v1 since the compare view's mental model is "two branches diverged," not "the full DAG."

## View structure

The toggle and the graph live inside the existing `compareView.hbs` template (no new webview).

### Mode toggle

A segmented button group placed in the filter actions area, next to "Clear filters":

```
[ List ▣ ] [ Graph ]
```

Active mode is highlighted with the same accent treatment used by other selected controls. Clicking sends `{ type: 'setCompareMode', mode: 'list' | 'graph' }` to the extension host, which persists it in workspace state and re-renders the webview HTML.

State key: `vscodeGitClient.compareViewMode`. Default value: `'list'` (no behavior change for existing users).

### Graph canvas (only emitted when mode = 'graph')

```
<section class="graph-canvas">
  <header class="graph-banner">
    {{leftRef}} ({{leftTotal}}) ↔ {{rightRef}} ({{rightTotal}})
    {{#if mergeBaseShort}} · merge base {{mergeBaseShort}}{{/if}}
  </header>
  <div class="graph-scroll">
    <svg class="graph-svg" ...>
      <!-- pre-computed edges + nodes -->
    </svg>
    <ul class="graph-rows">
      <!-- one <li class="graph-row commit-row" data-sha=... data-side=... data-subject=... data-author=... data-timestamp=...> per commit, mirroring the data attributes used by table rows so existing JS keeps working -->
    </ul>
  </div>
</section>
```

The SVG and the row list scroll together. Row height is fixed (24px). The SVG height is `rowCount * 24 + 24` (extra row for the merge base).

### List grid

The existing `.grid` (two side-by-side tables) is hidden when mode = 'graph', shown otherwise. No structural change.

## Filter interaction

`applyFilters` is extended to operate on **both** the table rows AND the graph rows by reusing the same `data-*` attributes. The visibility delta:

- **List mode:** filtered-out rows get `display: none` (current behavior).
- **Graph mode:** filtered-out rows AND their graph nodes/edges get a `.dimmed` class (`opacity: 0.35; pointer-events: none`). The graph's topology remains intact so the user can see the shape of divergence while filtering.

The `data-*` attributes on graph rows match table rows exactly, so the filter logic stays in one place. The only branch in `applyFilters` is the visibility application step.

The header banner in graph mode shows `visible / total` per side, same numbers as the existing `.section-banner` in list mode.

## Click behavior

Clicking a graph row (anywhere on the row, including the SVG node) sends the existing `{ type: 'commitClick', sha, subject }` message — same handler as the table row click. Multi-select (Shift / Ctrl / Cmd) is **not** supported in graph mode for v1; selection state stays list-mode-only.

## Export

The export button stays in the filter row (already lives in `.filter-options`). Its handler serializes `serializeVisibleCommits(side)`, which today walks `tr.commit-row[data-side=...]` filtered by `display !== 'none'`. We update it to additionally walk `.graph-row[data-side=...]` filtered by `!.dimmed`, so a single function works in both modes.

## Styling

VS Code theme tokens (no new color literals):

- Left lane: `var(--accent)`.
- Right lane: `var(--vscode-gitDecoration-addedResourceForeground, var(--accent))` (fallback if token absent).
- Merge base node: `var(--muted)`.
- Edges: `var(--border)`, 1.5px stroke.
- Node fill: `var(--bg)` with a 2px stroke in the lane color.
- Dimmed state: `opacity: 0.35; pointer-events: none;`.

Graph rows reuse the existing `commit-row` row height and font conventions from `partials/styles/commitListBase`.

## Files touched

- `src/types.ts` — add `mergeBase?: GraphCommit` to `CompareResult`.
- `src/services/gitService.ts` — extend `getCompare` to fetch merge base.
- `src/state/stateStore.ts` — `getCompareViewMode()` / `setCompareViewMode()` helpers persisting to workspace state.
- `src/editor/editorOrchestrator.ts` — wire the new accessors into `CompareView`.
- `src/views/compareView.ts` —
  - Constructor accepts mode getter/setter.
  - Computes lane layout (positions + SVG path data) when `mode === 'graph'`.
  - Handles new `setCompareMode` message; re-renders HTML on mode change.
  - Passes `mode`, `graphRows`, `graphSvg` to the template.
- `src/views/templates/compareView.hbs` — toggle button + graph canvas section + mode-aware filter visibility logic + mode-aware export.
- `src/views/templates/partials/compareGraph.hbs` (new) — graph canvas markup.
- `README.md`, `website/guide/features.md`, `CHANGELOG.md` — mention the new mode.

## Non-goals (v1)

- Topology for internal merges (secondary-parent edges).
- Drag / zoom / pan / virtualization.
- Multi-select in graph mode.
- Persisting mode per `(leftRef, rightRef)` pair — workspace-wide is fine.
- Automated tests (no existing webview test harness in the repo).

## Open questions resolved during brainstorming

| Question | Decision |
|---|---|
| Graph shape | Two divergent lanes from the merge base. |
| Placement | Mode toggle (List / Graph). |
| Rendering | Hand-rolled inline SVG; layout computed server-side in TS. |
| Filter interaction | Dim filtered-out nodes in place; preserve topology. |
| Click behavior | Same `commitClick` as row click. No multi-select in graph mode. |
