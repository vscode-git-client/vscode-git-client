import * as assert from 'assert';
import { afterEach, describe, it } from 'node:test';
import * as vscode from 'vscode';
import { CommandController } from '../commands/commandController';
import { handleCommitAction } from '../views/commitActions';

describe('commit context menu copy actions', () => {
  const originalWriteText = vscode.env.clipboard.writeText;

  afterEach(() => {
    (
      vscode.env.clipboard as unknown as { writeText: typeof vscode.env.clipboard.writeText }
    ).writeText = originalWriteText;
  });

  function captureClipboard(): { text(): string } {
    let copied = '';
    (vscode.env.clipboard as unknown as { writeText(value: string): Promise<void> }).writeText =
      async (value: string) => {
        copied = value;
      };
    return { text: () => copied };
  }

  it('copies commit IDs in time ascending (reversed view) order by default', async () => {
    const clipboard = captureClipboard();

    await handleCommitAction({
      type: 'commitAction',
      action: 'copyCommitId',
      sha: 'aaa',
      shas: ['aaa', 'bbb', 'ccc']
    });

    assert.strictEqual(clipboard.text(), 'ccc\nbbb\naaa');
  });

  it('reverses commit IDs to view order when reverseOrder is set (Shift+Click)', async () => {
    const clipboard = captureClipboard();

    await handleCommitAction({
      type: 'commitAction',
      action: 'copyCommitId',
      sha: 'aaa',
      shas: ['aaa', 'bbb', 'ccc'],
      reverseOrder: true
    });

    assert.strictEqual(clipboard.text(), 'aaa\nbbb\nccc');
  });

  it('copies commit messages in time ascending (reversed view) order by default', async () => {
    const clipboard = captureClipboard();

    await handleCommitAction({
      type: 'commitAction',
      action: 'copyCommitMessage',
      sha: 'aaa',
      shas: ['aaa', 'bbb'],
      subject: 'First',
      subjects: ['First', 'Second']
    });

    assert.strictEqual(clipboard.text(), 'Second\nFirst');
  });

  it('reverses commit messages to view order when reverseOrder is set', async () => {
    const clipboard = captureClipboard();

    await handleCommitAction({
      type: 'commitAction',
      action: 'copyCommitMessage',
      sha: 'aaa',
      shas: ['aaa', 'bbb'],
      subject: 'First',
      subjects: ['First', 'Second'],
      reverseOrder: true
    });

    assert.strictEqual(clipboard.text(), 'First\nSecond');
  });

  it('has nothing to reverse for a single-commit copy', async () => {
    const clipboard = captureClipboard();

    await handleCommitAction({
      type: 'commitAction',
      action: 'copyCommitId',
      sha: 'aaa',
      reverseOrder: true
    });

    assert.strictEqual(clipboard.text(), 'aaa');
  });

  it('CommandController.handleGraphCopyCommitId copies in time ascending order', async () => {
    const clipboard = captureClipboard();
    const controller = new CommandController(
      {} as never,
      {
        branches: [],
        conflicts: [],
        graph: [],
        refreshAll: async () => undefined
      } as never,
      {} as never,
      { error() {}, warn() {}, info() {} } as never,
      {} as never,
      { fsPath: '/mock/extension/path' } as vscode.Uri
    );

    await controller.handleGraphCopyCommitId(undefined, [
      { sha: 'aaa' },
      { sha: 'bbb' },
      { sha: 'ccc' }
    ]);

    assert.strictEqual(clipboard.text(), 'ccc\nbbb\naaa');
  });

  it('CommandController.handleGraphCopyCommitMessage copies in time ascending order', async () => {
    const clipboard = captureClipboard();
    const controller = new CommandController(
      {} as never,
      {
        branches: [],
        conflicts: [],
        graph: [
          { sha: 'aaa', subject: 'First' },
          { sha: 'bbb', subject: 'Second' }
        ],
        refreshAll: async () => undefined
      } as never,
      {} as never,
      { error() {}, warn() {}, info() {} } as never,
      {} as never,
      { fsPath: '/mock/extension/path' } as vscode.Uri
    );

    await controller.handleGraphCopyCommitMessage(undefined, [{ sha: 'aaa' }, { sha: 'bbb' }]);

    assert.strictEqual(clipboard.text(), 'Second\nFirst');
  });
});
