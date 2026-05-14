# Settings

You can customize the behavior of the extension via VS Code settings.

| Setting | Default | Description |
| --- | --- | --- |
| `vscodeGitClient.gitPath` | `"git"` | Git executable path |
| `vscodeGitClient.commandTimeoutMs` | `15000` | Timeout for Git commands in milliseconds |
| `vscodeGitClient.maxGraphCommits` | `200` | Maximum commits shown in Git Graph |
| `vscodeGitClient.recentBranchesCount` | `3` | Number of branches shown in the Recent group |
| `vscodeGitClient.gutterMarkers.enabled` | `true` | Show inline gutter markers for lines added, modified, or deleted vs `HEAD` |
| `vscodeGitClient.gutterMarkers.maxFileSizeKb` | `512` | Skip gutter marker computation for files larger than this size in KB |
| `vscodeGitClient.gutterMarkers.maxLineCount` | `10000` | Skip gutter marker computation for files with more lines than this value |
| `vscodeGitClient.performance.logGitCommands` | `false` | Log Git commands that take 500ms or longer to the extension output channel |
| `vscodeGitClient.performance.refreshDebounceMs` | `250` | Debounce delay for VS Code Git repository-state auto-refresh events |
| `vscodeGitClient.performance.saveRefreshDebounceMs` | `150` | Debounce delay for save-triggered working-tree refresh events |
| `vscodeGitClient.compare.exportFormat` | `"csv"` | Compare Branches export format: `csv` for two files, or `excel` for one `.xlsx` with two sheets |
| `vscodeGitClient.commitMessageTemplates` | see below | Reusable commit message templates with `{branch}`, `{ticket}`, `{scope}`, and `{cursor}` placeholders |
| `vscodeGitClient.commitMessageTicketPattern` | `"[A-Z]+-\\d+"` | Regex used to extract a ticket id from the current branch name |
| `vscodeGitClient.aiGenerateTimeoutMs` | `5000` | Timeout for AI commit message generation in milliseconds |

Existing `intelliGit.*` settings are still read as a legacy fallback when the matching `vscodeGitClient.*` setting has not been configured.

## Default commit message templates:

```json
[
  { "label": "feat", "template": "feat({scope}): {cursor}" },
  { "label": "fix", "template": "fix({scope}): {cursor}" },
  { "label": "chore", "template": "chore: {cursor}" },
  { "label": "ticket", "template": "[{ticket}] {cursor}" }
]
```

## Performance Notes

The extension activates lazily when one of its views or commands is used. Refreshes are scoped to the visible surface where possible. VS Code Git repository-state events and save events refresh working-tree state without reloading every branch, tag, stash, worktree, submodule, and graph slice.

On Windows, Git command execution uses lower concurrency than macOS/Linux to reduce `CreateProcess` pressure on the Extension Host. Additional mitigations include configurable refresh debounce settings, parallel operation-state detection, cached gutter configuration, and save debounce.

If a workspace still feels slow, enable `vscodeGitClient.performance.logGitCommands` and inspect the extension output channel for slow Git operations. Adding the repository folder and `.git` directory to Windows Defender exclusions usually has the largest practical impact.
