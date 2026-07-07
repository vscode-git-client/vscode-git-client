export type RefreshScope =
  'changes' | 'refs' | 'graph' | 'stashes' | 'worktrees' | 'submodules' | 'full';

export interface RefreshSchedulerOptions {
  readonly delayMs?: number;
}

type RunRefresh = (scopes: ReadonlySet<RefreshScope>) => Promise<void>;

type Waiter = {
  resolve(): void;
  reject(error: unknown): void;
};

export class RefreshScheduler {
  private readonly pendingScopes = new Set<RefreshScope>();
  private waiters: Waiter[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;

  constructor(private readonly runRefresh: RunRefresh) {}

  request(scopes: Iterable<RefreshScope>, options: RefreshSchedulerOptions = {}): Promise<void> {
    for (const scope of scopes) {
      this.pendingScopes.add(scope);
    }

    const promise = new Promise<void>((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });

    if (this.timer) {
      clearTimeout(this.timer);
    }

    const delayMs = options.delayMs ?? 0;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.drain();
    }, delayMs);

    return promise;
  }

  private async drain(): Promise<void> {
    if (this.running) {
      return;
    }

    while (this.pendingScopes.size > 0) {
      const scopes = new Set(this.pendingScopes);
      const waiters = this.waiters;
      this.pendingScopes.clear();
      this.waiters = [];
      this.running = true;

      try {
        await this.runRefresh(scopes);
        waiters.forEach((waiter) => waiter.resolve());
      } catch (error) {
        waiters.forEach((waiter) => waiter.reject(error));
      } finally {
        this.running = false;
      }
    }
  }
}
