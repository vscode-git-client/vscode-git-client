# Commit Context Menu — Future Roadmap

Items removed from the commit context menu because they were permanently disabled
placeholders. Tracked here for future implementation.

---

## Undo Commit

**Target location:** Between `Revert Commit` and the separator before `Edit Commit Message...`

**Expected behaviour:**
- Undoes the most recent commit on the current branch (equivalent to `git reset --soft HEAD~1`)
- Should only be enabled when the selected commit is the branch tip and the branch is local
- Prompt for confirmation before executing
- Must not be available during a rebase or detached-HEAD state

**Suggested action key:** `undoCommit`

---

## Fixup

**Target location:** After `Edit Commit Message...`, before `Squash Into...`

**Expected behaviour:**
- Combines the selected commit into its parent commit, discarding the selected commit's message (like `git commit --fixup`)
- Only enabled when the selected commit is not the root and the branch is local
- Could leverage `interactiveRebaseFromHere` internally with a pre-built instruction sequence

**Suggested action key:** `fixup`

---

## Squash Into

**Target location:** After `Fixup`, before `Drop Commit`

**Expected behaviour:**
- Squashes the selected commit into its parent, opening an editor to merge both commit messages
- Only enabled when the selected commit is not the root and the branch is local
- Implement via an interactive rebase with a `squash` instruction

**Suggested action key:** `squashInto`

---

## Drop Commit

**Target location:** After `Squash Into`, before `Interactively Rebase from Here...`

**Expected behaviour:**
- Removes the selected commit from history entirely (like a `drop` instruction in an interactive rebase)
- Only enabled for non-root commits on a local branch
- Prompt for confirmation; warn if the commit has dependents (i.e. is not the tip)

**Suggested action key:** `dropCommit`

---

## Implementation notes

All four actions share common prerequisites that should be extracted into a shared guard:

- Branch must be local (not a remote-tracking ref)
- Working tree must be clean (no staged or unstaged changes)
- Repository must not currently be mid-rebase, mid-merge, or mid-cherry-pick

Enable/disable logic should be wired through `applyActionAvailability` in
`src/views/templates/partials/scripts/commitContextMenu.hbs`, and the
`initiallyDisabled` mechanism replaced with dynamic context-aware checks once
the server-side handlers exist.
