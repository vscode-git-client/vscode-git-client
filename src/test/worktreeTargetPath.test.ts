import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, it } from 'node:test';
import {
  buildDefaultWorktreeDirectoryName,
  normalizeWorktreePathSegment,
  resolveWorktreeTargetPath
} from '../services/worktreeTargetPath';

const tempRoots: string[] = [];

async function makeTempRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vscode-git-client-worktree-'));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  );
});

describe('Worktree target path utilities', () => {
  it('normalizes branch names for filesystem-safe generated folders', () => {
    assert.strictEqual(normalizeWorktreePathSegment('feature/foo'), 'feature-foo');
    assert.strictEqual(
      normalizeWorktreePathSegment('refs/heads/release/2026.06'),
      'release-2026.06'
    );
    assert.strictEqual(
      buildDefaultWorktreeDirectoryName('/repos/sample-project', 'staging'),
      'sample-project-staging'
    );
  });

  it('uses a selected empty folder as the worktree destination', async () => {
    const root = await makeTempRoot();
    const selected = path.join(root, 'empty-target');
    await fs.mkdir(selected);

    const resolved = await resolveWorktreeTargetPath(selected, '/repos/sample-project', 'staging');

    assert.deepStrictEqual(resolved, { ok: true, targetPath: selected });
  });

  it('treats a selected non-empty folder as the parent for a generated target folder', async () => {
    const root = await makeTempRoot();
    const selected = path.join(root, 'parent');
    await fs.mkdir(selected);
    await fs.writeFile(path.join(selected, 'existing-file.txt'), 'data');

    const resolved = await resolveWorktreeTargetPath(
      selected,
      '/repos/sample-project',
      'feature/staging'
    );

    assert.deepStrictEqual(resolved, {
      ok: true,
      targetPath: path.join(selected, 'sample-project-feature-staging')
    });
  });

  it('stops when the generated target already exists', async () => {
    const root = await makeTempRoot();
    const selected = path.join(root, 'parent');
    const target = path.join(selected, 'sample-project-staging');
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(selected, 'existing-file.txt'), 'data');

    const resolved = await resolveWorktreeTargetPath(selected, '/repos/sample-project', 'staging');

    assert.strictEqual(resolved.ok, false);
    if (!resolved.ok) {
      assert.match(resolved.message, /already exists or contains data/);
      assert.match(resolved.message, /sample-project-staging/);
    }
  });
});
