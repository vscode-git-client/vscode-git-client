import { GitCommand } from '../config/commands';

const branchContextMenuItems = [
  { command: GitCommand.BranchCheckout, label: 'Checkout Branch' },
  { command: GitCommand.BranchCompareWithCurrent, label: 'Compare With Current Branch' },
  { command: GitCommand.BranchRename, label: 'Rename Branch' },
  { command: GitCommand.BranchDelete, label: 'Delete Branch' },
  { separator: true },
  { command: GitCommand.BranchTrack, label: 'Track Remote Branch' },
  { command: GitCommand.BranchUntrack, label: 'Untrack Branch' },
  { command: GitCommand.BranchMergeIntoCurrent, label: 'Merge Into Current' },
  { command: GitCommand.BranchRebaseOnto, label: 'Rebase Current Onto Branch' }
] as const;

const tagContextMenuItems = [
  { command: GitCommand.TagOpenCommits, label: 'Open Tag Commits' },
  { command: GitCommand.TagCheckout, label: 'Checkout Tag' },
  { command: GitCommand.TagCheckoutNewBranch, label: 'Checkout New Branch' },
  { separator: true },
  { command: GitCommand.TagCopyRevisionNumber, label: 'Copy Revision Number' },
  { command: GitCommand.TagShowRepositoryAtRevision, label: 'View Repository At Revision' },
  { command: GitCommand.TagCompareWithCurrent, label: 'Compare With Current' },
  { command: GitCommand.TagCreatePatch, label: 'Create Patch' }
] as const;

export type BranchContextMenuCommand = Extract<
  (typeof branchContextMenuItems)[number],
  { readonly command: string }
>['command'];

export type TagContextMenuCommand = Extract<
  (typeof tagContextMenuItems)[number],
  { readonly command: string }
>['command'];

const branchContextMenuCommands = new Set<string>(
  branchContextMenuItems.flatMap((item) => ('command' in item ? [item.command] : []))
);
const tagContextMenuCommands = new Set<string>(
  tagContextMenuItems.flatMap((item) => ('command' in item ? [item.command] : []))
);

export function isBranchContextMenuCommand(command: string): command is BranchContextMenuCommand {
  return branchContextMenuCommands.has(command);
}

export function isTagContextMenuCommand(command: string): command is TagContextMenuCommand {
  return tagContextMenuCommands.has(command);
}

export function renderBranchContextMenu(): string {
  return [
    renderContextMenu('branch-context-menu', 'Branch context menu', branchContextMenuItems),
    renderContextMenu('tag-context-menu', 'Tag context menu', tagContextMenuItems)
  ].join('\n');
}

function renderContextMenu(
  id: string,
  label: string,
  itemsSource: readonly (
    { readonly command: string; readonly label: string } | { readonly separator: true }
  )[]
): string {
  const items = itemsSource
    .map((item) => {
      if ('separator' in item) {
        return '    <div class="menu-separator"></div>';
      }
      return `    <button class="menu-item" data-command="${escapeHtml(item.command)}">${escapeHtml(item.label)}</button>`;
    })
    .join('\n');

  return [
    `  <div id="${id}" class="context-menu" role="menu" aria-label="${escapeHtml(label)}">`,
    items,
    '  </div>'
  ].join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
