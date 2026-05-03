import * as vscode from 'vscode';
import type { BranchRef, TagRef, ResolvedCommitMeta } from '../types';

// ── Exported types ────────────────────────────────────────────────────────────

export type RevisionKind = 'branch' | 'remote' | 'tag' | 'commit';

export interface RevisionSelection {
  readonly ref: string;
  readonly label: string;
  readonly kind: RevisionKind;
}

// ── Internal QuickPick item shape ─────────────────────────────────────────────

interface RevisionPickerItem extends vscode.QuickPickItem {
  readonly revisionRef?: string;
  readonly revisionKind?: RevisionKind;
}

// ── Pure helpers (exported for testing) ──────────────────────────────────────

/**
 * Returns true when `input` looks like a partial or full Git SHA (4–40 lowercase hex chars).
 */
export function isLikelyShaPrefix(input: string): boolean {
  return /^[0-9a-f]{4,40}$/.test(input);
}

/**
 * Builds sectioned QuickPick items from branch and tag arrays.
 * Emits a separator + items for each non-empty group in order:
 *   1. Local branches
 *   2. Remote branches
 *   3. Tags
 */
export function buildRevisionPickerItems(
  branches: readonly BranchRef[],
  tags: readonly TagRef[]
): RevisionPickerItem[] {
  const items: RevisionPickerItem[] = [];

  const localBranches = branches.filter((b) => b.type === 'local');
  const remoteBranches = branches.filter((b) => b.type === 'remote');

  if (localBranches.length > 0) {
    items.push({ label: 'Local Branches', kind: vscode.QuickPickItemKind.Separator } as RevisionPickerItem);
    for (const branch of localBranches) {
      items.push({
        label: branch.name,
        description: branch.current ? '(current)' : undefined,
        revisionRef: branch.name,
        revisionKind: 'branch' as RevisionKind
      });
    }
  }

  if (remoteBranches.length > 0) {
    items.push({ label: 'Remote Branches', kind: vscode.QuickPickItemKind.Separator } as RevisionPickerItem);
    for (const branch of remoteBranches) {
      items.push({
        label: branch.name,
        revisionRef: branch.name,
        revisionKind: 'remote' as RevisionKind
      });
    }
  }

  if (tags.length > 0) {
    items.push({ label: 'Tags', kind: vscode.QuickPickItemKind.Separator } as RevisionPickerItem);
    for (const tag of tags) {
      items.push({
        label: tag.name,
        revisionRef: tag.name,
        revisionKind: 'tag' as RevisionKind
      });
    }
  }

  return items;
}

// ── Minimal git interface (avoids importing full GitService in tests) ──────────

export interface RevisionResolver {
  resolveRevisionToCommit(input: string): Promise<ResolvedCommitMeta | undefined>;
}

// ── pickRevisionToCompare ─────────────────────────────────────────────────────

/**
 * Presents a sectioned QuickPick for choosing a revision to compare against.
 * When the user types a SHA prefix (4–40 hex chars), the picker debounces
 * 150 ms and then calls `git.resolveRevisionToCommit` to prepend a synthetic
 * commit item at the top of the list.
 *
 * Returns the selected `RevisionSelection` or `undefined` if the user cancelled.
 */
export async function pickRevisionToCompare(
  git: RevisionResolver,
  branches: readonly BranchRef[],
  tags: readonly TagRef[]
): Promise<RevisionSelection | undefined> {
  return new Promise<RevisionSelection | undefined>((resolve) => {
    const qp = vscode.window.createQuickPick<RevisionPickerItem>();
    qp.placeholder = 'Select a branch, tag, or type a commit SHA…';
    qp.matchOnDescription = true;

    const baseItems = buildRevisionPickerItems(branches, tags);
    qp.items = baseItems;

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let syntheticItem: RevisionPickerItem | undefined;

    const clearSynthetic = () => {
      if (syntheticItem) {
        syntheticItem = undefined;
        qp.items = baseItems;
      }
    };

    qp.onDidChangeValue((value) => {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }

      const trimmed = value.trim().toLowerCase();
      if (!isLikelyShaPrefix(trimmed)) {
        clearSynthetic();
        return;
      }

      debounceTimer = setTimeout(async () => {
        qp.busy = true;
        try {
          const meta = await git.resolveRevisionToCommit(trimmed);
          if (meta) {
            const shortSha = meta.sha.slice(0, 7);
            syntheticItem = {
              label: `$(git-commit) ${shortSha}`,
              description: meta.subject,
              detail: `${meta.author}  ${meta.date}`,
              revisionRef: meta.sha,
              revisionKind: 'commit' as RevisionKind
            };
            qp.items = [syntheticItem, ...baseItems];
          } else {
            clearSynthetic();
          }
        } catch {
          clearSynthetic();
        } finally {
          qp.busy = false;
        }
      }, 150);
    });

    qp.onDidAccept(() => {
      const [selected] = qp.selectedItems;
      if (selected && selected.revisionRef && selected.revisionKind) {
        resolve({
          ref: selected.revisionRef,
          label: selected.label,
          kind: selected.revisionKind
        });
      } else {
        resolve(undefined);
      }
      qp.dispose();
    });

    qp.onDidHide(() => {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
      resolve(undefined);
      qp.dispose();
    });

    qp.show();
  });
}
