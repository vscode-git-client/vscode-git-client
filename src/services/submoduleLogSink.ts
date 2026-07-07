// src/services/submoduleLogSink.ts
export interface SubmoduleLogSink {
  /** Called once per git invocation, with the equivalent shell command line. */
  header(line: string): void;
  /** Called per newline-delimited chunk of stdout. */
  stdout(line: string): void;
  /** Called per newline-delimited chunk of stderr (git progress lives here). */
  stderr(line: string): void;
  /** Called exactly once after child exit. exitCode is `null` if the child was killed or never spawned. */
  done(exitCode: number | null, durationMs: number): void;
  /** Called when the child fails to spawn or emits a process-level error. */
  error(err: Error): void;
}

export const NULL_SINK: SubmoduleLogSink = {
  header() {
    /* noop */
  },
  stdout() {
    /* noop */
  },
  stderr() {
    /* noop */
  },
  done() {
    /* noop */
  },
  error() {
    /* noop */
  }
};
