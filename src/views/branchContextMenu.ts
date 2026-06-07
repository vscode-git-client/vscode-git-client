import { CommandId } from '../commands/commandController/commandIds';
const branchContextMenuItems = [
  { command: CommandId.BranchCheckout, label: 'Checkout Branch' },
  { command: CommandId.BranchCompareWithCurrent, label: 'Compare With Current Branch' },
  { command: CommandId.BranchRename, label: 'Rename Branch' },
  { command: CommandId.BranchDelete, label: 'Delete Branch' },
  { separator: true },
  { command: CommandId.BranchTrack, label: 'Track Remote Branch' },
  { command: CommandId.BranchUntrack, label: 'Untrack Branch' },
  { command: CommandId.BranchMergeIntoCurrent, label: 'Merge Into Current' },
  { command: CommandId.BranchRebaseOnto, label: 'Rebase Current Onto Branch' }
] as const;

const tagContextMenuItems = [
  { command: CommandId.TagOpenCommits, label: 'Open Tag Commits' },
  { command: CommandId.TagCheckout, label: 'Checkout Tag' },
  { command: CommandId.TagCheckoutNewBranch, label: 'Checkout New Branch' },
  { separator: true },
  { command: CommandId.TagCopyRevisionNumber, label: 'Copy Revision Number' },
  { command: CommandId.TagShowRepositoryAtRevision, label: 'View Repository At Revision' },
  { command: CommandId.TagCompareWithCurrent, label: 'Compare With Current' },
  { command: CommandId.TagCreatePatch, label: 'Create Patch' }
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
  itemsSource: readonly ({ readonly command: string; readonly label: string } | { readonly separator: true })[]
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
