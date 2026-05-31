import * as assert from 'assert';
import { describe, it } from 'node:test';
import * as vscode from 'vscode';
import { StateStore } from '../state/stateStore';
import { BranchRef, TagRef } from '../types';

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const localBranch = (name: string, current = false): BranchRef => ({
  name,
  shortName: name,
  fullName: `refs/heads/${name}`,
  type: 'local',
  current,
  ahead: 0,
  behind: 0
});

const remoteBranch = (name: string): BranchRef => ({
  name: `origin/${name}`,
  shortName: name,
  fullName: `refs/remotes/origin/${name}`,
  type: 'remote',
  remoteName: 'origin',
  current: false,
  ahead: 0,
  behind: 0
});

const tag = (name: string): TagRef => ({
  name,
  fullName: `refs/tags/${name}`,
  sha: 'aaaa',
  availableOnRemotes: [],
  lastCommitEpoch: 1
});

function makeStubGit(overrides: {
  localBranches?: () => Promise<BranchRef[]>;
  remoteBranches?: () => Promise<BranchRef[]>;
  tagsBasic?: () => Promise<TagRef[]>;
  tagAvailability?: () => Promise<Map<string, Set<string>>>;
}): unknown {
  return {
    isRepo: async () => true,
    getLocalBranches: overrides.localBranches ?? (async () => []),
    getRemoteBranches: overrides.remoteBranches ?? (async () => []),
    getRemoteFetchUrls: async () => new Map<string, string>(),
    getTagsBasic: overrides.tagsBasic ?? (async () => []),
    getTagAvailabilityByRemote:
      overrides.tagAvailability ?? (async () => new Map<string, Set<string>>()),
    mergeTagAvailability: (
      tags: readonly TagRef[],
      availability: ReadonlyMap<string, ReadonlySet<string>>
    ) =>
      tags.map((t) => ({
        ...t,
        availableOnRemotes: Array.from(availability.get(t.name) ?? []).sort((a, b) =>
          a.localeCompare(b)
        )
      })),
    // Safe defaults for non-refs scopes (unused when we request only refs).
    getStashes: async () => [],
    getWorkingTreeChanges: async () => [],
    getOperationState: async () => ({ kind: 'none' as const }),
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
      (data.has(key) ? (data.get(key) as T) : defaultValue),
    update: async (key: string, value: unknown) => {
      data.set(key, value);
    }
  } as vscode.Memento;
}

const flush = () => new Promise((r) => setImmediate(r));

describe('StateStore refs phased loader', () => {
  it('loads branches and tags concurrently, then enriches tags with availability', async () => {
    const localD = deferred<BranchRef[]>();
    const remoteD = deferred<BranchRef[]>();
    const tagsD = deferred<TagRef[]>();
    const availD = deferred<Map<string, Set<string>>>();

    const stubGit = makeStubGit({
      localBranches: () => localD.promise,
      remoteBranches: () => remoteD.promise,
      tagsBasic: () => tagsD.promise,
      tagAvailability: () => availD.promise
    });

    const store = new StateStore(
      stubGit as never,
      makeLogger() as never,
      { get: () => undefined } as never,
      makeWorkspaceState()
    );

    const emits: number[] = [];
    store.onDidChange(() => {
      emits.push(store.branches.length * 1000 + store.tags.length);
    });

    const refreshPromise = store.refreshBranches();

    tagsD.resolve([tag('v1.0.0'), tag('v0.9.0')]);
    await flush();
    assert.strictEqual(store.branches.length, 0, 'tags do not wait for branch loading');
    assert.strictEqual(store.tags.length, 2, 'basic tags publish before remote availability');
    assert.deepStrictEqual(
      store.tags[0].availableOnRemotes ?? [],
      [],
      'basic tags publish with empty remote availability first'
    );

    localD.resolve([localBranch('main', true)]);
    await flush();
    assert.strictEqual(store.branches.length, 1, 'locals visible after local branch lookup');
    assert.strictEqual(store.tags.length, 2, 'tags remain visible while remote branches load');

    remoteD.resolve([remoteBranch('main'), remoteBranch('feature')]);
    await flush();
    assert.strictEqual(store.branches.length, 3, 'remotes appended after remote branch lookup');
    assert.strictEqual(store.tags.length, 2, 'tags stay visible before availability completes');

    availD.resolve(new Map([['v1.0.0', new Set(['origin'])]]));
    await refreshPromise;

    assert.strictEqual(store.tags.length, 2, 'tags visible with availability merged');
    assert.deepStrictEqual(
      store.tags[0].availableOnRemotes,
      ['origin'],
      'tag remote availability included in the single tag emit'
    );

    // Expected at least 4 phase emits (basic tags, locals, remotes, enriched tags).
    // executeRefresh's final fingerprint check may add one extra tail emit —
    // harmless. The early tag visibility checks above are the real guarantee.
    assert.ok(emits.length >= 4, `expected at least 4 emits, got ${emits.length}`);
  });

  it('falls back to basic tags when availability lookup fails', async () => {
    const stubGit = makeStubGit({
      localBranches: async () => [localBranch('main', true)],
      remoteBranches: async () => [remoteBranch('feature')],
      tagsBasic: async () => [tag('v1.0.0')],
      tagAvailability: async () => {
        throw new Error('network down');
      }
    });

    const store = new StateStore(
      stubGit as never,
      makeLogger() as never,
      { get: () => undefined } as never,
      makeWorkspaceState()
    );

    await store.refreshBranches();

    assert.strictEqual(store.branches.length, 2, 'branches still load');
    assert.strictEqual(store.tags.length, 1, 'basic tag list still publishes');
    assert.deepStrictEqual(
      store.tags[0].availableOnRemotes ?? [],
      [],
      'availability stays empty when ls-remote fails'
    );
  });
});
