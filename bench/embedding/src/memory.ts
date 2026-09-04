const BYTES_PER_MIB = 1024 * 1024;

export class RssSampler {
  readonly startingRssMiB: number;
  #peakBytes: number;
  #timer: NodeJS.Timeout | undefined;

  constructor() {
    const startingBytes = process.memoryUsage().rss;
    this.startingRssMiB = startingBytes / BYTES_PER_MIB;
    this.#peakBytes = startingBytes;
  }

  start(): void {
    this.#timer = setInterval(() => {
      this.sample();
    }, 10);
    this.#timer.unref();
  }

  sample(): void {
    this.#peakBytes = Math.max(this.#peakBytes, process.memoryUsage().rss);
  }

  stop(): number {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
    this.sample();
    return this.#peakBytes / BYTES_PER_MIB;
  }
}
