# Force SSH Pull — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four quick-action commands that permanently convert a remote's HTTPS URL to SSH and then pull, covering GitHub, GitLab, Bitbucket, and a user-supplied custom hostname.

**Architecture:** A pure `convertToSshUrl(url, host)` helper lives in `gitParsing.ts`. A shared private `sshPull(targetHost)` method in `CommandController` drives the picker → rewrite → pull flow. Four registered VS Code commands wire into that method; four entries are added to `openQuickActions()` and four command declarations are added to `package.json`.

**Tech Stack:** TypeScript, VS Code Extension API, Node.js built-in test runner (`node:test`).

---

## File Map

| File | Change |
|------|--------|
| `src/services/gitParsing.ts` | Add exported `convertToSshUrl` function |
| `src/test/gitParsing.test.ts` | Add tests for `convertToSshUrl` |
| `src/commands/commandController.ts` | Import `convertToSshUrl`; add `sshPull` method; add four `register()` calls; add four entries in `openQuickActions()` |
| `package.json` | Declare four new commands under `contributes.commands` |

---

### Task 1: Add `convertToSshUrl` to `gitParsing.ts` with tests

**Goal:** A tested, pure function that converts an HTTPS remote URL to SSH format for a given target host, returning `null` when no rewrite is needed or the URL is unrecognised.

**Files:**
- Modify: `src/services/gitParsing.ts`
- Modify: `src/test/gitParsing.test.ts`

**Acceptance Criteria:**
- [ ] `convertToSshUrl('https://github.com/org/repo.git', 'github.com')` returns `'git@github.com:org/repo.git'`
- [ ] `convertToSshUrl('git@github.com:org/repo.git', 'github.com')` returns `null`
- [ ] `convertToSshUrl('https://github.com/org/repo.git', 'git.company.com')` returns `'git@git.company.com:org/repo.git'`
- [ ] `convertToSshUrl('ssh://git@github.com/org/repo.git', 'github.com')` returns `null`
- [ ] All tests pass: `npm run test`

**Verify:** `npm run test` → output includes `✓ converts GitHub HTTPS to SSH` with no failures

**Steps:**

- [ ] **Step 1: Write the failing tests**

  Open `src/test/gitParsing.test.ts`. Find the last `it(...)` block before the closing `});` of the outer `describe`. Add a new `describe` block after all existing tests (inside the outer `describe`):

  ```typescript
  describe('convertToSshUrl', () => {
    it('converts GitHub HTTPS to SSH', () => {
      assert.strictEqual(
        convertToSshUrl('https://github.com/org/repo.git', 'github.com'),
        'git@github.com:org/repo.git'
      );
    });

    it('returns null when already SSH for the same host', () => {
      assert.strictEqual(
        convertToSshUrl('git@github.com:org/repo.git', 'github.com'),
        null
      );
    });

    it('converts HTTPS to SSH substituting a custom target host', () => {
      assert.strictEqual(
        convertToSshUrl('https://github.com/org/repo.git', 'git.company.com'),
        'git@git.company.com:org/repo.git'
      );
    });

    it('returns null for ssh:// URL (unrecognised format)', () => {
      assert.strictEqual(
        convertToSshUrl('ssh://git@github.com/org/repo.git', 'github.com'),
        null
      );
    });

    it('converts GitLab HTTPS to SSH', () => {
      assert.strictEqual(
        convertToSshUrl('https://gitlab.com/group/project.git', 'gitlab.com'),
        'git@gitlab.com:group/project.git'
      );
    });

    it('converts Bitbucket HTTPS to SSH', () => {
      assert.strictEqual(
        convertToSshUrl('https://bitbucket.org/team/repo.git', 'bitbucket.org'),
        'git@bitbucket.org:team/repo.git'
      );
    });
  });
  ```

  Also add `convertToSshUrl` to the import line at the top of the test file. The current import from `gitParsing` looks like:
  ```typescript
  import { formatComparisonSummary, parsePorcelainStatusZ, parseRevListComparison, parseTrack } from '../services/gitParsing';
  ```
  Change it to:
  ```typescript
  import { convertToSshUrl, formatComparisonSummary, parsePorcelainStatusZ, parseRevListComparison, parseTrack } from '../services/gitParsing';
  ```

- [ ] **Step 2: Verify tests fail**

  Run:
  ```bash
  npm run test
  ```
  Expected: compile error or test failure mentioning `convertToSshUrl` is not exported from `gitParsing`.

- [ ] **Step 3: Implement `convertToSshUrl` in `gitParsing.ts`**

  Open `src/services/gitParsing.ts`. Find the last exported function in the file and add the following after it:

  ```typescript
  /**
   * Converts a remote URL to SSH format for the given target host.
   * Returns null if the URL is already SSH for that host, or cannot be parsed.
   */
  export function convertToSshUrl(currentUrl: string, targetHost: string): string | null {
    if (currentUrl.startsWith(`git@${targetHost}:`)) {
      return null;
    }
    const match = currentUrl.match(/^https?:\/\/[^/]+\/(.+)$/);
    if (!match) {
      return null;
    }
    return `git@${targetHost}:${match[1]}`;
  }
  ```

- [ ] **Step 4: Verify tests pass**

  Run:
  ```bash
  npm run test
  ```
  Expected: all tests pass, including the six new `convertToSshUrl` tests. Zero failures.

- [ ] **Step 5: Commit**

  ```bash
  git add src/services/gitParsing.ts src/test/gitParsing.test.ts
  git commit -m "feat: add convertToSshUrl helper with tests"
  ```

---

### Task 2: Add `sshPull` method and register four commands

**Goal:** A shared `sshPull` private method in `CommandController` that drives the remote-picker → optional hostname-input → URL-rewrite → pull flow; plus four registered VS Code commands that call it.

**Files:**
- Modify: `src/commands/commandController.ts`

**Acceptance Criteria:**
- [ ] `CommandController` has a `private async sshPull(targetHost: string | 'prompt'): Promise<void>` method
- [ ] The method shows a remote picker, optionally prompts for hostname, rewrites if needed, then pulls
- [ ] Four commands are registered: `vscodeGitClient.git.sshPull.github`, `.gitlab`, `.bitbucket`, `.custom`
- [ ] `npm run compile` passes with no errors

**Verify:** `npm run compile` → exits 0, no TypeScript errors

**Steps:**

- [ ] **Step 1: Add the import for `convertToSshUrl`**

  In `src/commands/commandController.ts`, find the import line for `GitService`:
  ```typescript
  import { GitService } from '../services/gitService';
  ```
  Add a new import line immediately before it:
  ```typescript
  import { convertToSshUrl } from '../services/gitParsing';
  ```

- [ ] **Step 2: Add the `sshPull` private method**

  In `src/commands/commandController.ts`, find the `openQuickActions` method (it begins with `private async openQuickActions()`). Insert the following method **immediately before** `openQuickActions`:

  ```typescript
  private async sshPull(targetHost: string | 'prompt'): Promise<void> {
    const remoteUrls = await this.git.getRemoteFetchUrls();
    if (remoteUrls.size === 0) {
      void vscode.window.showErrorMessage('No remotes found in this repository.');
      return;
    }

    const remoteItems = [...remoteUrls.entries()].map(([name, url]) => ({
      label: name,
      description: url
    }));

    const picked = await vscode.window.showQuickPick(remoteItems, {
      title: 'Select remote to switch to SSH',
      placeHolder: 'Pick a remote'
    });
    if (!picked) {
      return;
    }

    const remoteName = picked.label;
    const currentUrl = remoteUrls.get(remoteName)!;

    let host: string;
    if (targetHost === 'prompt') {
      const input = await vscode.window.showInputBox({
        prompt: 'Enter SSH hostname',
        placeHolder: 'git.mycompany.com'
      });
      if (!input) {
        return;
      }
      host = input;
    } else {
      host = targetHost;
    }

    const sshUrl = convertToSshUrl(currentUrl, host);
    if (sshUrl !== null) {
      await this.git.setRemoteUrl(remoteName, sshUrl);
    }

    await this.git.pull();
    await this.state.refreshAll();
  }
  ```

- [ ] **Step 3: Register the four commands**

  In `src/commands/commandController.ts`, find the `register('vscodeGitClient.git.fetchPrune', ...)` block — it ends with `});`. Insert the following four `register` blocks immediately after the closing `});` of `fetchPrune`:

  ```typescript
    register('vscodeGitClient.git.sshPull.github', async () => {
      await this.sshPull('github.com');
    });

    register('vscodeGitClient.git.sshPull.gitlab', async () => {
      await this.sshPull('gitlab.com');
    });

    register('vscodeGitClient.git.sshPull.bitbucket', async () => {
      await this.sshPull('bitbucket.org');
    });

    register('vscodeGitClient.git.sshPull.custom', async () => {
      await this.sshPull('prompt');
    });
  ```

- [ ] **Step 4: Verify compilation**

  ```bash
  npm run compile
  ```
  Expected: exits 0, no TypeScript errors printed.

- [ ] **Step 5: Commit**

  ```bash
  git add src/commands/commandController.ts
  git commit -m "feat: add sshPull method and register four SSH pull commands"
  ```

---

### Task 3: Wire up quick actions and declare commands in `package.json`

**Goal:** The four SSH pull commands appear in the Quick Actions picker and in the VS Code command palette.

**Files:**
- Modify: `src/commands/commandController.ts` (quick actions entries)
- Modify: `package.json` (command declarations)

**Acceptance Criteria:**
- [ ] Four new entries appear in `openQuickActions()` after `'Pull with preview'`
- [ ] Four command declarations exist in `package.json` under `contributes.commands`
- [ ] `npm run compile` passes with no errors
- [ ] `npm run test` passes with no failures

**Verify:** `npm run test` → exits 0, no errors

**Steps:**

- [ ] **Step 1: Add four entries to `openQuickActions()`**

  In `src/commands/commandController.ts`, inside `openQuickActions()`, find the line:
  ```typescript
        { label: 'Pull with preview', run: async () => vscode.commands.executeCommand('vscodeGitClient.git.pullWithPreview') },
  ```
  Insert the following four lines immediately after it:
  ```typescript
        { label: 'Force SSH pull (GitHub)', run: async () => vscode.commands.executeCommand('vscodeGitClient.git.sshPull.github') },
        { label: 'Force SSH pull (GitLab)', run: async () => vscode.commands.executeCommand('vscodeGitClient.git.sshPull.gitlab') },
        { label: 'Force SSH pull (Bitbucket)', run: async () => vscode.commands.executeCommand('vscodeGitClient.git.sshPull.bitbucket') },
        { label: 'Force SSH pull (Custom server)', run: async () => vscode.commands.executeCommand('vscodeGitClient.git.sshPull.custom') },
  ```

- [ ] **Step 2: Declare the four commands in `package.json`**

  In `package.json`, find:
  ```json
        {
          "command": "vscodeGitClient.git.fetchPrune",
          "title": "Fetch --prune"
        },
  ```
  Insert the following immediately after that closing `},`:
  ```json
        {
          "command": "vscodeGitClient.git.sshPull.github",
          "title": "Force SSH Pull (GitHub)"
        },
        {
          "command": "vscodeGitClient.git.sshPull.gitlab",
          "title": "Force SSH Pull (GitLab)"
        },
        {
          "command": "vscodeGitClient.git.sshPull.bitbucket",
          "title": "Force SSH Pull (Bitbucket)"
        },
        {
          "command": "vscodeGitClient.git.sshPull.custom",
          "title": "Force SSH Pull (Custom Server)"
        },
  ```

- [ ] **Step 3: Verify compile and tests**

  ```bash
  npm run test
  ```
  Expected: exits 0, all tests pass.

- [ ] **Step 4: Commit**

  ```bash
  git add src/commands/commandController.ts package.json
  git commit -m "feat: add Force SSH Pull quick actions and command palette entries"
  ```
