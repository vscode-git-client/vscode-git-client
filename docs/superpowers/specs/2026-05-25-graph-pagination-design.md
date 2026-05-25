# Git Graph Pagination — Design Spec

**Date:** 2026-05-25  
**Status:** Approved  
**Scope:** Git Graph TreeView + Filter Graph webview

---

## Problem

Both the Git Graph (native VS Code TreeView) and the Filter Graph (webview panel) are capped at a hardcoded `maxGraphCommits` limit (default 200). There is no way to browse older commits. Neither view supports loading additional commits on demand.

---

## Approach

Server-side pagination using `git log --skip=N --max-count=PAGE_SIZE`. Commits accumulate in `StateStore._graph` (append-only). Each view surfaces a "load more" trigger appropriate to its UI:

- **TreeView:** a `LoadMoreTreeItem` at the end of the list
- **Filter Graph webview:** an `IntersectionObserver` scroll sentinel

Client-side filtering in the webview continues to work against all accumulated commits.

---

## Architecture

### Data Flow

```
Initial load:   git log --max-count=200 --skip=0
First page:     git log --max-count=200 --skip=200
Second page:    git log --max-count=200 --skip=400
```

`StateStore._graph` is append-only. `_graphHasMore` is `true` when the last fetched page returned a full batch (`length === pageSize`). When `false`, no "Load More" trigger is shown.

### Filter Reset Behavior

`applyGraphFilters()` triggers `loadGraph()` which resets `_graph` from `skip=0` and recalculates `_graphHasMore`. The webview receives a fresh `init` message — all previously loaded pages are replaced.

---

## Components

### 1. `GitService.getGraph(maxCount, skip, filters)` — [src/services/gitService.ts](../../../src/services/gitService.ts)

Add `skip: number = 0` parameter. Insert `--skip=${skip}` into git args when `skip > 0`.

```typescript
async getGraph(maxCount: number, skip: number = 0, filters?: CommitFilters): Promise<GraphCommit[]>
```

No changes to parsing logic.

### 2. `StateStore` — [src/state/stateStore.ts](../../../src/state/stateStore.ts)

New fields:
```typescript
private _graphHasMore = false;
get graphHasMore(): boolean { return this._graphHasMore; }
```

`loadGraph()` (existing, modified):
```typescript
private async loadGraph(): Promise<void> {
  const pageSize = getConfigValue<number>('maxGraphCommits', 200);
  const page = await this.git.getGraph(pageSize, 0, this._graphFilters);
  this._graph = page;
  this._graphHasMore = page.length === pageSize;
}
```

New public method:
```typescript
async loadMoreGraph(): Promise<void> {
  const pageSize = getConfigValue<number>('maxGraphCommits', 200);
  const page = await this.git.getGraph(pageSize, this._graph.length, this._graphFilters);
  this._graph = [...this._graph, ...page];
  this._graphHasMore = page.length === pageSize;
  this.emitter.fire();
}
```

### 3. `GraphTreeProvider` — [src/providers/graphTreeProvider.ts](../../../src/providers/graphTreeProvider.ts)

New tree item class:
```typescript
class LoadMoreTreeItem extends vscode.TreeItem {
  constructor() {
    super('Load More...', vscode.TreeItemCollapsibleState.None);
    this.command = { title: 'Load More', command: 'vscodeGitClient.graph.loadMore', arguments: [] };
    this.contextValue = 'graphLoadMore';
    this.iconPath = new vscode.ThemeIcon('chevron-down');
  }
}
```

`getChildren()` at root level:
```typescript
const items: GraphNode[] = this.state.graph.map((c) => new GraphCommitTreeItem(c));
if (this.state.graphHasMore) {
  items.push(new LoadMoreTreeItem());
}
return items;
```

### 4. `commandController.ts` — [src/commands/commandController.ts](../../../src/commands/commandController.ts)

Register new command:
```typescript
vscode.commands.registerCommand('vscodeGitClient.graph.loadMore', async () => {
  await state.loadMoreGraph();
});
```

No `package.json` contribution needed — this command is invoked only by the tree item.

### 5. `GraphFilterView` — [src/views/graphFilterView.ts](../../../src/views/graphFilterView.ts)

Add to `GraphFilterHandlers` interface:
```typescript
loadMore(): Promise<{ commits: GraphCommit[]; hasMore: boolean }>;
```

Add to `IncomingMessage` union:
```typescript
| { type: 'loadMore' }
```

Add handler in `handleMessage`:
```typescript
case 'loadMore': {
  try {
    const { commits, hasMore } = await this.handlers.loadMore();
    void this.panel.webview.postMessage({ type: 'appendCommits', commits: serializeCommits(commits), hasMore });
  } catch {
    void this.panel.webview.postMessage({ type: 'loadMoreError' });
  }
  return;
}
```

Update `getInitial` return type (in `GraphFilterView` constructor and `GraphFilterHandlers`) to include `hasMore: boolean`. The caller in `commandController.ts` reads `state.graphHasMore` to populate this.

Update `postInitial()` to include `hasMore`:
```typescript
void this.panel.webview.postMessage({ type: 'init', filters, branches, commits: serializeCommits(commits), hasMore });
```

### 6. `graphFilterView.hbs` — [src/views/templates/graphFilterView.hbs](../../../src/views/templates/graphFilterView.hbs)

**HTML:** Add sentinel div after the commit table:
```html
<div id="load-more-sentinel" style="height:1px"></div>
```

**JS state:** Add `hasMore: false` to state object.

**`init` message handler:** Set `state.hasMore = msg.hasMore`. Existing behavior otherwise unchanged.

**New `appendCommits` message handler:**
```js
if (msg.type === 'appendCommits') {
  state.loading = false;
  state.commits = state.commits.concat(msg.commits);
  state.hasMore = msg.hasMore;
  appendRows(msg.commits);
  updatePreviewHeader();
}
if (msg.type === 'loadMoreError') {
  state.loading = false;
}
```

**`appendRows(commits)`** — appends only new rows to `previewBody` DOM without full re-render. Applies the current client-side filter to each new commit before appending its row: if the commit matches, append the row; if not, skip the row but still push the commit into `state.commits` so a future filter change can pick it up via a full re-render.

**`updatePreviewHeader()`** — when `state.hasMore`:
```
"Matching commits: 45 (from 400 loaded — scroll to load more)"
```
When all loaded:
```
"Matching commits: 45"
```

**`IntersectionObserver`:**
```js
const observer = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && state.hasMore && !state.loading) {
    state.loading = true;
    vscode.postMessage({ type: 'loadMore' });
  }
}, { threshold: 0.1 });
observer.observe(document.getElementById('load-more-sentinel'));
```

---

## Error Handling & Edge Cases

| Case | Handling |
|------|----------|
| Last page is exactly `pageSize` commits | `_graphHasMore = true`; user triggers one more load which returns 0 commits, setting `_graphHasMore = false` |
| Last page returns 0 commits | `_graphHasMore = false`; "Load More" disappears |
| `loadMoreGraph()` git failure | Controller posts `{ type: 'loadMoreError' }`; webview clears `state.loading`; user can retry by scrolling |
| Concurrent load attempts | Webview sets `state.loading = true` before posting; observer checks `!state.loading` |
| Filter reset while loading | `applyGraphFilters()` → `loadGraph()` resets `_graph` and `_graphHasMore`; `init` message replaces webview state |
| Repo with 0 commits | `_graph = []`, `_graphHasMore = false`; no "Load More" shown |

---

## Testing

- **Unit:** `GitService.getGraph` with `skip > 0` produces correct `--skip` arg
- **Unit:** `StateStore.loadMoreGraph` appends correctly and sets `_graphHasMore = false` when page is partial
- **Unit:** `GraphTreeProvider.getChildren` includes `LoadMoreTreeItem` when `graphHasMore = true`, excludes it when `false`
- **Integration:** Filter reset (`applyGraphFilters`) resets pagination state correctly
- **Manual:** TreeView "Load More..." item loads next batch and disappears when exhausted
- **Manual:** Filter Graph scroll-to-bottom triggers load; banner updates; client-side filter applies to new commits
