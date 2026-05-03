# Context Menus

## Commit Context Menu

Used in:
- Filter Graph
- Compare Branches

Shared implementation:
- Markup: `src/views/templates/partials/compareContextMenu.hbs`
- Style: `src/views/templates/partials/styles/contextMenu.hbs`
- Script handler: `src/views/templates/partials/scripts/commitContextMenu.hbs`
- Command routing: `src/views/commitActions.ts`

Actions:
- Open Details: open commit details.
- Copy Revision Number: copy commit SHA.
- Create Patch: open commit patch as diff.
- Cherry-Pick: cherry-pick selected commit.
- Checkout Revision: checkout detached HEAD at commit.
- Show Repository at Revision: browse repository snapshot.
- Compare with Local: compare commit with current branch.
- Reset Current Branch to Here: reset current branch to commit.
- Revert Commit: revert selected commit.
- Interactive Rebase from Here: start interactive rebase from commit.
- New Branch: create branch at commit.
- New Tag: create tag at commit.
- Go to Parent Commit: open parent commit.

Disabled placeholders:
- Undo Commit.
- Edit Commit Message.
- Fixup.
- Squash Into.
- Drop Commit.
- Push All up to Here.
- Go to Child Commit.
