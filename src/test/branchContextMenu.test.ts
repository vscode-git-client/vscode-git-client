import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
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

  it('opens the action menu when a search result row is clicked', () => {
    const template = fs.readFileSync(
      path.join(__dirname, '../../src/views/templates/branchSearchView.hbs'),
      'utf8'
    );
    const listClickHandler = template.match(
      /listEl\.addEventListener\('click',[\s\S]*?\n    \}\);/
    );

    assert.ok(listClickHandler, 'expected branch search list click handler');
    assert.match(
      listClickHandler[0],
      /openMenu\(rect\.left \+ 28, rect\.bottom \+ 4, name, kind\)/
    );
    assert.doesNotMatch(listClickHandler[0], /postMessage\(\{ type: 'checkout(Tag)?'/);
  });
});
