import * as vscode from "vscode";
import { Logger } from "../../logger";
import type { SubmoduleLogSink } from "../../services/submoduleLogSink";

interface WithSubmoduleProgressOptions {
  title: string;
  autoShow: boolean;
  command: string;          // human-readable name for the warning toast, e.g. "Submodule update"
}

export async function withSubmoduleProgress(
  logger: Logger,
  options: WithSubmoduleProgressOptions,
  run: (args: { sink: SubmoduleLogSink; signal: AbortSignal }) => Promise<{ exitCode: number | null }>
): Promise<{ exitCode: number | null; cancelled: boolean }> {
  if (options.autoShow) {
    logger.show(true);
  }
  let cancelled = false;
  const controller = new AbortController();

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: options.title,
      cancellable: true
    },
    async (progress, token) => {
      token.onCancellationRequested(() => {
        cancelled = true;
        controller.abort();
      });

      const sink: SubmoduleLogSink = {
        header(line) { logger.appendRaw(line); },
        stdout(line) { logger.appendRaw(line); },
        stderr(line) {
          logger.appendRaw(line);
          progress.report({ message: line });
        },
        done(exitCode, durationMs) {
          const secs = (durationMs / 1000).toFixed(1);
          if (cancelled) {
            logger.appendRaw(`[cancelled after ${secs}s]`);
          } else {
            logger.appendRaw(`[done in ${secs}s, exit ${exitCode}]`);
          }
        },
        error(err) {
          logger.appendRaw(`[error] ${err.message}`);
        }
      };

      return run({ sink, signal: controller.signal });
    }
  );

  if (!cancelled && result.exitCode !== 0) {
    const action = await vscode.window.showWarningMessage(
      `${options.command} failed; see Output for details.`,
      'Show Output'
    );
    if (action === 'Show Output') {
      logger.show(true);
    }
  }

  return { exitCode: result.exitCode, cancelled };
}