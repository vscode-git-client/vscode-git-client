# Force SSH Pull — Design Spec

**Date:** 2026-06-09  
**Status:** Approved

## Summary

Add four quick-action commands that permanently rewrite a selected remote's URL from HTTPS to SSH format and then execute `git pull`. Providers covered: GitHub, GitLab, Bitbucket, and a user-supplied custom hostname.

---

## URL Conversion Logic

HTTPS and SSH remote URL formats:

```
HTTPS: https://{host}/{org}/{repo}.git
SSH:   git@{host}:{org}/{repo}.git
```

A shared helper `convertToSshUrl(currentUrl: string, targetHost: string): string | null`:

- Returns `null` if the URL already starts with `git@{targetHost}:` — already SSH, no rewrite needed.
- Otherwise extracts the path component (everything after the hostname in the HTTPS URL) and returns `git@{targetHost}:{path}`.
- Returns `null` for any URL that cannot be parsed (unrecognised format — leave remote untouched and pull anyway).

For the three named providers `targetHost` is hardcoded:

| Provider  | `targetHost`      |
|-----------|-------------------|
| GitHub    | `github.com`      |
| GitLab    | `gitlab.com`      |
| Bitbucket | `bitbucket.org`   |

For Custom, `targetHost` is whatever the user enters in the input box.

---

## Command Flow

All four commands share a single private method `sshPull(targetHost: string | 'prompt')`:

1. **Get remotes** — `git.getRemoteFetchUrls()` → `Map<remoteName, url>`.  
   If the map is empty, show an error message and abort.

2. **Pick remote** — `vscode.window.showQuickPick` listing every remote as  
   `"${name} — ${url}"`. Always show the picker even when only one remote exists.  
   If the user cancels, abort.

3. **[Custom only]** — If `targetHost === 'prompt'`, show  
   `vscode.window.showInputBox({ prompt: 'Enter SSH hostname', placeHolder: 'git.mycompany.com' })`.  
   If the user cancels or enters an empty string, abort.

4. **Convert URL** — Call `convertToSshUrl(currentUrl, targetHost)`.  
   - If `null` (already SSH or unrecognised format), skip steps 5–6 and go straight to pull.

5. **Rewrite remote** — `git.setRemoteUrl(remoteName, newSshUrl)`.

6. **Pull** — `git.pull()`.

7. **Refresh** — `state.refreshAll()`.

---

## New Commands

Four commands declared in `package.json` and registered in `commandController.ts`:

| Command ID                              | Title                         |
|-----------------------------------------|-------------------------------|
| `vscodeGitClient.git.sshPull.github`    | `Force SSH Pull (GitHub)`     |
| `vscodeGitClient.git.sshPull.gitlab`    | `Force SSH Pull (GitLab)`     |
| `vscodeGitClient.git.sshPull.bitbucket` | `Force SSH Pull (Bitbucket)`  |
| `vscodeGitClient.git.sshPull.custom`    | `Force SSH Pull (Custom Server)` |

Each calls `this.sshPull(host)` with its respective hardcoded host (or `'prompt'` for Custom).

---

## Changes to `openQuickActions()`

Four new entries inserted after `'Pull with preview'`:

```
{ label: 'Force SSH pull (GitHub)',        run: () => executeCommand('vscodeGitClient.git.sshPull.github') }
{ label: 'Force SSH pull (GitLab)',        run: () => executeCommand('vscodeGitClient.git.sshPull.gitlab') }
{ label: 'Force SSH pull (Bitbucket)',     run: () => executeCommand('vscodeGitClient.git.sshPull.bitbucket') }
{ label: 'Force SSH pull (Custom server)', run: () => executeCommand('vscodeGitClient.git.sshPull.custom') }
```

---

## Files Touched

| File | Change |
|------|--------|
| `src/commands/commandController.ts` | Add `convertToSshUrl` helper, `sshPull` method, four `register()` calls, four entries in `openQuickActions()` |
| `package.json` | Declare four new commands under `contributes.commands` |

---

## Out of Scope

- Reverting the SSH URL back to HTTPS.
- Support for non-standard SSH ports or non-`git` SSH usernames (custom server uses `git@` username).
- Handling remotes that already use SSH protocol other than `git@` (e.g., `ssh://git@...`).
