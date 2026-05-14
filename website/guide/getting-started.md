# Getting Started

`vscode-git-client` is a Git workflow extension for VS Code. It keeps daily Git work inside the editor: branch management, commit history, commit details, stashes, worktrees, submodules, gutter markers, merge/rebase/cherry-pick recovery, and branch comparison.

## Quick Start

1. Open a folder that contains a Git repository.
2. Open the extension's Activity Bar container.
3. Use `Branches` for branch/tag operations, `Git Graph` for history, and `Commit Details` for changed files and diffs.
4. Use VS Code Source Control for regular staging/commit work; the extension adds stash, commit-template, generated-message, amend, and shelve actions there.
5. Use `Quick Git Actions` from the Command Palette when you know the action but not the view.

## Where Things Live

| Surface                | What it contains                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| **Activity Bar container** | `Branches`, `Commit Details`, `Git Graph`, `Worktrees`, `Submodules`                     |
| **Source Control panel**   | `Stashes` plus SCM input/file actions                                                    |
| **Explorer context menu**  | Compare files or folders with a branch, tag, or commit                                   |
| **Editor**                 | Gutter change markers, file diffs, merge editor, branch comparison tabs                  |
| **Status bar**             | Continue / Skip / Abort controls during merge, rebase, cherry-pick, or revert operations |

## Current Boundaries

- Single repository per window, using the first workspace folder.
- Native Git CLI required on the system path, or configure `vscodeGitClient.gitPath`.
- Built-in VS Code merge and diff editors are used for reliability.
- Git Graph is tree-based rendering with glyph hints, not a custom canvas DAG.
- AI commit message generation requires a compatible language model provider and times out gracefully if unavailable.
- PR and issue tracker integrations are intentionally outside the current scope.
