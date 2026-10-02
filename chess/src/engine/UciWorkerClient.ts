export const STOCKFISH_ENGINE_URL = `${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`

const UCI_TIMEOUT_MS = 15_000

interface LineWaiter {
  matches: (line: string) => boolean
  resolve: (line: string) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export class EngineCancelledError extends Error {
  constructor() {
    super('Engine calculation was cancelled.')
    this.name = 'EngineCancelledError'
  }
}

export class UciWorkerClient {
  private worker: Worker | null = null
  private initialized = false
  private initialization: Promise<void> | null = null
  private waiters: LineWaiter[] = []
  private listeners = new Set<(line: string) => void>()
  private searching = false
  private stopping: Promise<void> | null = null

  constructor(private readonly createWorker: (url: string) => Worker = (url) => new Worker(url)) {}

  initialize(): Promise<void> {
    if (this.initialized) return Promise.resolve()
    if (this.initialization) return this.initialization
    this.initialization = this.doInitialize().finally(() => {
      this.initialization = null
    })
    return this.initialization
  }

  private async doInitialize(): Promise<void> {
    this.destroy()
    const worker = this.createWorker(STOCKFISH_ENGINE_URL)
    this.worker = worker
    worker.onmessage = (event: MessageEvent<unknown>) => this.handleLine(String(event.data))
    worker.onerror = (event) => this.failAll(new Error(event.message || 'Stockfish Worker 加载失败。'))
    await this.sendAndWait('uci', (line) => line === 'uciok')
    await this.ready()
    this.initialized = true
  }

  async ready(): Promise<void> {
    await this.sendAndWait('isready', (line) => line === 'readyok')
  }

  command(command: string): void {
    if (!this.worker) throw new Error('Stockfish Worker 尚未创建。')
    if (/^go\b/.test(command)) this.searching = true
    this.worker.postMessage(command)
  }

  sendAndWait(
    command: string,
    matches: (line: string) => boolean,
    timeoutMs = UCI_TIMEOUT_MS,
  ): Promise<string> {
    const response = this.waitForLine(matches, timeoutMs)
    this.command(command)
    return response
  }

  waitForLine(matches: (line: string) => boolean, timeoutMs = UCI_TIMEOUT_MS): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const entry: LineWaiter = {
        matches,
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.waiters = this.waiters.filter((waiter) => waiter !== entry)
          reject(new Error('Stockfish 响应超时。'))
        }, timeoutMs),
      }
      this.waiters.push(entry)
    })
  }

  subscribe(listener: (line: string) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async newGame(): Promise<void> {
    await this.stop()
    this.command('ucinewgame')
    await this.ready()
  }

  async stop(): Promise<void> {
    if (this.stopping) return this.stopping
    if (!this.worker || !this.searching) return
    this.stopping = this.doStop()
    try {
      await this.stopping
    } finally {
      this.stopping = null
    }
  }

  private async doStop(): Promise<void> {
    if (!this.worker || !this.searching) return
    try {
      await this.sendAndWait('stop', (line) => line.startsWith('bestmove '), 1_500)
    } catch (error) {
      if (error instanceof EngineCancelledError) return
      this.destroy()
      await this.initialize()
    }
  }

  destroy(): void {
    this.failWaiters(new EngineCancelledError())
    if (this.worker) {
      try {
        this.worker.postMessage('quit')
      } finally {
        this.worker.terminate()
      }
    }
    this.worker = null
    this.initialized = false
    this.searching = false
  }

  private handleLine(line: string): void {
    if (line.startsWith('bestmove ')) this.searching = false
    this.listeners.forEach((listener) => listener(line))
    const matching = this.waiters.filter((waiter) => waiter.matches(line))
    matching.forEach((waiter) => {
      clearTimeout(waiter.timeout)
      this.waiters = this.waiters.filter((candidate) => candidate !== waiter)
      waiter.resolve(line)
    })
  }

  private failWaiters(error: Error): void {
    this.waiters.forEach((waiter) => {
      clearTimeout(waiter.timeout)
      waiter.reject(error)
    })
    this.waiters = []
  }

  private failAll(error: Error): void {
    this.failWaiters(error)
    this.searching = false
    this.initialized = false
  }
}
