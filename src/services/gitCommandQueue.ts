export class GitCommandQueue {
  private readonly queue: Array<() => void> = [];
  private activeCount = 0;

  constructor(private readonly concurrency: number) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(() => {
        this.activeCount += 1;
        task()
          .then(resolve, reject)
          .finally(() => {
            this.activeCount -= 1;
            this.drain();
          });
      });
      this.drain();
    });
  }

  private drain(): void {
    while (this.activeCount < this.concurrency && this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    }
  }
}
