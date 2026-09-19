import * as assert from 'assert';
import { describe, it } from 'node:test';
import * as vscode from 'vscode';
import { handleRemoteConvertUrl } from '../commands/commandController/handleRemoteConvertUrl';

function patchWindow(calls: {
  showQuickPick: unknown[];
  showWarningMessage: unknown[];
  showInformationMessage: unknown[];
  showErrorMessage: unknown[];
}) {
  const win = vscode.window as unknown as Record<string, unknown>;
  const orig = {
    showQuickPick: win.showQuickPick,
    showWarningMessage: win.showWarningMessage,
    showInformationMessage: win.showInformationMessage,
    showErrorMessage: win.showErrorMessage
  };
  let qp = 0;
  win.showQuickPick = async () => calls.showQuickPick[qp++];
  let w = 0;
  win.showWarningMessage = async () => calls.showWarningMessage[w++];
  const infos: unknown[] = [];
  win.showInformationMessage = (...args: unknown[]) => {
    infos.push(args);
    return Promise.resolve(undefined);
  };
  const errors: unknown[] = [];
  win.showErrorMessage = (...args: unknown[]) => {
    errors.push(args);
    return Promise.resolve(undefined);
  };
  return { infos, errors, restore: () => Object.assign(win, orig) };
}

function fakeController(remoteUrl: string | undefined) {
  const calls: string[] = [];
  const git = {
    async getRemoteFetchUrls() {
      return new Map(remoteUrl ? [['origin', remoteUrl]] : []);
    },
    async setRemoteUrl(name: string, url: string) {
      calls.push(`set:${name}:${url}`);
    },
    async runGit() {
      calls.push('fetch');
      return { stdout: '', stderr: '' };
    },
    async pull() {
      calls.push('pull');
      return undefined;
    }
  };
  const controller = {
    git,
    calls,
    state: { async refreshBranches() {}, async refreshAll() {} },
    logger: { info() {}, warn() {}, error() {} }
  };
  return controller;
}

const run = handleRemoteConvertUrl as unknown as (this: never) => Promise<void>;

describe('handleRemoteConvertUrl', () => {
  it('converts an HTTPS remote to SSH after confirmation', async () => {
    const controller = fakeController('https://github.com/org/repo.git');
    const { restore, infos } = patchWindow({
      showQuickPick: [{ label: 'origin' }, { label: 'Convert to SSH', target: 'ssh' }],
      showWarningMessage: ['Change URL'],
      showInformationMessage: [],
      showErrorMessage: []
    });
    try {
      await run.call(controller as never);
    } finally {
      restore();
    }
    assert.ok(controller.calls.includes('set:origin:git@github.com:org/repo.git'));
    assert.ok(!controller.calls.includes('pull'), 'conversion must not pull');
    assert.strictEqual(infos.length, 1);
  });

  it('does not mutate when the confirmation is dismissed', async () => {
    const controller = fakeController('https://github.com/org/repo.git');
    const { restore } = patchWindow({
      showQuickPick: [{ label: 'origin' }, { label: 'Convert to SSH', target: 'ssh' }],
      showWarningMessage: [undefined],
      showInformationMessage: [],
      showErrorMessage: []
    });
    try {
      await run.call(controller as never);
    } finally {
      restore();
    }
    assert.strictEqual(controller.calls.length, 0);
  });

  it('offers only the opposite scheme for an SSH remote', async () => {
    const controller = fakeController('git@github.com:org/repo.git');
    let targetItems: Array<{ label: string }> = [];
    const win = vscode.window as unknown as Record<string, unknown>;
    const orig = win.showQuickPick;
    const { restore, infos } = patchWindow({
      showQuickPick: [{ label: 'origin' }],
      showWarningMessage: ['Change URL'],
      showInformationMessage: [],
      showErrorMessage: []
    });
    // After the first showQuickPick (remote list), capture the target-scheme list.
    let firstCall = true;
    win.showQuickPick = async (items: Array<{ label: string }>) => {
      if (firstCall) {
        firstCall = false;
        return { label: 'origin' };
      }
      targetItems = items;
      return items.find((i) => i.label === 'Convert to HTTPS');
    };
    try {
      await run.call(controller as never);
    } finally {
      win.showQuickPick = orig;
      restore();
    }
    assert.deepStrictEqual(
      targetItems.map((i) => i.label),
      ['Convert to HTTPS']
    );
    assert.strictEqual(controller.calls.length, 1);
    assert.ok(controller.calls[0].startsWith('set:origin:https://'));
    assert.strictEqual(infos.length, 1);
  });

  it('reports "cannot be converted" for an unparseable URL and mutates nothing', async () => {
    const controller = fakeController('not-a-url');
    const { restore, infos } = patchWindow({
      showQuickPick: [{ label: 'origin' }, { label: 'Convert to SSH', target: 'ssh' }],
      showWarningMessage: [],
      showInformationMessage: [],
      showErrorMessage: []
    });
    try {
      await run.call(controller as never);
    } finally {
      restore();
    }
    assert.strictEqual(controller.calls.length, 0);
    assert.strictEqual(infos.length, 1);
    assert.match(String((infos[0] as unknown[])[0]), /cannot be converted/i);
  });

  it('errors when the repo has no remotes', async () => {
    const controller = fakeController(undefined);
    const { restore, errors } = patchWindow({
      showQuickPick: [],
      showWarningMessage: [],
      showInformationMessage: [],
      showErrorMessage: []
    });
    try {
      await run.call(controller as never);
    } finally {
      restore();
    }
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(controller.calls.length, 0);
  });
});
