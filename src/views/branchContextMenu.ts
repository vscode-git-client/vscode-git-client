const branchContextMenuItems = [
  { command: 'vscodeGitClient.branch.checkout', label: 'Checkout Branch' },
  { command: 'vscodeGitClient.branch.compareWithCurrent', label: 'Compare With Current Branch' },
  { command: 'vscodeGitClient.branch.rename', label: 'Rename Branch' },
  { command: 'vscodeGitClient.branch.delete', label: 'Delete Branch' },
  { separator: true },
  { command: 'vscodeGitClient.branch.track', label: 'Track Remote Branch' },
  { command: 'vscodeGitClient.branch.untrack', label: 'Untrack Branch' },
  { command: 'vscodeGitClient.branch.mergeIntoCurrent', label: 'Merge Into Current' },
  { command: 'vscodeGitClient.branch.rebaseOnto', label: 'Rebase Current Onto Branch' }
] as const;

const tagContextMenuItems = [
  { command: 'vscodeGitClient.tag.openCommits', label: 'Open Tag Commits' },
  { command: 'vscodeGitClient.tag.checkout', label: 'Checkout Tag' },
  { command: 'vscodeGitClient.tag.checkoutNewBranch', label: 'Checkout New Branch' },
  { separator: true },
  { command: 'vscodeGitClient.tag.copyRevisionNumber', label: 'Copy Revision Number' },
  { command: 'vscodeGitClient.tag.showRepositoryAtRevision', label: 'View Repository At Revision' },
  { command: 'vscodeGitClient.tag.compareWithCurrent', label: 'Compare With Current' },
  { command: 'vscodeGitClient.tag.createPatch', label: 'Create Patch' }
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
