import * as vscode from 'vscode';
import { getConfigValue } from '../../configuration';
import { EditorOrchestrator } from '../../editor/editorOrchestrator';
import { confirmDangerousAction } from '../../guards';
import { Logger } from '../../logger';
import { BranchRemoteNode, BranchTreeItem, TagTreeItem } from '../../providers/branchTreeProvider';
import {
  CommitActionContext,
  CommitFileTreeItem,
  CommitRangeFileTreeItem,
  RevisionFileTreeItem,
  WorkingTreeCompareFileTreeItem
} from '../../providers/commitFilesTreeProvider';
import { GraphCommitFileTreeItem, GraphCommitTreeItem } from '../../providers/graphTreeProvider';
import { StashTreeItem } from '../../providers/stashTreeProvider';
import { SubmoduleTreeItem } from '../../providers/submoduleTreeProvider';
import { WorktreeTreeItem } from '../../providers/worktreeTreeProvider';
import { GitService } from '../../services/gitService';
import { expandTemplate, loadTemplates } from '../../state/commitTemplates';
import { StateStore } from '../../state/stateStore';
import { BranchSearchView } from '../../views/branchSearchView';
import { GraphFilterSession } from '../../views/graphFilterSession';
import { GraphFilterView } from '../../views/graphFilterView';
import { pickRevisionToCompare, RevisionSelection } from '../../views/revisionPicker';
import { applyPatchToWorkingTree } from './applyPatchToWorkingTree';
import { normalizeBranchActionHubArg, resolveBranchNameForActionHub } from './branchNameHelpers';
import { classifyCherryPickIssue, classifyMergeIssue, classifyRebaseIssue } from './classifyIssues';
import { getActiveFilePath } from './getActiveFilePath';
import { getBuiltInGitRepository } from './getBuiltInGitRepository';
import { getErrorSummary } from './getErrorSummary';
import { openBranchActionHub } from './openBranchActionHub';
import { openCommitDetails } from './openCommitDetails';
import { openCompareWorkflow } from './openCompareWorkflow';
import { openDiffWorkflow } from './openDiffWorkflow';
import { openDirectoryTimeline } from './openDirectoryTimeline';
import { openQuickActions } from './openQuickActions';
import { openBranchCommits, openRefCommits } from './openRefCommits';
import { openCommitActionContextDiffs, openSelectedFileDiffs } from './openSelectedFileDiffs';
import {
  handleOperationConflict,
  handleRebaseConflict,
  openOperationConflictEditors,
  showRebaseProgressFeedback,
  startMergeOperation,
  startRebaseOperation
} from './operationHandlers';
import { pickPatchOutputTarget, pickPatchSource, readPatchFromFile } from './patchHelpers';
import { pickBranchName } from './pickBranchName';
import { pickCommitSha } from './pickCommitSha';
import { pickConflictPath, pickConflictPathArg } from './pickConflictPath';
import { pickFileFromWorkspace } from './pickFileFromWorkspace';
import { pickStashRef } from './pickStashRef';
import { pickWorktreeRevision, pickWorktreeTargetPath } from './pickWorktree';
import { resolveSelectedCommitFiles, toSelectedChangeTarget } from './selectedChangeTarget';
import { extractSelectableItem, toSelectedItems } from './selectedItems';
import type { CommandControllerShape } from './shape';
import type {
  CherryPickIssueKind,
  CommitFilesViewShape,
  GitScmRepository,
  MergeIssueKind,
  RebaseIssueKind,
  SelectableChangeTreeItem,
  SelectedChangeTarget
} from './types';
import { withSubmoduleProgress } from './withSubmoduleProgress';

import { CommandId } from './commandIds';

export type { CommandControllerShape };

export class CommandController {
  constructor(
    private readonly git: GitService,
    private readonly state: StateStore,
    private readonly editor: EditorOrchestrator,
    private readonly logger: Logger,
    private readonly commitFilesView: CommitFilesViewShape
  ) { }

  register(context: vscode.ExtensionContext): void {
    const asBranchItem = (value: unknown): BranchTreeItem | undefined => (value instanceof BranchTreeItem ? value : undefined);
    const asBranchRemoteItem = (value: unknown): BranchRemoteNode | undefined => (value instanceof BranchRemoteNode ? value : undefined);
    const asTagItem = (value: unknown): TagTreeItem | undefined => (value instanceof TagTreeItem ? value : undefined);
    const asStashItem = (value: unknown): StashTreeItem | undefined => (value instanceof StashTreeItem ? value : undefined);
    const asGraphItem = (value: unknown): GraphCommitTreeItem | undefined =>
      value instanceof GraphCommitTreeItem ? value : undefined;
    const asGraphFileItem = (value: unknown): GraphCommitFileTreeItem | undefined =>
      value instanceof GraphCommitFileTreeItem ? value : undefined;
    const asCommitViewFileItem = (value: unknown): CommitFileTreeItem | undefined =>
      value instanceof CommitFileTreeItem ? value : undefined;
    const asCommitRangeFileItem = (
      value: unknown
    ): { filePath: string; fromRef: string; toRef: string; fromLabel: string; toLabel: string } | undefined => {
      if (value instanceof CommitRangeFileTreeItem) {
        return {
          filePath: value.filePath,
          fromRef: value.fromRef,
          toRef: value.toRef,
          fromLabel: value.fromLabel,
          toLabel: value.toLabel
        };
      }

      if (
        typeof value === 'object' &&
        value !== null &&
        'filePath' in value &&
        'fromRef' in value &&
        'toRef' in value
      ) {
        const record = value as Record<string, unknown>;
        if (
          typeof record.filePath === 'string' &&
          typeof record.fromRef === 'string' &&
          typeof record.toRef === 'string'
        ) {
          return {
            filePath: record.filePath,
            fromRef: record.fromRef,
            toRef: record.toRef,
            fromLabel: typeof record.fromLabel === 'string' ? record.fromLabel : record.fromRef,
            toLabel: typeof record.toLabel === 'string' ? record.toLabel : record.toRef
          };
        }
      }

      return undefined;
    };
    const asRevisionViewFileItem = (value: unknown): RevisionFileTreeItem | undefined =>
      value instanceof RevisionFileTreeItem ? value : undefined;
    const asWorkingTreeCompareFileItem = (
      value: unknown
    ): { filePath: string; ref: string; refLabel: string; status: string } | undefined => {
      if (value instanceof WorkingTreeCompareFileTreeItem) {
        return {
          filePath: value.filePath,
          ref: value.ref,
          refLabel: value.refLabel,
          status: value.status
        };
      }

      if (
        typeof value === 'object' &&
        value !== null &&
        'filePath' in value &&
        'ref' in value &&
        'refLabel' in value &&
        'status' in value
      ) {
        const record = value as Record<string, unknown>;
        if (
          typeof record.filePath === 'string' &&
          typeof record.ref === 'string' &&
          typeof record.refLabel === 'string' &&
          typeof record.status === 'string'
        ) {
          return {
            filePath: record.filePath,
            ref: record.ref,
            refLabel: record.refLabel,
            status: record.status
          };
        }
      }

      return undefined;
    };
    const asFileResourceUri = (value: unknown): vscode.Uri | undefined => {
      if (value instanceof vscode.Uri) {
        return value.scheme === 'file' ? value : undefined;
      }

      if (
        typeof value === 'object' &&
        value !== null &&
        'resourceUri' in value &&
        (value as { resourceUri?: unknown }).resourceUri instanceof vscode.Uri
      ) {
        const uri = (value as { resourceUri: vscode.Uri }).resourceUri;
        return uri.scheme === 'file' ? uri : undefined;
      }

      return undefined;
    };
    const toExplorerResourceUris = (arg: unknown, selectedArg: unknown): vscode.Uri[] => {
      const selectedUris = Array.isArray(selectedArg)
        ? selectedArg.map((item) => asFileResourceUri(item)).filter((uri): uri is vscode.Uri => Boolean(uri))
        : [];
      const primary = asFileResourceUri(arg);
      const combined = primary ? [primary, ...selectedUris] : selectedUris;
      const uniqueByPath = new Map<string, vscode.Uri>();
      for (const uri of combined) {
        uniqueByPath.set(uri.fsPath, uri);
      }
      return [...uniqueByPath.values()];
    };
    const toBranchName = (value: unknown): string | undefined => {
      const item = asBranchItem(value);
      if (item) {
        return item.branch.name;
      }
      if (typeof value !== 'string') {
        return undefined;
      }
      const raw = value.trim();
      if (!raw) {
        return undefined;
      }
      return this.resolveBranchNameForActionHub(raw) ?? raw;
    };
    const toRepoFilePath = (value: unknown): string | undefined => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || undefined;
      }

      const filePath =
        asGraphFileItem(value)?.filePath ??
        asCommitViewFileItem(value)?.filePath ??
        asRevisionViewFileItem(value)?.filePath;
      if (filePath) {
        return filePath;
      }

      const uri = asFileResourceUri(value);
      if (!uri) {
        return undefined;
      }

      return this.git.toRepoRelative(uri.fsPath);
    };
    const toCommitSha = (value: unknown): string | undefined => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || undefined;
      }
      if (typeof value === 'object' && value !== null && 'sha' in value && typeof (value as { sha?: unknown }).sha === 'string') {
        const sha = ((value as { sha: string }).sha ?? '').trim();
        if (sha) {
          return sha;
        }
      }
      const tag = asTagItem(value)?.tag;
      return asGraphItem(value)?.commit.sha ?? tag?.sha ?? tag?.name;
    };
    const toCommitSubject = (value: unknown): string | undefined => {
      if (asGraphItem(value)) {
        const subject = asGraphItem(value)?.commit.subject?.trim();
        return subject || undefined;
      }
      if (typeof value === 'object' && value !== null && 'subject' in value && typeof (value as { subject?: unknown }).subject === 'string') {
        const subject = ((value as { subject: string }).subject ?? '').trim();
        return subject || undefined;
      }
      return undefined;
    };
    const resolveCommitSubject = (sha: string, argValue: unknown, selectedArgValue: unknown): string => {
      const candidates = [
        argValue,
        ...(Array.isArray(selectedArgValue) ? selectedArgValue : [])
      ];
      for (const candidate of candidates) {
        if (toCommitSha(candidate) !== sha) {
          continue;
        }
        const subject = toCommitSubject(candidate);
        if (subject) {
          return subject;
        }
      }
      return this.state.graph.find((commit) => commit.sha === sha)?.subject ?? sha;
    };
    const toGraphCommitShas = (arg: unknown, selectedArg: unknown): string[] => {
      const selectedItems = Array.isArray(selectedArg) ? selectedArg : [];
      const fromSelected = selectedItems
        .map((item) => asGraphItem(item)?.commit.sha ?? toCommitSha(item))
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value): value is string => Boolean(value));
      if (fromSelected.length > 0) {
        return [...new Set(fromSelected)];
      }
      const primary = toCommitSha(arg);
      return primary ? [primary] : [];
    };
    const toTagRef = (value: unknown): string | undefined => asTagItem(value)?.tag.name;
    const toTagRevision = (value: unknown): string | undefined => {
      const tag = asTagItem(value)?.tag;
      return tag?.sha ?? tag?.name;
    };

    const legacyCommandId = (command: string): string | undefined =>
      command.startsWith('vscodeGitClient.')
        ? `intelliGit.${command.slice('vscodeGitClient.'.length)}`
        : undefined;

    const register = (command: string, callback: (...args: unknown[]) => Promise<void>): void => {
      const run = async (...args: unknown[]): Promise<void> => {
        try {
          await callback(...args);
        } catch (error) {
          this.logger.error(`Command failed: ${command}`, error);
          const message = error instanceof Error ? error.message : String(error);
          void vscode.window.showErrorMessage(`VS Code Git Client: ${message}`);
        }
      };
      const legacy = legacyCommandId(command);
      context.subscriptions.push(
        vscode.commands.registerCommand(command, run),
        ...(legacy ? [vscode.commands.registerCommand(legacy, run)] : [])
      );
    };

    register(CommandId.Refresh, async () => {
      await this.state.refreshVisible();
      void vscode.window.setStatusBarMessage('VS Code Git Client refreshed', 1500);
    });

    register(CommandId.CommitViewClose, async () => {
      await this.commitFilesView.clear();
    });

    register(CommandId.QuickActions, async () => {
      await this.openQuickActions();
    });

    register(CommandId.BranchActionHub, async (arg?: unknown) => {
      await this.openBranchActionHub(arg);
    });

    register(CommandId.BranchOpenCommits, async (arg?: unknown) => {
      const branchName = toBranchName(arg) ?? (await this.pickBranchName('Pick branch to open commits'));
      if (!branchName) {
        return;
      }

      await this.openBranchCommits(branchName);
    });

    register(CommandId.BranchSearch, async () => {
      const searchView = BranchSearchView.open(
        {
          checkout: async (name: string) => {
            await this.git.checkoutBranch(name);
            await this.state.refreshAll();
          },
          checkoutTag: async (name: string) => {
            await vscode.commands.executeCommand(CommandId.TagCheckoutNewBranch, name);
            await this.state.refreshAll();
          },
          openActions: async (name: string) => {
            await vscode.commands.executeCommand(CommandId.BranchActionHub, name);
          },
          refresh: async () => {
            await this.state.refreshBranches();
          },
          runCommand: async (command, name) => {
            await vscode.commands.executeCommand(command, name);
          }
        },
        () => this.state.branches,
        () => this.state.tags,
        (listener) => this.state.onDidChange(listener)
      );
      await searchView.refresh();
    });

    register(CommandId.BranchSearchRefresh, async () => {
      await BranchSearchView.refreshCurrent();
    });

    register(CommandId.BranchCheckout, async (arg?: unknown) => {
      const branchName = toBranchName(arg) ?? (await this.pickBranchName());
      if (!branchName) {
        return;
      }

      await this.git.checkoutBranch(branchName);
      await this.state.refreshAll();
    });

    register(CommandId.TagOpenCommits, async (arg?: unknown) => {
      const revision = toTagRevision(arg) ?? (await this.pickCommitSha('Pick tag or revision for details'));
      if (!revision) {
        return;
      }

      const tagRef = toTagRef(arg) ?? revision;
      await this.openRefCommits(`tag:${revision}`, `Tag: ${tagRef}`, revision);
    });

    register(CommandId.BranchCreate, async () => {
      const baseBranch = await this.pickBranchName('Pick base branch for new branch');
      if (!baseBranch) {
        return;
      }

      const branchName = await vscode.window.showInputBox({
        title: 'Create branch',
        placeHolder: 'feature/my-branch',
        validateInput: (value) => (value.trim() ? undefined : 'Branch name is required')
      });

      if (!branchName) {
        return;
      }

      await this.git.createBranch(branchName.trim(), baseBranch);
      await this.git.checkoutBranch(branchName.trim());
      await this.state.refreshAll();
    });

    register(CommandId.TagCheckoutNewBranch, async (arg?: unknown) => {
      const baseRef = toTagRef(arg) ?? (await this.pickCommitSha('Pick tag or revision for new branch'));
      if (!baseRef) {
        return;
      }

      const branchName = await vscode.window.showInputBox({
        title: `Checkout new branch from ${baseRef}`,
        placeHolder: 'feature/new-branch',
        validateInput: (value) => (value.trim() ? undefined : 'Branch name is required')
      });

      if (!branchName) {
        return;
      }

      await this.git.createBranch(branchName.trim(), baseRef);
      await this.git.checkoutBranch(branchName.trim());
      await this.state.refreshAll();
    });

    register(CommandId.TagCheckout, async (arg?: unknown) => {
      const tagRef = toTagRef(arg) ?? (await this.pickCommitSha('Pick tag or revision to checkout'));
      if (!tagRef) {
        return;
      }

      const confirmed = await confirmDangerousAction({
        title: 'Checkout revision',
        detail: `Revision: ${tagRef}`,
        acceptLabel: 'Checkout'
      });
      if (!confirmed) {
        return;
      }

      await this.git.checkoutCommit(tagRef);
      await this.state.refreshAll();
    });

    register(CommandId.TagCopyRevisionNumber, async (arg?: unknown) => {
      const revision = toTagRevision(arg) ?? (await this.pickCommitSha('Pick revision to copy'));
      if (!revision) {
        return;
      }

      await vscode.env.clipboard.writeText(revision);
      void vscode.window.setStatusBarMessage(`Copied ${revision}`, 1500);
    });

    register(CommandId.TagShowRepositoryAtRevision, async (arg?: unknown) => {
      const revision = toTagRevision(arg) ?? (await this.pickCommitSha('Pick revision'));
      if (!revision) {
        return;
      }

      await this.editor.showRepositoryAtRevision(revision);
    });

    register(CommandId.TagCompareWithCurrent, async (arg?: unknown) => {
      const revision = toTagRevision(arg) ?? (await this.pickCommitSha('Pick revision to compare with current'));
      if (!revision) {
        return;
      }

      await this.editor.openCompareFromCommit(revision);
    });

    register(CommandId.TagCreatePatch, async (arg?: unknown) => {
      const revision = toTagRevision(arg) ?? (await this.pickCommitSha('Pick revision to export patch'));
      if (!revision) {
        return;
      }

      const patch = await this.git.getPatchForCommit(revision);
      const doc = await vscode.workspace.openTextDocument({
        language: 'diff',
        content: patch
      });
      await vscode.window.showTextDocument(doc, { preview: false });
    });

    register(CommandId.TagCreateCurrent, async () => {
      const sha = await this.git.getCurrentHeadSha();
      if (!sha) {
        return;
      }

      const name = await vscode.window.showInputBox({
        title: `Create tag at ${sha.slice(0, 8)}`,
        placeHolder: 'v1.2.3',
        validateInput: (value) => (value.trim() ? undefined : 'Tag name is required')
      });
      if (!name) {
        return;
      }

      await this.git.createTag(name.trim(), sha);
      await this.state.refreshAll();
      void vscode.window.showInformationMessage(`Created tag ${name.trim()} at ${sha.slice(0, 8)}.`);
    });

    const setRemoteUrlFromItem = async (arg?: unknown): Promise<void> => {
      const remoteItem = asBranchRemoteItem(arg);
      const remoteName = remoteItem?.remoteName;
      if (!remoteName) {
        return;
      }

      const currentUrl = remoteItem.branches.find((branch) => Boolean(branch.remoteUrl))?.remoteUrl;
      const nextUrl = await vscode.window.showInputBox({
        title: currentUrl ? `Change remote URL for ${remoteName}` : `Set remote URL for ${remoteName}`,
        value: currentUrl ?? '',
        placeHolder: 'https://github.com/org/repo.git',
        validateInput: (value) => (value.trim() ? undefined : 'Remote URL is required')
      });
      if (!nextUrl) {
        return;
      }

      await this.git.setRemoteUrl(remoteName, nextUrl.trim());
      const refreshPromise = this.state.refreshBranches();
      void vscode.window.showInformationMessage(`Remote ${remoteName} URL updated.`);
      await refreshPromise;
    };

    register(CommandId.RemoteSetUrl, setRemoteUrlFromItem);
    register(CommandId.RemoteChangeUrl, setRemoteUrlFromItem);
    register(CommandId.RemoteSetUrlMissing, setRemoteUrlFromItem);

    register(CommandId.RemoteAdd, async () => {
      const remoteUrl = await vscode.window.showInputBox({
        title: 'Add Git remote',
        placeHolder: 'https://github.com/org/repo.git',
        validateInput: (value) => (value.trim() ? undefined : 'Remote URL is required')
      });
      if (!remoteUrl) {
        return;
      }

      const remoteName = await vscode.window.showInputBox({
        title: 'Remote name',
        placeHolder: 'origin',
        validateInput: (value) => (value.trim() ? undefined : 'Remote name is required')
      });
      if (!remoteName) {
        return;
      }

      await this.git.addRemote(remoteName.trim(), remoteUrl.trim());
      await this.state.refreshBranches();
      void vscode.window.showInformationMessage(`Added remote ${remoteName.trim()}.`);
    });

    register(CommandId.RemoteDelete, async (arg?: unknown) => {
      const remoteName = asBranchRemoteItem(arg)?.remoteName;
      if (!remoteName) {
        return;
      }

      const confirmed = await confirmDangerousAction({
        title: 'Delete remote',
        detail: `Remote: ${remoteName}`,
        acceptLabel: 'Delete'
      });
      if (!confirmed) {
        return;
      }

      await this.git.deleteRemote(remoteName);
      await this.state.refreshBranches();
      void vscode.window.showInformationMessage(`Deleted remote ${remoteName}.`);
    });

    register(CommandId.BranchRename, async (arg?: unknown) => {
      const from = toBranchName(arg) ?? (await this.pickBranchName('Pick branch to rename'));
      if (!from) {
        return;
      }

      const to = await vscode.window.showInputBox({
        title: `Rename branch ${from}`,
        value: from,
        validateInput: (value) => (value.trim() ? undefined : 'Branch name is required')
      });

      if (!to || to.trim() === from) {
        return;
      }

      await this.git.renameBranch(from, to.trim());
      await this.state.refreshAll();
    });

    register(CommandId.BranchDelete, async (arg?: unknown) => {
      const branch = toBranchName(arg) ?? (await this.pickBranchName('Pick branch to delete'));
      if (!branch) {
        return;
      }

      const confirmed = await confirmDangerousAction({
        title: 'Delete branch',
        detail: `Branch: ${branch}`,
        acceptLabel: 'Delete'
      });
      if (!confirmed) {
        return;
      }

      await this.git.deleteBranch(branch);
      await this.state.refreshAll();
    });

    register(CommandId.BranchTrack, async (arg?: unknown) => {
      const local = toBranchName(arg) ?? (await this.pickBranchName('Pick local branch to track'));
      if (!local) {
        return;
      }

      const remote = await this.pickBranchName('Pick remote upstream branch', true);
      if (!remote) {
        return;
      }

      await this.git.trackBranch(local, remote);
      await this.state.refreshAll();
    });

    register(CommandId.BranchUntrack, async (arg?: unknown) => {
      const branch = toBranchName(arg) ?? (await this.pickBranchName('Pick local branch to untrack'));
      if (!branch) {
        return;
      }

      await this.git.untrackBranch(branch);
      await this.state.refreshAll();
    });

    register(CommandId.BranchMergeIntoCurrent, async (arg?: unknown) => {
      const branch = toBranchName(arg) ?? (await this.pickBranchName('Pick branch to merge into current branch'));
      if (!branch) {
        return;
      }

      const confirmed = await confirmDangerousAction({
        title: 'Merge into current branch',
        detail: `Source branch: ${branch}`,
        acceptLabel: 'Merge'
      });
      if (!confirmed) {
        return;
      }

      await this.startMergeOperation(() => this.git.mergeIntoCurrent(branch));
    });

    register(CommandId.BranchRebaseOnto, async (arg?: unknown) => {
      const onto = toBranchName(arg) ?? (await this.pickBranchName('Pick branch to rebase onto'));
      if (!onto) {
        return;
      }

      const confirmed = await confirmDangerousAction({
        title: 'Rebase current branch',
        detail: `Rebase onto: ${onto}`,
        acceptLabel: 'Rebase'
      });
      if (!confirmed) {
        return;
      }

      await this.startRebaseOperation(() => this.git.rebaseCurrentOnto(onto));
    });

    register(CommandId.BranchResetCurrentToCommit, async (arg?: unknown) => {
      const target = toCommitSha(arg) ?? (await this.pickCommitSha('Pick target commit for reset'));
      if (!target) {
        return;
      }

      const mode = await vscode.window.showQuickPick(['soft', 'mixed', 'hard'], {
        title: 'Reset mode',
        placeHolder: 'Choose reset mode'
      });

      if (!mode) {
        return;
      }

      const confirmed = await confirmDangerousAction({
        title: 'Reset current branch',
        detail: `Mode: ${mode}\nTarget: ${target}`,
        acceptLabel: 'Reset'
      });
      if (!confirmed) {
        return;
      }

      await this.git.resetCurrent(target, mode as 'soft' | 'mixed' | 'hard');
      await this.state.refreshAll();
    });

    register(CommandId.BranchCompareWithCurrent, async (arg?: unknown) => {
      const current = await this.git.getCurrentBranch();
      const target = toBranchName(arg) ?? (await this.pickBranchName('Pick branch to compare with current'));
      if (!target) {
        return;
      }

      await this.editor.openBranchCompare(current, target);
    });

    register(CommandId.StashCreate, async () => {
      const message = (await vscode.window.showInputBox({
        title: 'Create stash',
        placeHolder: 'WIP: short message'
      }))?.trim();

      if (!message) {
        return;
      }

      const includeUntracked =
        (await vscode.window.showQuickPick(['No', 'Yes'], {
          title: 'Include untracked files?'
        })) === 'Yes';

      const keepIndex =
        (await vscode.window.showQuickPick(['No', 'Yes'], {
          title: 'Keep staged changes in index?'
        })) === 'Yes';

      await this.git.createStash(message, { includeUntracked, keepIndex });
      await this.state.refreshAll();
    });

    register(CommandId.StashUnshelve, async (arg?: unknown) => {
      const item = asStashItem(arg);
      const ref = item?.stash.ref ?? (await this.pickStashRef('Pick stash to unshelve'));
      if (!ref) {
        return;
      }

      await this.git.unstashToWorkingTree(ref);
      await this.state.refreshAll();
      void vscode.window.showInformationMessage(`Unshelved ${ref}.`);
    });

    register(CommandId.StashApply, async (arg?: unknown) => {
      const item = asStashItem(arg);
      const ref = item?.stash.ref ?? (await this.pickStashRef('Pick stash to apply'));
      if (!ref) {
        return;
      }

      await this.git.applyStash(ref, false);
      await this.state.refreshAll();
    });

    register(CommandId.StashPop, async (arg?: unknown) => {
      const item = asStashItem(arg);
      const ref = item?.stash.ref ?? (await this.pickStashRef('Pick stash to pop'));
      if (!ref) {
        return;
      }

      await this.git.applyStash(ref, true);
      await this.state.refreshAll();
    });

    register(CommandId.StashDrop, async (arg?: unknown) => {
      const item = asStashItem(arg);
      const ref = item?.stash.ref ?? (await this.pickStashRef('Pick stash to drop'));
      if (!ref) {
        return;
      }

      const confirmed = await confirmDangerousAction({
        title: 'Drop stash',
        detail: `Target: ${ref}`,
        acceptLabel: 'Drop'
      });
      if (!confirmed) {
        return;
      }

      await this.git.dropStash(ref);
      await this.state.refreshAll();
    });

    register(CommandId.StashRename, async (arg?: unknown) => {
      const item = asStashItem(arg);
      const ref = item?.stash.ref ?? (await this.pickStashRef('Pick stash to rename'));
      if (!ref) {
        return;
      }

      const message = await vscode.window.showInputBox({
        title: `Rename ${ref}`,
        placeHolder: 'Updated stash message'
      });
      if (!message) {
        return;
      }

      await this.git.renameStash(ref, message.trim());
      await this.state.refreshAll();
    });

    register(CommandId.StashPreviewPatch, async (arg?: unknown) => {
      const item = asStashItem(arg);
      const ref = item?.stash.ref ?? (await this.pickStashRef('Pick stash to preview patch'));
      if (!ref) {
        return;
      }

      const patch = await this.git.getStashPatch(ref);
      const doc = await vscode.workspace.openTextDocument({
        language: 'diff',
        content: patch
      });
      await vscode.window.showTextDocument(doc, { preview: false });
    });

    register(CommandId.GraphOpenDetails, async (arg?: unknown, selected?: unknown) => {
      const selectedShas = toGraphCommitShas(arg, selected);
      const shouldOpenFirstDiff =
        asGraphItem(arg) !== undefined ||
        (Array.isArray(selected) && selected.some((item) => asGraphItem(item) !== undefined));
      if (selectedShas.length === 0) {
        const picked = await this.pickCommitSha('Pick commit for details');
        if (!picked) {
          return;
        }
        selectedShas.push(picked);
      }
      const sha = selectedShas[0];
      if (!sha) {
        return;
      }
      const subject = resolveCommitSubject(sha, arg, selected);
      await this.openCommitDetails(sha, subject, { openFirstDiff: shouldOpenFirstDiff, allowToggle: true });
    });

    register(CommandId.GraphCopyCommitId, async (arg?: unknown, selected?: unknown) => {
      const shas = toGraphCommitShas(arg, selected);
      if (shas.length === 0) {
        return;
      }
      await vscode.env.clipboard.writeText(shas.join('\n'));
      void vscode.window.setStatusBarMessage(
        shas.length > 1 ? `Copied ${shas.length} commit IDs` : `Copied commit ID ${shas[0]}`,
        1500
      );
    });

    register(CommandId.GraphCopyCommitMessage, async (arg?: unknown, selected?: unknown) => {
      const shas = toGraphCommitShas(arg, selected);
      if (shas.length === 0) {
        return;
      }
      const messages = shas
        .map((sha) => this.state.graph.find((commit) => commit.sha === sha)?.subject?.trim() ?? '')
        .filter((value): value is string => Boolean(value));
      if (messages.length === 0) {
        return;
      }
      await vscode.env.clipboard.writeText(messages.join('\n'));
      void vscode.window.setStatusBarMessage(
        messages.length > 1 ? `Copied ${messages.length} commit messages` : 'Copied commit message',
        1500
      );
    });

    register(CommandId.GraphOpenFileDiff, async (arg?: unknown, selected?: unknown) => {
      if (await this.openSelectedFileDiffs(arg, selected)) {
        return;
      }

      const item = asGraphFileItem(arg);
      if (item) {
        await this.editor.openCommitFileDiffWithStatus(item.commit.sha, item.filePath, item.status, { oldPath: item.oldPath });
        return;
      }

      const rangeItem = asCommitRangeFileItem(arg);
      if (rangeItem) {
        await this.editor.openCommitRangeFileDiff(
          rangeItem.fromRef,
          rangeItem.toRef,
          rangeItem.filePath,
          { fromLabel: rangeItem.fromLabel, toLabel: rangeItem.toLabel }
        );
        return;
      }

      const commitItem = asCommitViewFileItem(arg);
      if (!commitItem) {
        return;
      }

      await this.editor.openCommitFileDiffWithStatus(commitItem.sha, commitItem.filePath, commitItem.status);
    });

    register(CommandId.WorkingTreeCompareOpenFileDiff, async (arg?: unknown) => {
      const item = asWorkingTreeCompareFileItem(arg);
      if (!item) {
        return;
      }

      await this.editor.openWorkingTreeFileDiff(item.filePath, item.ref, item.refLabel, {
        preview: true,
        status: item.status
      });
    });

    register(CommandId.CompareWithRevisionSwapDirection, async () => {
      await this.editor.swapActiveCompareDirection();
    });

    register(CommandId.GraphOpenRepositoryFileAtRevision, async (arg?: unknown) => {
      const item = asRevisionViewFileItem(arg);
      if (!item) {
        return;
      }

      await this.editor.openFileAtRevision(item.sha, item.filePath);
    });

    register(CommandId.GraphCheckoutCommit, async (arg?: unknown) => {
      const sha = toCommitSha(arg) ?? (await this.pickCommitSha('Pick commit to checkout'));
      if (!sha) {
        return;
      }

      const confirmed = await confirmDangerousAction({
        title: 'Checkout detached HEAD',
        detail: `Commit: ${sha}`,
        acceptLabel: 'Checkout'
      });
      if (!confirmed) {
        return;
      }

      await this.git.checkoutCommit(sha);
      await this.state.refreshAll();
    });

    register(CommandId.GraphCreateBranchHere, async (arg?: unknown) => {
      const sha = toCommitSha(arg) ?? (await this.pickCommitSha('Pick commit for new branch'));
      if (!sha) {
        return;
      }

      const name = await vscode.window.showInputBox({
        title: `Create branch at ${sha.slice(0, 8)}`,
        placeHolder: 'feature/new-branch',
        validateInput: (value) => (value.trim() ? undefined : 'Branch name is required')
      });

      if (!name) {
        return;
      }

      await this.git.createBranch(name.trim(), sha);
      await this.state.refreshAll();
    });

    register(CommandId.GraphCreateTagHere, async (arg?: unknown) => {
      const sha = toCommitSha(arg) ?? (await this.pickCommitSha('Pick commit for new tag'));
      if (!sha) {
        return;
      }

      const name = await vscode.window.showInputBox({
        title: `Create tag at ${sha.slice(0, 8)}`,
        placeHolder: 'v1.2.3',
        validateInput: (value) => (value.trim() ? undefined : 'Tag name is required')
      });

      if (!name) {
        return;
      }

      await this.git.createTag(name.trim(), sha);
      await this.state.refreshAll();
      void vscode.window.showInformationMessage(`Created tag ${name.trim()} at ${sha.slice(0, 8)}.`);
    });

    register(CommandId.GraphCherryPick, async (arg?: unknown, selected?: unknown) => {
      const selectedShas = toGraphCommitShas(arg, selected);
      if (selectedShas.length === 0) {
        const picked = await this.pickCommitSha('Pick commit to cherry-pick');
        if (!picked) {
          return;
        }
        selectedShas.push(picked);
      }

      const pickedShas: string[] = [];
      const emptyShas: string[] = [];
      const failedShas: string[] = [];
      let conflictSha: string | undefined;
      let issueMessage: string | undefined;

      for (const sha of selectedShas) {
        try {
          await this.git.cherryPick(sha);
          pickedShas.push(sha);
        } catch (error) {
          const issue = this.classifyCherryPickIssue(error);
          issueMessage = issue.message;
          if (issue.kind === 'nothingToCherryPick') {
            emptyShas.push(sha);
            continue;
          }
          if (issue.kind === 'conflict') {
            conflictSha = sha;
            break;
          }
          failedShas.push(sha);
          break;
        }
      }

      const refreshPromise = this.state.refreshAll();

      if (conflictSha) {
        await this.handleOperationConflict('cherry-pick', refreshPromise);
        return;
      }

      if (failedShas.length > 0) {
        const detail = issueMessage ? ` ${issueMessage}` : '';
        const prefix = pickedShas.length > 0
          ? `Cherry-pick stopped after applying ${pickedShas.length} commit(s).`
          : 'Cherry-pick failed.';
        void vscode.window.showErrorMessage(`${prefix}${detail}`);
        await refreshPromise;
        return;
      }

      if (pickedShas.length > 0 && emptyShas.length === 0) {
        const message = pickedShas.length === 1
          ? `Cherry-pick succeeded for ${pickedShas[0].slice(0, 8)}.`
          : `Cherry-pick succeeded for ${pickedShas.length} commit(s).`;
        void vscode.window.showInformationMessage(message);
        await refreshPromise;
        return;
      }

      if (pickedShas.length === 0 && emptyShas.length > 0) {
        const message = emptyShas.length === 1
          ? `Nothing to cherry-pick for ${emptyShas[0].slice(0, 8)} (already applied or empty).`
          : `Nothing to cherry-pick for ${emptyShas.length} commit(s) (already applied or empty).`;
        void vscode.window.showInformationMessage(message);
        await refreshPromise;
        return;
      }

      if (pickedShas.length > 0 && emptyShas.length > 0) {
        void vscode.window.showInformationMessage(
          `Cherry-pick completed: ${pickedShas.length} applied, ${emptyShas.length} already applied or empty.`
        );
        await refreshPromise;
      }
    });

    register(CommandId.GraphCherryPickRange, async () => {
      const fromExclusive = await this.pickCommitSha('Pick starting point (exclusive)');
      if (!fromExclusive) {
        return;
      }
      const toInclusive = await this.pickCommitSha('Pick end point (inclusive)');
      if (!toInclusive) {
        return;
      }

      const confirmed = await confirmDangerousAction({
        title: 'Cherry-pick range',
        detail: `${fromExclusive}..${toInclusive}`,
        acceptLabel: 'Cherry-pick'
      });
      if (!confirmed) {
        return;
      }

      await this.git.cherryPickRange(fromExclusive, toInclusive);
      await this.state.refreshAll();
    });

    register(CommandId.GraphRevert, async (arg?: unknown, selected?: unknown) => {
      const selectedShas = toGraphCommitShas(arg, selected);
      if (selectedShas.length === 0) {
        const picked = await this.pickCommitSha('Pick commit to revert');
        if (!picked) {
          return;
        }
        selectedShas.push(picked);
      }

      for (const sha of selectedShas) {
        await this.git.revertCommit(sha);
      }
      await this.state.refreshAll();
    });

    register(CommandId.CommitRevertSelectedChanges, async (arg?: unknown, selected?: unknown) => {
      const target = await this.resolveSelectedCommitFiles(arg, selected);
      if (!target) {
        void vscode.window.showInformationMessage('Select one or more files from a commit first.');
        return;
      }

      if (!target.canRevert) {
        void vscode.window.showWarningMessage('Selected files cannot be reverted from the current branch.');
        return;
      }

      const confirmed = await confirmDangerousAction({
        title: 'Revert selected changes',
        detail: `${target.detailLabel}\nFiles: ${target.filePaths.length}\n${target.filePaths.map((path) => `- ${path}`).join('\n')}`,
        acceptLabel: 'Revert'
      });
      if (!confirmed) {
        return;
      }

      if (target.kind === 'commit') {
        await this.git.revertCommitFiles(target.sha, target.filePaths);
      } else if (target.kind === 'range') {
        const patch = await this.git.getPatchBetweenRefsForFiles(target.fromRef, target.toRef, target.filePaths);
        await this.git.reverseApplyPatchToWorkingTree(patch);
      } else {
        const patch = await this.git.getPatchBetweenWorkingTreeAndRefForFiles(target.ref, target.filePaths);
        await this.git.reverseApplyPatchToWorkingTree(patch);
      }
      await this.state.refreshAll();
      void vscode.window.showInformationMessage(`Reverted selected changes from ${target.shortLabel} in the current checkout.`);
    });

    register(CommandId.CommitCherryPickSelectedChanges, async (arg?: unknown, selected?: unknown) => {
      const target = await this.resolveSelectedCommitFiles(arg, selected);
      if (!target) {
        void vscode.window.showInformationMessage('Select one or more files from a commit first.');
        return;
      }

      if (!target.canCherryPick) {
        void vscode.window.showWarningMessage('Selected files are already available in the current branch.');
        return;
      }

      const confirmed = await confirmDangerousAction({
        title: 'Cherry-pick selected changes',
        detail: `${target.detailLabel}\nFiles: ${target.filePaths.length}\n${target.filePaths.map((path) => `- ${path}`).join('\n')}`,
        acceptLabel: 'Cherry-pick'
      });
      if (!confirmed) {
        return;
      }

      if (target.kind === 'commit') {
        await this.git.cherryPickCommitFiles(target.sha, target.filePaths);
        const refreshPromise = this.state.refreshAll();
        void vscode.window.showInformationMessage(`Cherry-picked selected changes from ${target.shortLabel} into the current checkout.`);
        await refreshPromise;
        return;
      }

      if (target.kind !== 'range') {
        void vscode.window.showWarningMessage('Selected files are already available in the working tree.');
        return;
      }

      const patch = await this.git.getPatchBetweenRefsForFiles(target.fromRef, target.toRef, target.filePaths);
      await this.applyPatchToWorkingTree(patch, { source: `selected changes from ${target.shortLabel}` });
    });

    register(CommandId.CommitCreatePatchSelectedChanges, async (arg?: unknown, selected?: unknown) => {
      const target = await this.resolveSelectedCommitFiles(arg, selected);
      if (!target) {
        void vscode.window.showInformationMessage('Select one or more files from a commit first.');
        return;
      }

      if (!target.canCreatePatch) {
        void vscode.window.showWarningMessage('Selected files cannot be used to create a patch from this view.');
        return;
      }

      const patch = target.kind === 'commit'
        ? await this.git.getPatchForCommitFiles(target.sha, target.filePaths)
        : target.kind === 'range'
          ? await this.git.getPatchBetweenRefsForFiles(target.fromRef, target.toRef, target.filePaths)
          : await this.git.getPatchBetweenWorkingTreeAndRefForFiles(target.ref, target.filePaths);
      if (!patch.trim()) {
        void vscode.window.showInformationMessage('No patch content generated for the selected files.');
        return;
      }

      const output = await this.pickPatchOutputTarget('Create Patch');
      if (!output) {
        return;
      }

      const patchFileName = '@unnamed.patch';
      if (output === 'clipboard') {
        await vscode.env.clipboard.writeText(patch);
      } else {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
        const defaultUri = workspaceRoot ? vscode.Uri.joinPath(workspaceRoot, patchFileName) : undefined;
        const targetUri = await vscode.window.showSaveDialog({
          title: 'Save Patch File',
          saveLabel: 'Save',
          defaultUri,
          filters: {
            Patch: ['patch', 'diff']
          }
        });
        if (!targetUri) {
          return;
        }
        await vscode.workspace.fs.writeFile(targetUri, Buffer.from(patch, 'utf8'));
      }

      if (target.kind !== 'workingTreeCompare') {
        await this.applyPatchToWorkingTree(patch, { source: `selected changes from ${target.shortLabel}` });
      }
    });

    register(CommandId.CommitApplyPatch, async () => {
      const source = await this.pickPatchSource();
      if (!source) {
        return;
      }

      const patch = source.kind === 'clipboard'
        ? (await vscode.env.clipboard.readText())
        : (await this.readPatchFromFile());
      if (patch === undefined) {
        return;
      }

      if (!patch.trim()) {
        void vscode.window.showWarningMessage('Patch content is empty.');
        return;
      }

      await this.applyPatchToWorkingTree(patch, {
        source: source.kind === 'clipboard' ? 'clipboard' : 'patch file'
      });
    });

    register(CommandId.GraphCompareWithCurrent, async (arg?: unknown) => {
      const sha = toCommitSha(arg) ?? (await this.pickCommitSha('Pick commit to compare with current'));
      if (!sha) {
        return;
      }

      await this.editor.openCompareFromCommit(sha);
    });

    register(CommandId.GraphRebaseInteractiveFromHere, async (arg?: unknown) => {
      const base = toCommitSha(arg) ?? (await this.pickCommitSha('Pick base commit for interactive rebase'));
      if (!base) {
        return;
      }

      const confirmed = await confirmDangerousAction({
        title: 'Interactive rebase',
        detail: `Base commit: ${base}`,
        acceptLabel: 'Start rebase'
      });
      if (!confirmed) {
        return;
      }

      await this.startRebaseOperation(() => this.git.rebaseInteractive(base));
    });

    register(CommandId.GraphEditCommitMessage, async (arg?: unknown) => {
      const sha = toCommitSha(arg) ?? (await this.pickCommitSha('Pick commit to edit message'));
      if (!sha) {
        return;
      }

      const details = await this.git.getCommitDetails(sha);
      const currentMessage = details.commit.subject.trim();
      const nextMessage = await vscode.window.showInputBox({
        title: `Edit commit message (${sha.slice(0, 8)})`,
        value: currentMessage,
        validateInput: (value) => (value.trim() ? undefined : 'Commit message is required')
      });
      if (nextMessage === undefined) {
        return;
      }

      const trimmedMessage = nextMessage.trim();
      if (trimmedMessage === currentMessage) {
        return;
      }

      const confirmed = await confirmDangerousAction({
        title: 'Rewrite commit message',
        detail: `Commit: ${sha}\nThis rewrites commit history and may require force push.`,
        acceptLabel: 'Rewrite'
      });
      if (!confirmed) {
        return;
      }

      const parent = await this.git.getParentCommit(sha);
      if (!parent) {
        void vscode.window.showWarningMessage('Cannot edit the root commit message from this action.');
        return;
      }

      const escapedSha = sha.replace(/'/g, `'\"'\"'`);
      const escapedMessage = trimmedMessage.replace(/'/g, `'\"'\"'`);
      const sequenceEditor = `sh -c 'TODO_FILE=\"$1\"; sed -i.bak -e \"s/^pick ${escapedSha}/reword ${escapedSha}/\" \"$TODO_FILE\"; rm -f \"$TODO_FILE.bak\"' --`;
      const editor = `sh -c 'printf %s \"${escapedMessage}\" > \"$1\"' --`;

      await this.startRebaseOperation(async () => {
        await this.git.runGit([
          '-c', `sequence.editor=${sequenceEditor}`,
          '-c', `core.editor=${editor}`,
          'rebase', '-i', parent
        ]);
      });
    });

    register(CommandId.GraphGoToParentCommit, async (arg?: unknown) => {
      const sha = toCommitSha(arg) ?? (await this.pickCommitSha('Pick commit'));
      if (!sha) {
        return;
      }

      const parent = await this.git.getParentCommit(sha);
      if (!parent) {
        void vscode.window.showInformationMessage('This commit has no parent commit.');
        return;
      }

      const graphCommit = this.state.graph.find((commit) => commit.sha === parent);
      if (graphCommit) {
        await vscode.commands.executeCommand(CommandId.GraphOpenDetails, new GraphCommitTreeItem(graphCommit));
      } else {
        const subject = (await this.git.getCommitDetails(parent)).commit.subject;
        await this.openCommitDetails(parent, subject, { openFirstDiff: true });
      }
    });

    register(CommandId.GraphGoToChildCommit, async (arg?: unknown) => {
      const sha = toCommitSha(arg) ?? (await this.pickCommitSha('Pick commit'));
      if (!sha) {
        return;
      }

      const result = await this.git.runGit(['rev-list', '--children', '-n', '1', sha]);
      const parts = result.stdout.trim().split(/\s+/).filter(Boolean);
      const children = parts.slice(1);
      if (children.length === 0) {
        void vscode.window.showInformationMessage('This commit has no child commit.');
        return;
      }

      let child = children[0];
      if (children.length > 1) {
        const picked = await vscode.window.showQuickPick(
          children.map((candidate) => ({ label: candidate })),
          { title: `Pick child commit of ${sha.slice(0, 8)}` }
        );
        if (!picked) {
          return;
        }
        child = picked.label;
      }

      const graphCommit = this.state.graph.find((commit) => commit.sha === child);
      if (graphCommit) {
        await vscode.commands.executeCommand(CommandId.GraphOpenDetails, new GraphCommitTreeItem(graphCommit));
      } else {
        const subject = (await this.git.getCommitDetails(child)).commit.subject;
        await this.openCommitDetails(child, subject, { openFirstDiff: true });
      }
    });

    register(CommandId.GraphPushAllUpToHere, async (arg?: unknown) => {
      const sha = toCommitSha(arg) ?? (await this.pickCommitSha('Pick commit to push up to'));
      if (!sha) {
        return;
      }

      const current = (await this.git.runGit(['rev-parse', 'HEAD'])).stdout.trim();
      if (current === sha) {
        await vscode.commands.executeCommand(CommandId.GitPushWithPreview);
        return;
      }

      let isAncestor = true;
      try {
        await this.git.runGit(['merge-base', '--is-ancestor', sha, 'HEAD']);
      } catch {
        isAncestor = false;
      }
      if (!isAncestor) {
        void vscode.window.showWarningMessage('Selected commit is not an ancestor of current HEAD.');
        return;
      }

      const preview = await this.git.runGit(['log', '--oneline', `${sha}..HEAD`]);
      const outgoingLines = preview.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
      const detailLines = outgoingLines.slice(0, 10).join('\n') || 'none';

      const confirmed = await confirmDangerousAction({
        title: `Push all up to ${sha.slice(0, 8)}`,
        detail: `Commits to push:\n${detailLines}`,
        acceptLabel: 'Push'
      });
      if (!confirmed) {
        return;
      }

      await this.git.push();
      await this.state.refreshAll();
    });

    register(CommandId.GraphCreatePatch, async (arg?: unknown) => {
      const sha = toCommitSha(arg) ?? (await this.pickCommitSha('Pick commit to export patch'));
      if (!sha) {
        return;
      }

      const patch = await this.git.getPatchForCommit(sha);
      const doc = await vscode.workspace.openTextDocument({
        language: 'diff',
        content: patch
      });
      await vscode.window.showTextDocument(doc, { preview: false });
    });

    register(CommandId.GraphShowRepositoryAtRevision, async (arg?: unknown) => {
      const sha = toCommitSha(arg) ?? (await this.pickCommitSha('Pick revision'));
      if (!sha) {
        return;
      }

      await this.editor.showRepositoryAtRevision(sha);
    });

    register(CommandId.GraphFilter, async () => {
      const filterSession = new GraphFilterSession(
        (maxCount, skip, filters) => this.git.getGraph(maxCount, skip, filters),
        () => getConfigValue<number>('maxGraphCommits', 200)
      );
      const getMasterSnapshot = () => ({
        filters: {},
        branches: this.state.branches,
        commits: this.state.graph,
        hasMore: this.state.graphHasMore
      });
      GraphFilterView.open(
        {
          apply: async (filters) => {
            const snapshot = await filterSession.apply(filters);
            const isActive = Object.values(filters).some(Boolean);
            await vscode.commands.executeCommand('setContext', 'vscodeGitClient.graphFilterActive', isActive);
            return snapshot;
          },
          clear: async () => {
            await vscode.commands.executeCommand('setContext', 'vscodeGitClient.graphFilterActive', false);
            return filterSession.clear(getMasterSnapshot());
          },
          openCommitDetails: async (sha, subject) => this.openCommitDetails(sha, subject, { allowToggle: true }),
          openCommitRangeDetails: async (shas) => this.editor.openCommitRangeDetails(shas),
          getCommitFiles: async (sha) => this.git.getFilesInCommit(sha),
          openFileDiff: async (sha, filePath) => this.editor.openCommitFileDiff(sha, filePath),
          loadMore: async () => {
            return filterSession.loadMore(getMasterSnapshot());
          }
        },
        () => ({
          ...filterSession.getSnapshot(getMasterSnapshot()),
          branches: this.state.branches
        })
      );
    });

    register(CommandId.GraphClearFilter, async () => {
      await GraphFilterView.clearCurrentFilters();
      await vscode.commands.executeCommand('setContext', 'vscodeGitClient.graphFilterActive', false);
    });

    register(CommandId.GraphLoadMore, async () => {
      await this.state.loadMoreGraph();
    });

    register(CommandId.DiffOpen, async () => {
      await this.openDiffWorkflow();
    });

    register(CommandId.CompareOpen, async () => {
      await this.openCompareWorkflow();
    });

    register(CommandId.MergeOpenConflict, async () => {
      const conflicts = await this.git.getMergeConflicts();
      if (conflicts.length === 0) {
        void vscode.window.showInformationMessage('No conflicted files found.');
        return;
      }

      const picked = await vscode.window.showQuickPick(
        conflicts.map((item) => ({ label: item.path, description: item.status })),
        { title: 'Open conflict in merge editor' }
      );

      if (!picked) {
        return;
      }

      await this.editor.openMergeConflict(picked.label);
    });

    register(CommandId.MergeNext, async () => {
      await vscode.commands.executeCommand('merge-conflict.next');
    });

    register(CommandId.MergePrevious, async () => {
      await vscode.commands.executeCommand('merge-conflict.previous');
    });

    register(CommandId.MergeFinalize, async () => {
      const conflicts = await this.git.getMergeConflicts();
      if (conflicts.length > 0) {
        void vscode.window.showWarningMessage(`Resolve all conflicts before finalizing (${conflicts.length} remaining).`);
        return;
      }

      const changed = await this.git.getChangedFiles();
      if (changed.length > 0) {
        await this.git.addAll();
      }

      void vscode.window.showInformationMessage('All conflicts resolved. Ready to commit merge.');
      await this.state.refreshAll();
    });

    register(CommandId.ConflictAcceptOurs, async (arg?: unknown) => {
      const path = this.pickConflictPathArg(arg) ?? (await this.pickConflictPath('Accept Yours (ours) for which file?'));
      if (!path) { return; }
      await this.git.resolveConflictOurs(path);
      await this.state.refreshChanges();
      void vscode.window.showInformationMessage(`Accepted yours: ${path}`);
    });

    register(CommandId.ConflictAcceptTheirs, async (arg?: unknown) => {
      const path = this.pickConflictPathArg(arg) ?? (await this.pickConflictPath('Accept Theirs for which file?'));
      if (!path) { return; }
      await this.git.resolveConflictTheirs(path);
      await this.state.refreshChanges();
      void vscode.window.showInformationMessage(`Accepted theirs: ${path}`);
    });

    register(CommandId.ConflictAcceptBoth, async (arg?: unknown) => {
      const path = this.pickConflictPathArg(arg) ?? (await this.pickConflictPath('Accept Both: open merge editor for which file?'));
      if (!path) { return; }
      await this.editor.openMergeConflict(path);
    });

    register(CommandId.OperationAbort, async () => {
      const state = await this.git.getOperationState();
      if (state.kind === 'none') {
        void vscode.window.showInformationMessage('No merge/rebase/cherry-pick/revert in progress.');
        return;
      }
      const confirmed = await confirmDangerousAction({
        title: `Abort ${state.kind}`,
        detail: 'This will reset the working tree to before the operation started.',
        acceptLabel: 'Abort'
      });
      if (!confirmed) { return; }
      try {
        if (state.kind === 'merge') { await this.git.mergeAbort(); }
        else if (state.kind === 'rebase') { await this.git.rebaseAbort(); }
        else if (state.kind === 'cherry-pick') { await this.git.cherryPickAbort(); }
        else if (state.kind === 'revert') { await this.git.revertAbort(); }
      } finally {
        await this.state.refreshAll();
      }
    });

    register(CommandId.OperationContinue, async () => {
      const state = await this.git.getOperationState();
      if (state.kind === 'none') {
        void vscode.window.showInformationMessage('No merge/rebase/cherry-pick/revert in progress.');
        return;
      }
      const conflicts = await this.git.getMergeConflicts();
      if (conflicts.length > 0) {
        if (state.kind === 'rebase') {
          await this.handleRebaseConflict();
          return;
        }
        void vscode.window.showWarningMessage(`Resolve all conflicts before continuing (${conflicts.length} remaining).`);
        return;
      }
      try {
        if (state.kind === 'merge') {
          await vscode.commands.executeCommand(CommandId.MergeFinalize);
          return;
        }
        if (state.kind === 'rebase') {
          try {
            await this.git.rebaseContinue();
          } catch (error) {
            const issue = this.classifyRebaseIssue(error);
            if (issue.kind === 'conflict') {
              await this.handleOperationConflict('rebase', this.state.refreshAll());
              return;
            }
            throw error;
          }
          await this.state.refreshAll();
          await this.showRebaseProgressFeedback();
          return;
        }
        if (state.kind === 'cherry-pick') {
          await this.git.cherryPickContinue();
        } else if (state.kind === 'revert') {
          await this.git.revertContinue();
        }
      } finally {
        if (state.kind !== 'rebase') {
          await this.state.refreshAll();
        }
      }
    });

    register(CommandId.OperationSkip, async () => {
      const state = await this.git.getOperationState();
      if (state.kind === 'rebase') {
        await this.git.rebaseSkip();
      } else if (state.kind === 'cherry-pick') {
        await this.git.cherryPickSkip();
      } else {
        void vscode.window.showInformationMessage('Skip is only available during rebase or cherry-pick.');
        return;
      }
      await this.state.refreshAll();
    });

    register(CommandId.GitPushWithPreview, async () => {
      const preview = await this.git.getOutgoingIncomingPreview();
      const confirmed = await confirmDangerousAction({
        title: 'Push current branch',
        detail: `Outgoing commits:\n${preview.outgoing.slice(0, 10).join('\n') || 'none'}`,
        acceptLabel: 'Push'
      });
      if (!confirmed) {
        return;
      }

      await this.git.push();
      await this.state.refreshAll();
    });

    register(CommandId.GitPullWithPreview, async () => {
      const preview = await this.git.getOutgoingIncomingPreview();
      const confirmed = await confirmDangerousAction({
        title: 'Pull current branch',
        detail: `Incoming commits:\n${preview.incoming.slice(0, 10).join('\n') || 'none'}`,
        acceptLabel: 'Pull'
      });
      if (!confirmed) {
        return;
      }

      await this.git.pull();
      await this.state.refreshAll();
    });

    register(CommandId.GitFetchPrune, async () => {
      await this.git.fetchPrune();
      await this.state.refreshAll();
      void vscode.window.showInformationMessage('Fetch --prune completed.');
    });

    register(CommandId.StagePatch, async () => {
      const changed = await this.git.getChangedFiles();
      if (changed.length === 0) {
        void vscode.window.showInformationMessage('No local changes found.');
        return;
      }

      const file = await vscode.window.showQuickPick(
        changed.map((item) => ({ label: item.path, description: item.status })),
        { title: 'Select file for interactive hunk staging' }
      );

      if (!file) {
        return;
      }

      await this.git.stagePatch(file.label);
      await this.state.refreshAll();
    });

    register(CommandId.StageFile, async () => {
      const changed = await this.git.getChangedFiles();
      const candidates = changed.filter((entry) => entry.status.length > 0 && entry.status[1] !== ' ');
      if (candidates.length === 0) {
        void vscode.window.showInformationMessage('No unstaged files found.');
        return;
      }

      const file = await vscode.window.showQuickPick(
        candidates.map((item) => ({ label: item.path, description: item.status })),
        { title: 'Stage file' }
      );
      if (!file) {
        return;
      }

      await this.git.stageFile(file.label);
      await this.state.refreshAll();
    });

    register(CommandId.ScmShelveResource, async (arg?: unknown) => {
      const filePath = toRepoFilePath(arg);
      if (!filePath) {
        void vscode.window.showWarningMessage('Select a Source Control file to shelve.');
        return;
      }

      const defaultMessage = `Shelve ${filePath}`;
      const rawMessage = await vscode.window.showInputBox({
        title: 'Shelve selected change',
        value: defaultMessage,
        placeHolder: 'Shelve message'
      });
      if (rawMessage === undefined) {
        return;
      }

      const message = rawMessage.trim() || defaultMessage;
      const changes = await this.git.getChangedFiles();
      const includeUntracked = changes.some((item) => item.path === filePath && item.status.trim() === '??');

      await this.git.stashFiles([filePath], message, {
        keepIndex: true,
        includeUntracked
      });

      await this.state.refreshAll();
      void vscode.window.showInformationMessage(`Shelved ${filePath}.`);
    });

    register(CommandId.UnstageFile, async () => {
      const changed = await this.git.getChangedFiles();
      const candidates = changed.filter((entry) => entry.status.length > 1 && entry.status[0] !== ' ' && entry.status[0] !== '?');
      if (candidates.length === 0) {
        void vscode.window.showInformationMessage('No staged files found.');
        return;
      }

      const file = await vscode.window.showQuickPick(
        candidates.map((item) => ({ label: item.path, description: item.status })),
        { title: 'Unstage file' }
      );
      if (!file) {
        return;
      }

      await this.git.unstageFile(file.label);
      await this.state.refreshAll();
    });

    register(CommandId.CommitAmend, async () => {
      const defaultMessage = await this.git.getHeadCommitMessage();
      const message = await vscode.window.showInputBox({
        title: 'Amend last commit message',
        value: defaultMessage,
        prompt: 'Leave unchanged to amend content only'
      });

      if (message === undefined) {
        return;
      }

      if (message.trim() && message.trim() !== defaultMessage.trim()) {
        await this.git.amendCommit(message.trim());
      } else {
        await this.git.amendCommit();
      }
      await this.state.refreshAll();
    });

    register(CommandId.ScmCommitTemplate, async () => {
      const repository = await this.getBuiltInGitRepository();
      if (!repository) {
        void vscode.window.showWarningMessage('Git repository context not available.');
        return;
      }

      const templates = loadTemplates();
      if (templates.length === 0) {
        void vscode.window.showInformationMessage('No commit templates configured.');
        return;
      }

      const picked = await vscode.window.showQuickPick(
        templates.map((template) => ({
          label: template.label,
          description: template.template,
          template: template.template
        })),
        {
          title: 'Insert commit message template',
          placeHolder: 'Pick a template'
        }
      );
      if (!picked) {
        return;
      }

      let branch = '';
      try {
        branch = await this.git.getCurrentBranch();
      } catch {
        // ignore: branch placeholder will stay empty
      }

      const expanded = expandTemplate(picked.template, { branch }).text;
      repository.inputBox.value = expanded;
    });

    register(CommandId.ScmGenerateCommitMessage, async () => {
      const repository = await this.getBuiltInGitRepository();
      if (!repository) {
        void vscode.window.showWarningMessage('Git repository context not available.');
        return;
      }

      const timeoutMs = getConfigValue<number>('aiGenerateTimeoutMs', 5000);
      const cts = new vscode.CancellationTokenSource();
      const timer = setTimeout(() => cts.cancel(), timeoutMs);

      try {
        const generated = await this.git.generateCommitMessage(cts.token);
        repository.inputBox.value = generated;
      } catch (error) {
        const message = cts.token.isCancellationRequested
          ? `AI generation timed out after ${timeoutMs / 1000}s.`
          : String(error);
        void vscode.window.showErrorMessage(message);
      } finally {
        clearTimeout(timer);
        cts.dispose();
      }
    });

    register(CommandId.ScmAmendFromInput, async () => {
      const repository = await this.getBuiltInGitRepository();
      if (!repository) {
        void vscode.window.showWarningMessage('Git repository context not available.');
        return;
      }

      const commitMessage = repository.inputBox.value.trim();
      const confirmed = await confirmDangerousAction({
        title: 'Amend last commit',
        detail: commitMessage
          ? 'Use the current Source Control commit message and amend the last commit.'
          : 'Amend the last commit without changing its message.',
        acceptLabel: 'Amend'
      });
      if (!confirmed) {
        return;
      }

      await this.git.amendCommit(commitMessage || undefined);
      repository.inputBox.value = '';
      await this.state.refreshAll();
    });

    register(CommandId.CompareWithRevision, async (arg?: unknown, selected?: unknown) => {
      const targetUris = toExplorerResourceUris(arg, selected);
      if (targetUris.length === 0) {
        void vscode.window.showWarningMessage('Right-click a file or folder in the Explorer to compare.');
        return;
      }

      if (!(await this.git.isRepo())) {
        void vscode.window.showErrorMessage('Not inside a Git repository');
        return;
      }

      const gitRoot = await this.git.getGitRoot();
      const normalizedRoot = gitRoot.replace(/[\\/]+$/, '');
      const targets: Array<{ repoRelative: string; isDirectory: boolean }> = [];
      for (const uri of targetUris) {
        const normalizedTarget = uri.fsPath.replace(/[\\/]+$/, '');
        const repoRelative = normalizedTarget === normalizedRoot
          ? ''
          : this.git.toRepoRelative(uri.fsPath);
        if (repoRelative === undefined) {
          void vscode.window.showErrorMessage('Not inside a Git repository');
          return;
        }

        let stat: vscode.FileStat;
        try {
          stat = await vscode.workspace.fs.stat(uri);
        } catch {
          void vscode.window.showErrorMessage('Selected path is no longer available.');
          return;
        }
        targets.push({
          repoRelative,
          isDirectory: (stat.type & vscode.FileType.Directory) !== 0
        });
      }

      const selection = await pickRevisionToCompare(
        this.git,
        () => this.state.branches,
        () => this.state.tags,
        () => this.state.refreshBranches()
      );
      if (!selection) {
        return;
      }

      for (const target of targets) {
        if (target.isDirectory) {
          await this.editor.openCompareWithRevisionForFolder(target.repoRelative, selection.ref, selection.label);
        } else {
          await this.editor.openCompareWithRevisionForFile(target.repoRelative, selection.ref, selection.label);
        }
      }
    });

    register(CommandId.DirectoryTimelineOpen, async (arg?: unknown) => {
      const targetUri = asFileResourceUri(arg);
      if (!targetUri) {
        void vscode.window.showWarningMessage('Right-click a folder in the Explorer to view its timeline.');
        return;
      }

      if (!(await this.git.isRepo())) {
        void vscode.window.showErrorMessage('Not inside a Git repository');
        return;
      }

      let stat: vscode.FileStat;
      try {
        stat = await vscode.workspace.fs.stat(targetUri);
      } catch {
        void vscode.window.showErrorMessage('Selected folder is no longer available.');
        return;
      }

      if ((stat.type & vscode.FileType.Directory) === 0) {
        void vscode.window.showWarningMessage('Select a folder in the Explorer to view its timeline.');
        return;
      }

      const gitRoot = await this.git.getGitRoot();
      const normalizedRoot = gitRoot.replace(/[\\/]+$/, '');
      const normalizedTarget = targetUri.fsPath.replace(/[\\/]+$/, '');
      const repoRelative = normalizedTarget === normalizedRoot
        ? ''
        : this.git.toRepoRelative(targetUri.fsPath);
      if (repoRelative === undefined) {
        void vscode.window.showErrorMessage('Not inside a Git repository');
        return;
      }

      await this.openDirectoryTimeline(repoRelative);
    });

    register(CommandId.FileBlameOpen, async () => {
      const file = this.getActiveFilePath();
      if (!file) {
        void vscode.window.showWarningMessage('Open a file to view blame.');
        return;
      }

      const blame = await this.git.fileBlame(file);
      const doc = await vscode.workspace.openTextDocument({ language: 'plaintext', content: blame });
      await vscode.window.showTextDocument(doc, { preview: false });
    });

    // ── Worktree commands ──────────────────────────────────────────────────

    register(CommandId.WorktreeRefresh, async () => {
      await this.state.refreshWorktrees();
    });

    register(CommandId.WorktreeOpen, async (arg?: unknown) => {
      const item = arg instanceof WorktreeTreeItem ? arg : undefined;
      const worktreePath = item?.worktree.worktreePath;
      if (!worktreePath) { return; }
      await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(worktreePath), { forceReuseWindow: true });
    });

    register(CommandId.WorktreeOpenInNewWindow, async (arg?: unknown) => {
      const item = arg instanceof WorktreeTreeItem ? arg : undefined;
      const worktreePath = item?.worktree.worktreePath;
      if (!worktreePath) { return; }
      await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(worktreePath), { forceNewWindow: true });
    });

    register(CommandId.WorktreeAddFromBranch, async () => {
      const selection = await this.pickWorktreeRevision('Add worktree from branch, tag, or revision');
      if (!selection) { return; }

      const targetPath = await this.pickWorktreeTargetPath('Select Worktree Folder', selection.ref);
      if (!targetPath) { return; }

      await this.git.addWorktree(targetPath, selection.ref);
      await this.state.refreshWorktrees();
    });

    register(CommandId.WorktreeAddNewBranch, async () => {
      const branchName = await vscode.window.showInputBox({
        title: 'New branch name',
        placeHolder: 'feature/my-branch',
        validateInput: (v) => v.trim() ? undefined : 'Branch name is required'
      });
      if (!branchName) { return; }

      const base = await this.pickWorktreeRevision('Select base branch, tag, or revision');

      const targetPath = await this.pickWorktreeTargetPath('Select Worktree Folder', branchName.trim());
      if (!targetPath) { return; }

      await this.git.addWorktreeBranch(targetPath, branchName.trim(), base?.ref);
      await this.state.refreshWorktrees();
    });

    register(CommandId.WorktreeAddDetached, async () => {
      const selection = await this.pickWorktreeRevision('Detached worktree at branch, tag, or revision');
      if (!selection) { return; }

      const targetPath = await this.pickWorktreeTargetPath('Select Worktree Folder', selection.ref);
      if (!targetPath) { return; }

      const confirmed = await confirmDangerousAction({
        title: 'Add detached worktree',
        detail: `This creates a worktree in detached HEAD state at ${selection.ref}`,
        acceptLabel: 'Create Detached'
      });
      if (!confirmed) { return; }

      await this.git.addDetachedWorktree(targetPath, selection.ref);
      await this.state.refreshWorktrees();
    });

    register(CommandId.WorktreeRemove, async (arg?: unknown) => {
      const item = arg instanceof WorktreeTreeItem ? arg : undefined;
      if (!item) { return; }
      const { worktree } = item;

      if (worktree.isCurrent) {
        void vscode.window.showWarningMessage('Cannot remove the current worktree.');
        return;
      }

      if (worktree.isLocked) {
        void vscode.window.showWarningMessage('Unlock the worktree before removing it.');
        return;
      }

      if (worktree.isDirty) {
        void vscode.window.showWarningMessage(
          `${worktree.worktreePath} has uncommitted changes. Use Force Remove if you want to discard them.`
        );
        return;
      } else {
        const confirmed = await confirmDangerousAction({
          title: 'Remove worktree',
          detail: worktree.worktreePath,
          acceptLabel: 'Remove'
        });
        if (!confirmed) { return; }
      }

      await this.git.removeWorktree(worktree.worktreePath);
      await this.state.refreshWorktrees();
    });

    register(CommandId.WorktreeRemoveForce, async (arg?: unknown) => {
      const item = arg instanceof WorktreeTreeItem ? arg : undefined;
      if (!item) { return; }
      const { worktree } = item;

      if (worktree.isCurrent) {
        void vscode.window.showWarningMessage('Cannot remove the current worktree.');
        return;
      }

      const confirmed = await confirmDangerousAction({
        title: 'Force remove worktree',
        detail: `${worktree.worktreePath} — all local changes will be lost. This cannot be undone.`,
        acceptLabel: 'Force Remove'
      });
      if (!confirmed) { return; }

      await this.git.removeWorktree(worktree.worktreePath, true);
      await this.state.refreshWorktrees();
    });

    register(CommandId.WorktreeLock, async (arg?: unknown) => {
      const item = arg instanceof WorktreeTreeItem ? arg : undefined;
      if (!item) { return; }

      const reason = await vscode.window.showInputBox({
        title: 'Lock reason (optional)',
        placeHolder: 'e.g. long-running experiment'
      });

      await this.git.lockWorktree(item.worktree.worktreePath, reason?.trim() || undefined);
      await this.state.refreshWorktrees();
    });

    register(CommandId.WorktreeUnlock, async (arg?: unknown) => {
      const item = arg instanceof WorktreeTreeItem ? arg : undefined;
      if (!item) { return; }

      await this.git.unlockWorktree(item.worktree.worktreePath);
      await this.state.refreshWorktrees();
    });

    register(CommandId.WorktreePrunePreview, async () => {
      const prunable = await this.git.getPrunableWorktrees();
      if (prunable.length === 0) {
        void vscode.window.showInformationMessage('No prunable worktrees found.');
        return;
      }

      const items = prunable.map((p) => ({ label: p.worktreePath, description: p.reason }));
      await vscode.window.showQuickPick(items, {
        title: 'Prunable worktrees (dry run)',
        placeHolder: 'These worktrees would be pruned',
        canPickMany: false
      });
    });

    register(CommandId.WorktreePrune, async () => {
      const prunable = await this.git.getPrunableWorktrees();
      if (prunable.length === 0) {
        void vscode.window.showInformationMessage('No prunable worktrees found.');
        return;
      }

      const items = prunable.map((p) => ({ label: p.worktreePath, description: p.reason }));
      const confirmed = await vscode.window.showQuickPick(items, {
        title: `Prune ${prunable.length} stale worktree(s)?`,
        placeHolder: 'Review — confirm by pressing Enter',
        canPickMany: false
      });
      if (!confirmed) { return; }

      await this.git.pruneWorktrees();
      await this.state.refreshWorktrees();
      void vscode.window.showInformationMessage('Stale worktrees pruned.');
    });

    register(CommandId.WorktreeRevealInFinder, async (arg?: unknown) => {
      const item = arg instanceof WorktreeTreeItem ? arg : undefined;
      if (!item) { return; }
      await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(item.worktree.worktreePath));
    });

    register(CommandId.WorktreeOpenTerminal, async (arg?: unknown) => {
      const item = arg instanceof WorktreeTreeItem ? arg : undefined;
      if (!item) { return; }
      const terminal = vscode.window.createTerminal({ cwd: item.worktree.worktreePath, name: `Worktree: ${item.label}` });
      terminal.show();
    });

    // ── Submodule commands ─────────────────────────────────────────────────

    register(CommandId.SubmoduleRefresh, async () => {
      await this.state.refreshSubmodules();
    });

    register(CommandId.SubmoduleInit, async (arg?: unknown) => {
      const item = arg instanceof SubmoduleTreeItem ? arg : undefined;
      if (!item) { return; }
      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Initializing submodule ${item.submodule.path}…`,
            autoShow: false,
            command: 'Submodule init'
          },
          ({ sink, signal }) => this.git.initSubmodule(item.submodule.path, { sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });

    register(CommandId.SubmoduleInitAll, async () => {
      const count = this.state.submodules.length;
      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Initializing ${count} submodule(s)…`,
            autoShow: true,
            command: 'Submodule init (all)'
          },
          ({ sink, signal }) => this.git.initAllSubmodules({ sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });

    register(CommandId.SubmoduleUpdate, async (arg?: unknown) => {
      const item = arg instanceof SubmoduleTreeItem ? arg : undefined;
      if (!item) { return; }

      if (item.submodule.isDirty) {
        const confirmed = await confirmDangerousAction({
          title: 'Update dirty submodule',
          detail: `${item.submodule.path} has uncommitted changes.`,
          acceptLabel: 'Update anyway'
        });
        if (!confirmed) { return; }
      }

      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Updating submodule ${item.submodule.path}…`,
            autoShow: false,
            command: 'Submodule update'
          },
          ({ sink, signal }) => this.git.updateSubmodule(item.submodule.path, false, { sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });

    register(CommandId.SubmoduleUpdateAll, async () => {
      const submodules = this.state.submodules;
      const dirtyCount = submodules.filter((s) => s.isDirty).length;
      if (dirtyCount > 0) {
        const confirmed = await confirmDangerousAction({
          title: 'Update all submodules',
          detail: `${dirtyCount} submodule(s) have uncommitted changes.`,
          acceptLabel: 'Update all'
        });
        if (!confirmed) { return; }
      }
      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Updating ${submodules.length} submodule(s)…`,
            autoShow: true,
            command: 'Submodule update (all)'
          },
          ({ sink, signal }) => this.git.updateAllSubmodules(false, { sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });

    register(CommandId.SubmoduleUpdateRecursive, async () => {
      const submodules = this.state.submodules;
      const dirtyCount = submodules.filter((s) => s.isDirty).length;
      const confirmed = await confirmDangerousAction({
        title: 'Update all submodules recursively',
        detail: dirtyCount > 0
          ? `${submodules.length} submodule(s) will be updated recursively. ${dirtyCount} have uncommitted changes.`
          : `${submodules.length} submodule(s) will be updated recursively.`,
        acceptLabel: 'Update Recursive'
      });
      if (!confirmed) { return; }
      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Recursively updating ${submodules.length} submodule(s)…`,
            autoShow: true,
            command: 'Submodule update (recursive)'
          },
          ({ sink, signal }) => this.git.updateAllSubmodules(true, { sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });

    register(CommandId.SubmoduleSync, async (arg?: unknown) => {
      const item = arg instanceof SubmoduleTreeItem ? arg : undefined;
      if (!item) { return; }
      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Syncing submodule ${item.submodule.path}…`,
            autoShow: false,
            command: 'Submodule sync'
          },
          ({ sink, signal }) => this.git.syncSubmodule(item.submodule.path, false, { sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });

    register(CommandId.SubmoduleSyncAll, async () => {
      const count = this.state.submodules.length;
      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Syncing ${count} submodule(s)…`,
            autoShow: true,
            command: 'Submodule sync (all)'
          },
          ({ sink, signal }) => this.git.syncSubmodule(undefined, true, { sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });

    register(CommandId.SubmoduleOpen, async (arg?: unknown) => {
      const item = arg instanceof SubmoduleTreeItem ? arg : undefined;
      if (!item) { return; }
      const fullPath = `${this.git.gitRoot}/${item.submodule.path}`;
      await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(fullPath), { forceReuseWindow: true });
    });

    register(CommandId.SubmoduleOpenInNewWindow, async (arg?: unknown) => {
      const item = arg instanceof SubmoduleTreeItem ? arg : undefined;
      if (!item) { return; }
      const fullPath = `${this.git.gitRoot}/${item.submodule.path}`;
      await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(fullPath), { forceNewWindow: true });
    });

    register(CommandId.SubmoduleOpenTerminal, async (arg?: unknown) => {
      const item = arg instanceof SubmoduleTreeItem ? arg : undefined;
      if (!item) { return; }
      const fullPath = `${this.git.gitRoot}/${item.submodule.path}`;
      const terminal = vscode.window.createTerminal({ cwd: fullPath, name: `Submodule: ${item.submodule.name}` });
      terminal.show();
    });

    register(CommandId.SubmoduleCheckoutRecorded, async (arg?: unknown) => {
      const item = arg instanceof SubmoduleTreeItem ? arg : undefined;
      if (!item) { return; }
      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Checking out recorded commit for ${item.submodule.path}…`,
            autoShow: false,
            command: 'Submodule checkout recorded'
          },
          ({ sink, signal }) => this.git.checkoutRecordedSubmoduleCommit(item.submodule.path, { sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });

    register(CommandId.SubmodulePullTrackedBranch, async (arg?: unknown) => {
      const item = arg instanceof SubmoduleTreeItem ? arg : undefined;
      if (!item) { return; }
      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Pulling tracked branch in ${item.submodule.path}…`,
            autoShow: false,
            command: 'Submodule pull'
          },
          ({ sink, signal }) => this.git.pullSubmoduleTrackedBranch(item.submodule.path, { sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });

    register(CommandId.SubmoduleDiffPointer, async (arg?: unknown) => {
      const item = arg instanceof SubmoduleTreeItem ? arg : undefined;
      if (!item) { return; }
      const diff = await this.git.getSubmodulePointerDiff(item.submodule.path);
      if (!diff.trim()) {
        void vscode.window.showInformationMessage('No pointer diff for this submodule.');
        return;
      }
      const doc = await vscode.workspace.openTextDocument({ content: diff, language: 'diff' });
      await vscode.window.showTextDocument(doc);
    });

    register(CommandId.SubmoduleStagePointerChange, async (arg?: unknown) => {
      const item = arg instanceof SubmoduleTreeItem ? arg : undefined;
      if (!item) { return; }
      await this.git.stageSubmodulePointer(item.submodule.path);
      await this.state.refreshAll();
    });

    register(CommandId.SubmoduleDeinit, async (arg?: unknown) => {
      const item = arg instanceof SubmoduleTreeItem ? arg : undefined;
      if (!item) { return; }

      if (item.submodule.isDirty) {
        const confirmed = await confirmDangerousAction({
          title: 'Deinit dirty submodule',
          detail: `${item.submodule.path} has uncommitted changes that will be lost.`,
          acceptLabel: 'Deinit'
        });
        if (!confirmed) { return; }
      } else {
        const confirmed = await confirmDangerousAction({
          title: 'Deinit submodule',
          detail: `This will remove ${item.submodule.path} from the working tree.`,
          acceptLabel: 'Deinit'
        });
        if (!confirmed) { return; }
      }

      try {
        await withSubmoduleProgress(
          this.logger,
          {
            title: `Deiniting submodule ${item.submodule.path}…`,
            autoShow: false,
            command: 'Submodule deinit'
          },
          ({ sink, signal }) => this.git.deinitSubmodule(item.submodule.path, item.submodule.isDirty, { sink, signal })
        );
      } finally {
        await this.state.refreshSubmodules();
      }
    });
  }



  // ── Delegation wrappers ────────────────────────────────────────────────
  // Each method delegates to an extracted function; the class remains the
  // public API surface and TypeScript resolves `this` through the shape cast.

  private getErrorSummary(error: unknown): string {
    return getErrorSummary(error);
  }

  private classifyCherryPickIssue(error: unknown): { kind: CherryPickIssueKind; message?: string } {
    return classifyCherryPickIssue(error);
  }

  private classifyMergeIssue(error: unknown): { kind: MergeIssueKind; message?: string } {
    return classifyMergeIssue(error);
  }

  private classifyRebaseIssue(error: unknown): { kind: RebaseIssueKind; message?: string } {
    return classifyRebaseIssue(error);
  }

  private getActiveFilePath(): string | undefined {
    return getActiveFilePath.call(this as unknown as CommandControllerShape);
  }

  private async getBuiltInGitRepository(): Promise<GitScmRepository | undefined> {
    return getBuiltInGitRepository.call(this as unknown as CommandControllerShape);
  }

  private normalizeBranchActionHubArg(arg: unknown): string | undefined {
    return normalizeBranchActionHubArg(arg);
  }

  private resolveBranchNameForActionHub(rawBranchName: string): string | undefined {
    return resolveBranchNameForActionHub.call(this as unknown as CommandControllerShape, rawBranchName);
  }

  private async pickBranchName(title = 'Pick branch', remoteOnly = false): Promise<string | undefined> {
    return pickBranchName.call(this as unknown as CommandControllerShape, title, remoteOnly);
  }

  private async pickCommitSha(title: string): Promise<string | undefined> {
    return pickCommitSha.call(this as unknown as CommandControllerShape, title);
  }

  private async pickStashRef(title: string): Promise<string | undefined> {
    return pickStashRef.call(this as unknown as CommandControllerShape, title);
  }

  private pickConflictPathArg(arg: unknown): string | undefined {
    return pickConflictPathArg(arg);
  }

  private async pickConflictPath(title: string): Promise<string | undefined> {
    return pickConflictPath.call(this as unknown as CommandControllerShape, title);
  }

  private async pickWorktreeRevision(title: string): Promise<RevisionSelection | undefined> {
    return pickWorktreeRevision.call(this as unknown as CommandControllerShape, title);
  }

  private async pickWorktreeTargetPath(title: string, refName: string): Promise<string | undefined> {
    return pickWorktreeTargetPath.call(this as unknown as CommandControllerShape, title, refName);
  }

  private async pickFileFromWorkspace(title: string): Promise<string | undefined> {
    return pickFileFromWorkspace.call(this as unknown as CommandControllerShape, title);
  }

  private async pickPatchOutputTarget(title: string): Promise<'clipboard' | 'file' | undefined> {
    return pickPatchOutputTarget(title);
  }

  private async pickPatchSource(): Promise<{ kind: 'clipboard' | 'file' } | undefined> {
    return pickPatchSource();
  }

  private async readPatchFromFile(): Promise<string | undefined> {
    return readPatchFromFile();
  }

  private async applyPatchToWorkingTree(patch: string, context: { source: string }): Promise<void> {
    return applyPatchToWorkingTree.call(this as unknown as CommandControllerShape, patch, context);
  }

  private extractSelectableItem(value: unknown): SelectableChangeTreeItem | undefined {
    return extractSelectableItem(value);
  }

  private toSelectedItems(arg: unknown, selectedArg: unknown): SelectableChangeTreeItem[] {
    return toSelectedItems(arg, selectedArg);
  }

  private toSelectedChangeTarget(context: CommitActionContext): SelectedChangeTarget {
    return toSelectedChangeTarget(context);
  }

  private async resolveSelectedCommitFiles(arg: unknown, selectedArg: unknown): Promise<SelectedChangeTarget | undefined> {
    return resolveSelectedCommitFiles.call(this as unknown as CommandControllerShape, arg, selectedArg);
  }

  private async openOperationConflictEditors(operation: 'cherry-pick' | 'merge' | 'rebase'): Promise<void> {
    return openOperationConflictEditors.call(this as unknown as CommandControllerShape, operation);
  }

  private async handleRebaseConflict(): Promise<void> {
    return handleRebaseConflict.call(this as unknown as CommandControllerShape);
  }

  private async handleOperationConflict(
    operation: 'cherry-pick' | 'merge' | 'rebase',
    refreshPromise: Promise<void> = Promise.resolve()
  ): Promise<void> {
    return handleOperationConflict.call(this as unknown as CommandControllerShape, operation, refreshPromise);
  }

  private async showRebaseProgressFeedback(): Promise<void> {
    return showRebaseProgressFeedback.call(this as unknown as CommandControllerShape);
  }

  private async startMergeOperation(run: () => Promise<void>): Promise<void> {
    return startMergeOperation.call(this as unknown as CommandControllerShape, run);
  }

  private async startRebaseOperation(run: () => Promise<void>): Promise<void> {
    return startRebaseOperation.call(this as unknown as CommandControllerShape, run);
  }

  private async openCommitDetails(
    sha: string,
    subject: string,
    options: { openFirstDiff?: boolean; allowToggle?: boolean } = {}
  ): Promise<void> {
    return openCommitDetails.call(this as unknown as CommandControllerShape, sha, subject, options);
  }

  private async openCommitActionContextDiffs(context: CommitActionContext): Promise<void> {
    return openCommitActionContextDiffs.call(this as unknown as CommandControllerShape, context);
  }

  private async openSelectedFileDiffs(arg: unknown, selectedArg: unknown): Promise<boolean> {
    return openSelectedFileDiffs.call(this as unknown as CommandControllerShape, arg, selectedArg);
  }

  private async openBranchCommits(branchName: string): Promise<void> {
    return openBranchCommits.call(this as unknown as CommandControllerShape, branchName);
  }

  private async openRefCommits(id: string, title: string, ref: string): Promise<void> {
    return openRefCommits.call(this as unknown as CommandControllerShape, id, title, ref);
  }

  private async openDirectoryTimeline(repoRelativePath: string): Promise<void> {
    return openDirectoryTimeline.call(this as unknown as CommandControllerShape, repoRelativePath);
  }

  private async openQuickActions(): Promise<void> {
    return openQuickActions.call(this as unknown as CommandControllerShape);
  }

  private async openBranchActionHub(arg?: unknown): Promise<void> {
    return openBranchActionHub.call(this as unknown as CommandControllerShape, arg);
  }

  private async openDiffWorkflow(): Promise<void> {
    return openDiffWorkflow.call(this as unknown as CommandControllerShape);
  }

  private async openCompareWorkflow(): Promise<void> {
    return openCompareWorkflow.call(this as unknown as CommandControllerShape);
  }
}
