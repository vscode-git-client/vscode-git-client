import * as assert from 'assert';
import { describe, it } from 'node:test';
import * as vscode from 'vscode';
import { openCompareWorkflow } from '../commands/commandController/openCompareWorkflow';

/**
 * Minimal fake of the createQuickPick surface that revisionPicker.ts uses:
 * it reads items, and settles when onDidAccept fires with selectedItems set.
 */
function installFakeRevisionPicker(ref: string) {
  const win = vscode.window as unknown as Record<string, unknown>;
  const orig = win.createQuickPick;
  win.createQuickPick = () => {
    const cbs: Record<string, (() => void) | undefined> = {};
    return {
      title: '',
      placeholder: '',
      matchOnDescription: true,
      buttons: [],
      items: [],
      busy: false,
      value: '',
      selectedItems: [{ revision: { ref, label: ref, kind: 'revision' } }],
      show() {
        // Auto-accept once shown so the promise settles deterministically.
        setTimeout(() => cbs.accept?.(), 0);
      },
      hide() {},
      dispose() {},
      onDidChangeValue(cb: () => void) {
        cbs.change = cb;
        return { dispose() {} };
      },
      onDidAccept(cb: () => void) {
        cbs.accept = cb;
        return { dispose() {} };
      },
      onDidHide(cb: () => void) {
        cbs.hide = cb;
        return { dispose() {} };
      },
      onDidTriggerButton(cb: () => void) {
        cbs.button = cb;
        return { dispose() {} };
      }
    } as unknown as vscode.QuickPick<vscode.QuickPickItem>;
  };
  return () => {
    win.createQuickPick = orig;
  };
}

function patchShowQuickPick(result: unknown) {
  const win = vscode.window as unknown as Record<string, unknown>;
  const orig = win.showQuickPick;
  win.showQuickPick = async () => result;
  return () => {
    win.showQuickPick = orig;
  };
}

const run = openCompareWorkflow as unknown as (this: never) => Promise<void>;

describe('openCompareWorkflow', () => {
  it('opens the compare view with current branch and the picked right revision', async () => {
    const opened: Array<[string, string]> = [];
    const controller = {
      git: {
        async getCurrentBranch() {
          return 'main';
        }
      },
      state: {
        branches: [],
        tags: [],
        async refreshBranches() {}
      },
      editor: {
        async openBranchCompare(left: string, right: string) {
          opened.push([left, right]);
        }
      }
    };
    const restoreQp = patchShowQuickPick({ label: 'main', index: 0 });
    const restoreRev = installFakeRevisionPicker('feature/x');
    try {
      await run.call(controller as never);
    } finally {
      restoreQp();
      restoreRev();
    }
    assert.deepStrictEqual(opened, [['main', 'feature/x']]);
  });

  it('opens the compare view with a picked left revision when not the current branch', async () => {
    const opened: Array<[string, string]> = [];
    const controller = {
      git: {
        async getCurrentBranch() {
          return 'main';
        }
      },
      state: { branches: [], tags: [], async refreshBranches() {} },
      editor: {
        async openBranchCompare(left: string, right: string) {
          opened.push([left, right]);
        }
      }
    };
    // First showQuickPick → "Choose another revision…"; the left picker and the
    // right picker both resolve to refs via the fake revision picker.
    const win = vscode.window as unknown as Record<string, unknown>;
    const origQp = win.showQuickPick;
    win.showQuickPick = async () => ({ label: 'Choose another revision…', index: 1 });
    // Alternate left/right refs from the fake revision picker.
    const revRefs = ['release/1.0', 'feature/y'];
    let revIdx = 0;
    const origCreate = win.createQuickPick;
    win.createQuickPick = () => {
      const ref = revRefs[revIdx++];
      const cbs: Record<string, (() => void) | undefined> = {};
      return {
        title: '',
        placeholder: '',
        matchOnDescription: true,
        buttons: [],
        items: [],
        busy: false,
        value: '',
        selectedItems: [{ revision: { ref, label: ref, kind: 'revision' } }],
        show() {
          setTimeout(() => cbs.accept?.(), 0);
        },
        hide() {},
        dispose() {},
        onDidChangeValue(cb: () => void) {
          cbs.change = cb;
          return { dispose() {} };
        },
        onDidAccept(cb: () => void) {
          cbs.accept = cb;
          return { dispose() {} };
        },
        onDidHide(cb: () => void) {
          cbs.hide = cb;
          return { dispose() {} };
        },
        onDidTriggerButton(cb: () => void) {
          cbs.button = cb;
          return { dispose() {} };
        }
      } as unknown as vscode.QuickPick<vscode.QuickPickItem>;
    };
    try {
      await run.call(controller as never);
    } finally {
      win.showQuickPick = origQp;
      win.createQuickPick = origCreate;
    }
    assert.deepStrictEqual(opened, [['release/1.0', 'feature/y']]);
  });

  it('does not open the compare view when the left step is cancelled', async () => {
    let openedCount = 0;
    const controller = {
      git: {
        async getCurrentBranch() {
          return 'main';
        }
      },
      state: { branches: [], tags: [], async refreshBranches() {} },
      editor: {
        async openBranchCompare() {
          openedCount++;
        }
      }
    };
    const restoreQp = patchShowQuickPick(undefined); // user cancels left step
    try {
      await run.call(controller as never);
    } finally {
      restoreQp();
    }
    assert.strictEqual(openedCount, 0);
  });

  it('does not open the compare view when the right revision is cancelled', async () => {
    let openedCount = 0;
    const controller = {
      git: {
        async getCurrentBranch() {
          return 'main';
        }
      },
      state: { branches: [], tags: [], async refreshBranches() {} },
      editor: {
        async openBranchCompare() {
          openedCount++;
        }
      }
    };
    const restoreQp = patchShowQuickPick({ label: 'main', index: 0 });
    // Right picker cancels → onDidHide settles with undefined.
    const win = vscode.window as unknown as Record<string, unknown>;
    const origCreate = win.createQuickPick;
    win.createQuickPick = () => {
      const cbs: Record<string, (() => void) | undefined> = {};
      return {
        title: '',
        placeholder: '',
        matchOnDescription: true,
        buttons: [],
        items: [],
        busy: false,
        value: '',
        selectedItems: [],
        show() {
          setTimeout(() => cbs.hideCb?.(), 0);
        },
        hide() {},
        dispose() {},
        onDidChangeValue(cb: () => void) {
          cbs.change = cb;
          return { dispose() {} };
        },
        onDidAccept(cb: () => void) {
          cbs.accept = cb;
          return { dispose() {} };
        },
        onDidHide(cb: () => void) {
          cbs.hideCb = cb;
          return { dispose() {} };
        },
        onDidTriggerButton(cb: () => void) {
          cbs.button = cb;
          return { dispose() {} };
        }
      } as unknown as vscode.QuickPick<vscode.QuickPickItem>;
    };
    try {
      await run.call(controller as never);
    } finally {
      restoreQp();
      win.createQuickPick = origCreate;
    }
    assert.strictEqual(openedCount, 0);
  });
});
