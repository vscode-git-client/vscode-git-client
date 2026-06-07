import type { EditorOrchestrator } from '../../editor/editorOrchestrator';
import type { Logger } from '../../logger';
import type { GitService } from '../../services/gitService';
import type { StateStore } from '../../state/stateStore';
import type { CommitFilesViewShape } from './types';

export interface CommandControllerShape {
  readonly git: GitService;
  readonly state: StateStore;
  readonly editor: EditorOrchestrator;
  readonly logger: Logger;
  readonly commitFilesView: CommitFilesViewShape;
}
