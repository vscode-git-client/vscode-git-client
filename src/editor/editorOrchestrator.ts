import * as path from 'path';
import * as vscode from 'vscode';
import { getConfigValue } from '../configuration';
import { CommitFilesTreeProvider } from '../providers/commitFilesTreeProvider';
import { GitService } from '../services/gitService';
import { StateStore } from '../state/stateStore';
import { CompareResult } from '../types';
import { CompareCommitRangeSelection, CompareView } from '../views/compareView';
import { VirtualGitContentProvider } from './virtualGitContentProvider';

const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const VIRTUAL_GIT_SCHEME = 'vscodegitclient';
const WORKTREE_REF = 'WORKTREE';

type ComparableDiffSide =
  | { kind: 'ref'; ref: string; relativePath: string }
  | { kind: 'worktree'; relativePath: string };
type CompareWithRevisionDirection = 'forward' | 'reverse';

export class EditorOrchestrator {
  private compareView: CompareView | undefined;

  constructor(
    private readonly git: GitService,
    private readonly state: StateStore,
    private readonly contentProvider: VirtualGitContentProvider,
    private readonly commitFilesView: CommitFilesTreeProvider
  ) { }

  async openMergeConflict(filePath: string): Promise<void> {
    await this.git.openMergeEditor(filePath);
  }

  async openDiffForFile(options: {
    path: string;
    leftRef: string;
    rightRef: string;
    title?: string;
  }): Promise<void> {
    const leftUri = await this.createVirtualUri(options.leftRef, options.path);
    const rightUri = await this.createVirtualUri(options.rightRef, options.path);
    const title = options.title ?? `${options.leftRef} ↔ ${options.rightRef} · ${options.path}`;

    await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title, {
      preview: false,
      preserveFocus: false
    });
  }

  async openDiffForUri(uri: vscode.Uri, title: string): Promise<void> {
    await vscode.commands.executeCommand('vscode.diff', uri.with({ query: 'left' }), uri.with({ query: 'right' }), title, {
      preview: false,
      preserveFocus: false
    });
  }

  async openBranchCompare(leftRef: string, rightRef: string): Promise<CompareResult> {
    const result = await this.state.compareBranches(leftRef, rightRef);
    await this.commitFilesView.clear();
    this.ensureCompareView().render(result);
    this.ensureCompareView().reveal();
    return result;
  }

  async openCompareFromCommit(commitSha: string): Promise<void> {
    const current = await this.git.getCurrentBranch();
    await this.openBranchCompare(commitSha, current);
  }

  async showRepositoryAtRevision(sha: string): Promise<void> {
    await this.commitFilesView.showRevision(sha);
  }

  async openCommitFilesDiff(sha: string): Promise<void> {
    const files = await this.git.getFilesInCommit(sha);
    const choice = await vscode.window.showQuickPick(files, {
      title: `Commit ${sha.slice(0, 8)} files`,
      placeHolder: 'Pick a file to diff against parent'
    });

    if (!choice) {
      return;
    }

    await this.openDiffForFile({
      path: choice,
      leftRef: `${sha}^`,
      rightRef: sha,
      title: `${sha.slice(0, 8)} parent ↔ commit · ${choice}`
    });
  }

  async openCommitFileDiff(sha: string, filePath: string): Promise<void> {
    const entries = await this.git.getFilesInCommitWithStatus(sha);
    const entry = entries.find((item) => item.path === filePath);
    await this.openCommitFileDiffWithStatus(sha, filePath, entry?.status, { oldPath: entry?.oldPath });
  }

  async openBranchComparisonFileDiff(leftRef: string, rightRef: string): Promise<void> {
    const files = await this.git.getFilesChangedBetween(leftRef, rightRef);
    const choice = await vscode.window.showQuickPick(files, {
      title: `Files changed between ${leftRef} and ${rightRef}`,
      placeHolder: 'Pick a file to open diff'
    });

    if (!choice) {
      return;
    }

    await this.openDiffForFile({
      path: choice,
      leftRef,
      rightRef,
      title: `${leftRef} ↔ ${rightRef} · ${choice}`
    });
  }

  async openCommitFileDiffWithStatus(
    sha: string,
    filePath: string,
    status?: string,
    options?: { oldPath?: string }
  ): Promise<void> {
    const title = `${sha.slice(0, 8)} parent ↔ commit · ${filePath}`;
    const normalizedStatus = (status ?? '').trim().toUpperCase();
    const oldPath = options?.oldPath?.trim();
    const leftPath = oldPath && normalizedStatus.startsWith('R') ? oldPath : filePath;

    let leftContent = '';
    let rightContent = '';

    if (normalizedStatus !== 'A') {
      leftContent = await this.readContentOrEmpty(`${sha}^`, leftPath);
    }

    if (normalizedStatus !== 'D') {
      rightContent = await this.readContentOrEmpty(sha, filePath);
    }

    const normalized = filePath.replaceAll(path.sep, '/');
    const leftUri = vscode.Uri.parse(`vscodegitclient:${encodeURIComponent(`${sha}^`)}/${normalized}`);
    const rightUri = vscode.Uri.parse(`vscodegitclient:${encodeURIComponent(sha)}/${normalized}`);
    this.contentProvider.setContent(leftUri, leftContent);
    this.contentProvider.setContent(rightUri, rightContent);

    await this.closeEmptyEditorGroups();
    await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title, {
      preview: false,
      preserveFocus: false
    });
  }

  async openCommitRangeFileDiff(
    fromRef: string,
    toRef: string,
    filePath: string,
    labels?: { fromLabel?: string; toLabel?: string }
  ): Promise<void> {
    await this.closeEmptyEditorGroups();
    await this.openDiffForFile({
      path: filePath,
      leftRef: fromRef,
      rightRef: toRef,
      title: `${labels?.fromLabel ?? formatRevisionLabel(fromRef)} ↔ ${labels?.toLabel ?? formatRevisionLabel(toRef)} · ${filePath}`
    });
  }

  async openWorkingTreeFileDiff(
    relativePath: string,
    ref: string,
    refLabel: string,
    opts: { preview: boolean; status?: string; direction?: CompareWithRevisionDirection }
  ): Promise<void> {
    const direction = opts.direction ?? getCompareWithRevisionDirection();
    const revisionSide: ComparableDiffSide = { kind: 'ref', ref, relativePath };
    const worktreeSide: ComparableDiffSide = { kind: 'worktree', relativePath };
    const leftSide = direction === 'reverse' ? revisionSide : worktreeSide;
    const rightSide = direction === 'reverse' ? worktreeSide : revisionSide;
    const left = await this.createComparableDiffUri(leftSide, opts.status);
    const right = await this.createComparableDiffUri(rightSide, opts.status);

    const title = `${formatCompareWithRevisionSideLabel(leftSide, ref, refLabel)} ↔ ${formatCompareWithRevisionSideLabel(rightSide, ref, refLabel)} · ${relativePath}`;
    await vscode.commands.executeCommand('vscode.diff', left, right, title, {
      preview: opts.preview,
      preserveFocus: false
    });
  }

  async swapActiveCompareDirection(): Promise<void> {
    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
    const input = activeTab?.input;
    if (!(input instanceof vscode.TabInputTextDiff)) {
      void vscode.window.showInformationMessage('Open a VS Code Git Client diff tab to swap compare direction.');
      return;
    }

    const left = await this.parseComparableDiffSide(input.original);
    const right = await this.parseComparableDiffSide(input.modified);
    if (!left || !right) {
      void vscode.window.showInformationMessage('This diff tab was not opened by VS Code Git Client.');
      return;
    }

    if (left.relativePath !== right.relativePath) {
      void vscode.window.showInformationMessage('Cannot swap diff direction for sides that point at different files.');
      return;
    }

    const leftUri = await this.createComparableDiffUri(right);
    const rightUri = await this.createComparableDiffUri(left);
    const title = `${formatComparableSideLabel(right)} ↔ ${formatComparableSideLabel(left)} · ${left.relativePath}`;
    await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title, {
      preview: false,
      preserveFocus: false
    });
  }

  async openCompareWithRevisionForFile(
    relativePath: string,
    ref: string,
    refLabel: string
  ): Promise<void> {
    await this.openWorkingTreeFileDiff(relativePath, ref, refLabel, { preview: false });
  }

  async openCompareWithRevisionForFolder(
    folderRelPath: string,
    ref: string,
    refLabel: string
  ): Promise<void> {
    const scopeForGit = folderRelPath || undefined;
    const scopeForView = folderRelPath || '.';
    const files = await this.git.getFilesChangedBetweenWorkingTreeAndRef(ref, scopeForGit);
    if (files.length === 0) {
      void vscode.window.showInformationMessage(
        `No differences in ${scopeForView} against ${refLabel}.`
      );
      return;
    }

    await this.commitFilesView.showWorkingTreeComparison({
      ref,
      refLabel,
      scopePath: scopeForView,
      files
    });

    const first = files[0];
    await this.openWorkingTreeFileDiff(first.path, ref, refLabel, {
      preview: true,
      status: first.status
    });
  }

  async openCompareCommitRangeDetails(selection: CompareCommitRangeSelection): Promise<void> {
    await this.openCommitRangeDetails(selection.shas);
  }

  async openCommitRangeDetails(rawShas: readonly string[]): Promise<void> {
    const orderedShas = Array.from(
      new Set(
        rawShas
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter(Boolean)
      )
    );
    if (orderedShas.length < 2) {
      return;
    }

    const newestSha = orderedShas[0]!;
    const oldestSha = orderedShas[orderedShas.length - 1]!;
    const oldestParent = await this.git.getParentCommit(oldestSha);
    const fromRef = oldestParent ? `${oldestSha}^` : EMPTY_TREE_SHA;
    const toRef = newestSha;
    const fromLabel = oldestParent ? `${oldestSha.slice(0, 8)}^` : 'root';
    const toLabel = newestSha.slice(0, 8);
    const files = await this.git.getFilesChangedBetweenRefsWithStatus(fromRef, toRef);

    await this.commitFilesView.showCommitRange({
      fromRef,
      toRef,
      fromLabel,
      toLabel,
      files
    });
    if (files.length === 0) {
      void vscode.window.showInformationMessage('Selected commit range has no net file changes.');
    }
  }

  private async fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  async openFileAtRevision(ref: string, filePath: string): Promise<void> {
    const uri = await this.createVirtualUri(ref, filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true, viewColumn: vscode.ViewColumn.Beside });
  }

  async openWorkingTreeFile(filePath: string): Promise<void> {
    const gitRoot = await this.git.getGitRoot();
    const uri = vscode.Uri.file(path.join(gitRoot, filePath));
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, { preview: false, preserveFocus: false });
  }

  private ensureCompareView(): CompareView {
    if (!this.compareView) {
      this.compareView = new CompareView(
        async (sha, subject) => {
          if (this.commitFilesView.isShowingCommit(sha)) {
            await this.commitFilesView.clear();
            return;
          }
          await this.commitFilesView.showCommit(sha, subject);
        },
        async (selection) => {
          await this.openCompareCommitRangeDetails(selection);
        },
        {
          getCompareViewMode: () => this.state.getCompareViewMode(),
          setCompareViewMode: (mode) => this.state.setCompareViewMode(mode)
        },
        async (leftRef, rightRef) => {
          const result = await this.state.compareBranches(leftRef, rightRef);
          this.compareView?.render(result);
        }
      );
      this.compareView.onDispose(() => {
        void this.commitFilesView.clear();
        this.compareView = undefined;
      });
    }
    return this.compareView;
  }

  private async createVirtualUri(ref: string, relativePath: string): Promise<vscode.Uri> {
    const normalized = relativePath.replaceAll(path.sep, '/');
    const uri = withVirtualGitMetadata(
      vscode.Uri.parse(`${VIRTUAL_GIT_SCHEME}:${encodeURIComponent(ref)}/${normalized}`),
      { kind: 'ref', ref, relativePath: normalized }
    );
    const content = await this.git.getFileContentFromRef(ref, relativePath);
    this.contentProvider.setContent(uri, content);
    return uri;
  }

  private async createWorkingTreeUri(relativePath: string, status?: string): Promise<vscode.Uri> {
    const gitRoot = await this.git.getGitRoot();
    const onDiskUri = vscode.Uri.file(path.join(gitRoot, relativePath));
    const fileMissing = status === 'D' || !(await this.fileExists(onDiskUri));
    if (!fileMissing) {
      return onDiskUri;
    }

    const normalized = relativePath.replaceAll(path.sep, '/');
    const uri = withVirtualGitMetadata(
      vscode.Uri.parse(`${VIRTUAL_GIT_SCHEME}:${encodeURIComponent(WORKTREE_REF)}/${normalized}`),
      { kind: 'worktree', ref: WORKTREE_REF, relativePath: normalized }
    );
    this.contentProvider.setContent(uri, '');
    return uri;
  }

  private async createComparableDiffUri(side: ComparableDiffSide, status?: string): Promise<vscode.Uri> {
    if (side.kind === 'worktree') {
      return this.createWorkingTreeUri(side.relativePath, status);
    }
    return this.createVirtualUri(side.ref, side.relativePath);
  }

  private async parseComparableDiffSide(uri: vscode.Uri): Promise<ComparableDiffSide | undefined> {
    if (uri.scheme === VIRTUAL_GIT_SCHEME) {
      const parsed = parseVirtualGitUri(uri);
      if (!parsed) {
        return undefined;
      }
      if (parsed.kind === 'worktree') {
        return { kind: 'worktree', relativePath: parsed.relativePath };
      }
      return { kind: 'ref', ref: parsed.ref, relativePath: parsed.relativePath };
    }

    if (uri.scheme === 'file') {
      const repoRelative = this.git.toRepoRelative(uri.fsPath);
      if (repoRelative === undefined) {
        return undefined;
      }
      return { kind: 'worktree', relativePath: repoRelative };
    }

    return undefined;
  }

  private async readContentOrEmpty(ref: string, relativePath: string): Promise<string> {
    try {
      return await this.git.getFileContentFromRef(ref, relativePath);
    } catch {
      return '';
    }
  }

  private async closeEmptyEditorGroups(): Promise<void> {
    const groups = vscode.window.tabGroups.all;
    const allGroupsAreEmpty = groups.every((group) => group.tabs.length === 0);
    const emptyGroups = groups.filter((group) => group.tabs.length === 0 && !(allGroupsAreEmpty && group.isActive));

    if (emptyGroups.length > 0) {
      await vscode.window.tabGroups.close(emptyGroups, true);
    }
  }
}

function formatRevisionLabel(ref: string): string {
  const token = (ref ?? '').trim();
  if (!token) {
    return '';
  }
  if (/^[0-9a-f]{9,}$/i.test(token)) {
    return token.slice(0, 8);
  }
  return token;
}

function formatComparableSideLabel(side: ComparableDiffSide): string {
  return side.kind === 'worktree' ? 'working tree' : formatRevisionLabel(side.ref);
}

function formatCompareWithRevisionSideLabel(
  side: ComparableDiffSide,
  ref: string,
  refLabel: string
): string {
  if (side.kind === 'worktree') {
    return 'working tree';
  }
  return side.ref === ref ? refLabel : formatRevisionLabel(side.ref);
}

function getCompareWithRevisionDirection(): CompareWithRevisionDirection {
  const configured = getConfigValue<string>('compareWithRevision.defaultDirection', 'forward');
  return configured === 'reverse' ? 'reverse' : 'forward';
}

function parseVirtualGitUri(uri: vscode.Uri): { kind: 'ref' | 'worktree'; ref: string; relativePath: string } | undefined {
  const fromQuery = parseVirtualGitMetadata(uri.query);
  if (fromQuery) {
    return fromQuery;
  }

  const raw = uri.toString(true);
  const prefix = `${VIRTUAL_GIT_SCHEME}:`;
  if (!raw.startsWith(prefix)) {
    return undefined;
  }

  const payload = raw.slice(prefix.length);
  const separator = payload.indexOf('/');
  if (separator < 0) {
    return undefined;
  }

  const ref = decodeURIComponent(payload.slice(0, separator));
  const relativePath = decodeURI(payload.slice(separator + 1));
  if (!ref || !relativePath) {
    return undefined;
  }

  return {
    kind: ref === WORKTREE_REF ? 'worktree' : 'ref',
    ref,
    relativePath
  };
}

function withVirtualGitMetadata(
  uri: vscode.Uri,
  metadata: { kind: 'ref' | 'worktree'; ref: string; relativePath: string }
): vscode.Uri {
  const query = new URLSearchParams({
    kind: metadata.kind,
    ref: metadata.ref,
    path: metadata.relativePath
  });
  return uri.with({ query: query.toString() });
}

function parseVirtualGitMetadata(query: string): { kind: 'ref' | 'worktree'; ref: string; relativePath: string } | undefined {
  if (!query) {
    return undefined;
  }

  const params = new URLSearchParams(query);
  const kind = params.get('kind') === 'worktree' ? 'worktree' : 'ref';
  const ref = params.get('ref') ?? '';
  const relativePath = params.get('path') ?? '';
  if (!ref || !relativePath) {
    return undefined;
  }

  return { kind, ref, relativePath };
}
