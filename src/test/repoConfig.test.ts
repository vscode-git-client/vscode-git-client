import * as assert from 'assert';
import { describe, it } from 'node:test';
import * as vscode from 'vscode';
import {
  validateConfigEmail,
  resolveConfigValue,
  handleRepoConfigUser
} from '../commands/commandController/handleRepoConfigUser';
import {
  buildCredentialHelperOptions,
  handleRepoConfigCredentialHelper
} from '../commands/commandController/handleRepoConfigCredentialHelper';
import { handleRepoConfigSslVerify } from '../commands/commandController/handleRepoConfigSslVerify';

// ── Pure helpers ──────────────────────────────────────────────────────────────

describe('validateConfigEmail', () => {
  it('accepts a valid address', () => {
    assert.strictEqual(validateConfigEmail('tung@example.com'), undefined);
  });
  it('rejects empty and malformed', () => {
    assert.notStrictEqual(validateConfigEmail('   '), undefined);
    assert.notStrictEqual(validateConfigEmail('no-at-sign'), undefined);
    assert.notStrictEqual(validateConfigEmail('a@b'), undefined);
  });
});

function fakeGit(config: Record<string, string>) {
  const sets: Array<{ key: string; value: string | null; scope: string }> = [];
  return {
    sets,
    async getConfig(key: string, scope: 'local' | 'global') {
      return config[`${scope}:${key}`];
    },
    async setConfig(key: string, value: string | null, scope: 'local' | 'global') {
      sets.push({ key, value, scope });
    }
  };
}

describe('resolveConfigValue (local → global fallback)', () => {
  it('prefers local when set', async () => {
    const git = fakeGit({ 'local:user.email': 'a@x.io', 'global:user.email': 'b@y.io' });
    assert.deepStrictEqual(await resolveConfigValue(git, 'user.email'), {
      value: 'a@x.io',
      scope: 'local'
    });
  });
  it('falls back to global', async () => {
    const git = fakeGit({ 'global:user.email': 'b@y.io' });
    assert.deepStrictEqual(await resolveConfigValue(git, 'user.email'), {
      value: 'b@y.io',
      scope: 'global'
    });
  });
  it('returns undefined when unset in both scopes', async () => {
    const git = fakeGit({});
    assert.strictEqual(await resolveConfigValue(git, 'user.email'), undefined);
  });
});

describe('buildCredentialHelperOptions', () => {
  it('offers osxkeychain only on darwin', () => {
    const mac = buildCredentialHelperOptions('darwin').map((o) => o.label);
    assert.ok(mac.includes('osxkeychain'));
    const win = buildCredentialHelperOptions('win32').map((o) => o.label);
    assert.ok(!win.includes('osxkeychain'));
    assert.ok(win.includes('manager-core'));
  });
  it('marks store as requiring confirmation and none as unset', () => {
    const opts = buildCredentialHelperOptions('linux');
    assert.strictEqual(opts.find((o) => o.label === 'store')?.requiresConfirm, true);
    assert.strictEqual(opts.find((o) => o.label === 'none')?.value, null);
  });
});

// ── Handler flows (drive the vscode stubs) ────────────────────────────────────

interface MockCall {
  showQuickPick: unknown[];
  showInputBox: unknown[];
  showWarningMessage: unknown[];
}

function patchWindow(calls: MockCall) {
  const win = vscode.window as unknown as Record<string, unknown>;
  const orig = {
    showQuickPick: win.showQuickPick,
    showInputBox: win.showInputBox,
    showWarningMessage: win.showWarningMessage,
    showInformationMessage: win.showInformationMessage
  };
  let qpIndex = 0;
  win.showQuickPick = async () => calls.showQuickPick[qpIndex++];
  let inIndex = 0;
  win.showInputBox = async () => calls.showInputBox[inIndex++];
  let wIndex = 0;
  win.showWarningMessage = async () => calls.showWarningMessage[wIndex++];
  win.showInformationMessage = async () => undefined;
  return () => {
    for (const [k, v] of Object.entries(orig)) win[k] = v;
  };
}

function fakeController(git: ReturnType<typeof fakeGit>) {
  return {
    git,
    logger: { info() {}, warn() {}, error() {} }
  } as never;
}

const callUser = handleRepoConfigUser as unknown as (this: never) => Promise<void>;
const callCred = handleRepoConfigCredentialHelper as unknown as (this: never) => Promise<void>;
const callSsl = handleRepoConfigSslVerify as unknown as (this: never) => Promise<void>;

describe('handleRepoConfigUser', () => {
  it('writes the trimmed value to the chosen scope', async () => {
    const git = fakeGit({});
    const restore = patchWindow({
      showQuickPick: [
        { label: 'Set user email', key: 'user.email', isEmail: true },
        { scope: 'global' }
      ],
      showInputBox: ['  tung@example.com  '],
      showWarningMessage: []
    });
    try {
      await callUser.call(fakeController(git));
    } finally {
      restore();
    }
    assert.deepStrictEqual(git.sets, [
      { key: 'user.email', value: 'tung@example.com', scope: 'global' }
    ]);
  });

  it('aborts without writing when cancelled at the value step', async () => {
    const git = fakeGit({});
    const restore = patchWindow({
      showQuickPick: [{ label: 'Set user name', key: 'user.name', isEmail: false }],
      showInputBox: [undefined],
      showWarningMessage: []
    });
    try {
      await callUser.call(fakeController(git));
    } finally {
      restore();
    }
    assert.strictEqual(git.sets.length, 0);
  });
});

describe('handleRepoConfigCredentialHelper', () => {
  it('passes a custom value straight through to the chosen scope', async () => {
    const git = fakeGit({});
    const opts = buildCredentialHelperOptions('linux');
    const custom = opts.find((o) => o.custom)!;
    const restore = patchWindow({
      showQuickPick: [custom, { scope: 'local' }],
      showInputBox: ['  my-helper  '],
      showWarningMessage: []
    });
    try {
      await callCred.call(fakeController(git));
    } finally {
      restore();
    }
    assert.deepStrictEqual(git.sets, [
      { key: 'credential.helper', value: 'my-helper', scope: 'local' }
    ]);
  });

  it('"none" unsets the local value (null)', async () => {
    const git = fakeGit({});
    const none = buildCredentialHelperOptions('linux').find((o) => o.label === 'none')!;
    const restore = patchWindow({
      showQuickPick: [none, { scope: 'local' }],
      showInputBox: [],
      showWarningMessage: []
    });
    try {
      await callCred.call(fakeController(git));
    } finally {
      restore();
    }
    assert.deepStrictEqual(git.sets, [{ key: 'credential.helper', value: null, scope: 'local' }]);
  });

  it('"store" aborts when the plaintext warning is dismissed', async () => {
    const git = fakeGit({});
    const store = buildCredentialHelperOptions('linux').find((o) => o.label === 'store')!;
    const restore = patchWindow({
      showQuickPick: [store],
      showInputBox: [],
      showWarningMessage: [undefined] // user dismisses
    });
    try {
      await callCred.call(fakeController(git));
    } finally {
      restore();
    }
    assert.strictEqual(git.sets.length, 0);
  });
});

describe('handleRepoConfigSslVerify', () => {
  it('disable goes through the warning and only ever writes local scope', async () => {
    const git = fakeGit({});
    const restore = patchWindow({
      showQuickPick: [{ action: 'disable' }],
      showInputBox: [],
      showWarningMessage: ['Disable SSL verification'] // confirmed
    });
    try {
      await callSsl.call(fakeController(git));
    } finally {
      restore();
    }
    assert.deepStrictEqual(git.sets, [{ key: 'http.sslVerify', value: 'false', scope: 'local' }]);
  });

  it('disable without confirmation applies nothing', async () => {
    const git = fakeGit({});
    const restore = patchWindow({
      showQuickPick: [{ action: 'disable' }],
      showInputBox: [],
      showWarningMessage: [undefined]
    });
    try {
      await callSsl.call(fakeController(git));
    } finally {
      restore();
    }
    assert.strictEqual(git.sets.length, 0);
  });
});
