import * as assert from 'assert';
import { describe, it } from 'node:test';
import {
  isBranchContextMenuCommand,
  isTagContextMenuCommand,
  renderBranchContextMenu
} from '../views/branchContextMenu';

describe('branch/tag search context menus', () => {
  it('keeps branch and tag command allow-lists separate', () => {
    assert.strictEqual(isBranchContextMenuCommand('vscodeGitClient.branch.checkout'), true);
    assert.strictEqual(isBranchContextMenuCommand('vscodeGitClient.tag.checkout'), false);
    assert.strictEqual(isTagContextMenuCommand('vscodeGitClient.tag.checkout'), true);
    assert.strictEqual(isTagContextMenuCommand('vscodeGitClient.branch.delete'), false);
  });

  it('renders separate branch and tag menus', () => {
    const html = renderBranchContextMenu();

    assert.match(html, /id="branch-context-menu"/);
    assert.match(html, /id="tag-context-menu"/);
    assert.match(html, /data-command="vscodeGitClient\.branch\.rename"/);
    assert.match(html, /data-command="vscodeGitClient\.tag\.checkoutNewBranch"/);
  });
});
