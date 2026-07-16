import * as assert from 'assert';
import { describe, it } from 'node:test';
import * as vscode from 'vscode';
import { StateStore } from '../state/stateStore';

function makeStubGit(): unknown {
  return {
    isRepo: async () => true,
    getLocalBranches: async () => [],
    getRemoteBranches: async () => [],
    getTagsBasic: async () => [],
    getTagAvailability: async () => new Map(),
    getStashes: async () => [],
    getWorkingTreeChanges: async () => [],
    getMergeConflicts: async () => [],
    getGraph: async () => [],
    getWorktrees: async () => [],
    getSubmodules: async () => []
  };
}

function makeLogger(): unknown {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
    dispose: () => undefined
  };
}

function makeWorkspaceState(): vscode.Memento {
  const data = new Map<string, unknown>();
  return {
    keys: () => Array.from(data.keys()) as readonly string[],
    get: <T>(key: string, defaultValue?: T): T | undefined =>
      data.has(key) ? (data.get(key) as T) : defaultValue,
    update: async (key: string, value: unknown) => {
      data.set(key, value);
    }
  } as vscode.Memento;
}

describe('StateStore compare layout orientation', () => {
  it('falls back to the vertical default when no workspaceState value is set', () => {
    const store = new StateStore(
      makeStubGit() as never,
      makeLogger() as never,
      { get: () => undefined } as never,
      makeWorkspaceState()
    );

    assert.strictEqual(store.getCompareLayoutOrientation(), 'vertical');
  });

  it('persists an explicit orientation across get calls', async () => {
    const store = new StateStore(
      makeStubGit() as never,
      makeLogger() as never,
      { get: () => undefined } as never,
      makeWorkspaceState()
    );

    await store.setCompareLayoutOrientation('horizontal');

    assert.strictEqual(store.getCompareLayoutOrientation(), 'horizontal');
  });

  it('normalizes an unexpected stored value back to vertical', async () => {
    const workspaceState = makeWorkspaceState();
    const store = new StateStore(
      makeStubGit() as never,
      makeLogger() as never,
      { get: () => undefined } as never,
      workspaceState
    );

    await workspaceState.update('vscodeGitClient.compareLayoutOrientation', 'sideways');

    assert.strictEqual(store.getCompareLayoutOrientation(), 'vertical');
  });
});
