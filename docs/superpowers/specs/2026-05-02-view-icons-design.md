# IntelliGit View Icons — Design Spec

**Date:** 2026-05-02  
**Status:** Approved

---

## Problem

All five sidebar views (`Branches`, `Git Graph`, `Worktrees`, `Submodules`, and `Stashes`) currently share the same generic `media/intelligit.svg` icon. This makes it impossible to visually distinguish views when they are collapsed or shown as tabs.

---

## Decisions

### Style

Colorful SVGs using the **GitHub-dark palette**, matching the existing `intelligit.svg` branding:

| Color | Hex | Role |
|---|---|---|
| Blue | `#58a6ff` | Main branch / primary element |
| Orange | `#f0883e` | Feature branch / secondary element |
| Green | `#3fb950` | Additional branch (Branches view) |
| Purple | `#d2a8ff` | Stash layers |
| Light blue | `#79c0ff` | Shared roots / connectors |
| Background | `#0d1117` | Fill inside circles/shapes |

All icons use `viewBox="0 0 128 128"` to match `intelligit.svg`.

---

## Icons

### 1. `media/icon-graph.svg` — Git Graph

A commit network showing a feature branch diverging from main and merging back:
- Blue vertical main branch with blue commit circles
- Orange curve diverges at commit 2, runs a short segment, merges back
- One orange commit node on the feature branch

### 2. `media/icon-branches.svg` — Branches

A tree with three branches forking from a common root commit:
- Blue trunk rising from a root commit at the bottom
- Blue centre branch goes straight up (main)
- Green left branch curves up-left (feature-1)
- Orange right branch curves up-right (feature-2)
- Each branch tip has a commit circle in its own color

### 3. `media/icon-stashes.svg` — Stashes

Three stacked horizontal bars representing saved work layers:
- Bottom bar: full width, full opacity — most recent stash
- Middle bar: slightly narrower, 80% opacity
- Top bar: narrowest, 55% opacity — oldest stash
- All bars are purple (`#d2a8ff`) with a dark fill
- Text lines inside the bottom bar and a small right-pointing arrow hint at saved content

### 4. `media/icon-worktrees.svg` — Worktrees

Two independent working directories forked from a shared repository root:
- Shared root circle at bottom (`#79c0ff`)
- Left path curves to a blue (`#58a6ff`) folder/terminal box with file lines
- Right path curves to an orange (`#f0883e`) folder/terminal box with file lines
- Each box has 3 short horizontal lines (representing files)

### 5. `media/icon-submodules.svg` — Submodules

A nested-repository metaphor:
- Outer folder (blue `#58a6ff`) representing the parent repository
- Inner folder (orange `#f0883e`) representing the submodule, nested inside
- Both folders use the "folder tab" shape
- Inside the inner folder: a mini branch graph (line + curve + two commit circles)

---

## File Changes

| File | Action |
|---|---|
| `media/icon-graph.svg` | Create |
| `media/icon-branches.svg` | Create |
| `media/icon-stashes.svg` | Create |
| `media/icon-worktrees.svg` | Create |
| `media/icon-submodules.svg` | Create |
| `package.json` | Update `views.intelliGit[*].icon` for each view |

### `package.json` mapping

```json
{ "id": "intelliGit.branches",  "icon": "media/icon-branches.svg" }
{ "id": "intelliGit.graph",     "icon": "media/icon-graph.svg" }
{ "id": "intelliGit.worktrees", "icon": "media/icon-worktrees.svg" }
{ "id": "intelliGit.submodules","icon": "media/icon-submodules.svg" }
```

The `intelliGit.stashes` view lives in `scm` and has no `icon` field today. Adding `"icon": "media/icon-stashes.svg"` to it.

---

## Out of Scope

- The activity bar container icon (`media/intelligit.svg`) is unchanged.
- No changes to icon sizes, hover states, or theme-adaptive (monochromatic) variants.
