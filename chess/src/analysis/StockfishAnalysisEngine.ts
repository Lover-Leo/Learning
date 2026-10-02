import type { AnalysisEngine, AnalysisRequest, MultiPvRequest, MultiPvResult, PositionAnalysis } from './types'
import { parseInfoLine, scoreToWhitePerspective } from './uciParsing'
import { EngineCancelledError, UciWorkerClient } from '../engine/UciWorkerClient'
import { MultiPvAccumulator } from '../hints/multiPv'

const ANALYSIS_DEPTH = 11
const ANALYSIS_TIME_MS = 700
const UPDATE_THROTTLE_MS = 120
const HINT_DEPTH = 10
const HINT_TIME_MS = 900

export class StockfishAnalysisEngine implements AnalysisEngine {
  private readonly uci: UciWorkerClient
  private sequence = 0

  constructor(createWorker?: (url: string) => Worker) {
    this.uci = new UciWorkerClient(createWorker)
  }

  async initialize(): Promise<void> {
    await this.uci.initialize()
    this.uci.command('setoption name Hash value 8')
    this.uci.command('setoption name MultiPV value 1')
    await this.uci.ready()
  }

  async analyze(request: AnalysisRequest): Promise<PositionAnalysis> {
    await this.stop()
    this.uci.command('setoption name MultiPV value 1')
    const sequence = ++this.sequence
    let latest: PositionAnalysis | null = null
    let lastUpdateAt = 0

    const unsubscribe = this.uci.subscribe((line) => {
      if (sequence !== this.sequence) return
      const parsed = parseInfoLine(line)
      if (!parsed || parsed.multipv !== 1) return
      const candidate: PositionAnalysis = {
        requestId: request.requestId,
        fen: request.fen,
        score: scoreToWhitePerspective(parsed.score, request.fen),
        depth: parsed.depth,
        bestMove: parsed.bestMove,
        pv: parsed.pv,
        bound: parsed.bound,
      }
      if (!latest || candidate.depth >= latest.depth) latest = candidate

      const now = Date.now()
      if (request.onUpdate && (now - lastUpdateAt >= UPDATE_THROTTLE_MS || candidate.depth >= ANALYSIS_DEPTH)) {
        lastUpdateAt = now
        request.onUpdate(candidate)
      }
    })

    try {
      this.uci.command(`position fen ${request.fen}`)
      const bestMoveLine = this.uci.waitForLine((line) => line.startsWith('bestmove '), 12_000)
      this.uci.command(`go depth ${ANALYSIS_DEPTH} movetime ${ANALYSIS_TIME_MS}`)
      const bestMove = (await bestMoveLine).split(/\s+/)[1]
      if (sequence !== this.sequence) throw new EngineCancelledError()
      const finalAnalysis = latest as PositionAnalysis | null
      if (!finalAnalysis) throw new Error('分析完成，但没有收到有效评分。')

      return {
        ...finalAnalysis,
        bestMove: bestMove === '(none)' ? finalAnalysis.bestMove : bestMove,
      }
    } finally {
      unsubscribe()
    }
  }

  async analyzeMultiPv(request: MultiPvRequest): Promise<MultiPvResult> {
    await this.stop()
    const sequence = ++this.sequence
    const count = Math.max(1, Math.min(3, request.count))
    const accumulator = new MultiPvAccumulator(request.requestId, request.fen, count)
    this.uci.command(`setoption name MultiPV value ${count}`)
    await this.uci.ready()

    const unsubscribe = this.uci.subscribe((line) => {
      if (sequence !== this.sequence) return
      const parsed = parseInfoLine(line)
      if (parsed) accumulator.add(request.requestId, request.fen, parsed)
    })

    try {
      this.uci.command(`position fen ${request.fen}`)
      const bestMoveLine = this.uci.waitForLine((line) => line.startsWith('bestmove '), 12_000)
      this.uci.command(`go depth ${HINT_DEPTH} movetime ${HINT_TIME_MS}`)
      await bestMoveLine
      if (sequence !== this.sequence) throw new EngineCancelledError()
      const lines = accumulator.result()
      if (lines.length === 0) throw new Error('提示分析完成，但没有收到合法候选走法。')
      return { requestId: request.requestId, fen: request.fen, lines }
    } finally {
      unsubscribe()
      if (sequence === this.sequence) {
        this.uci.command('setoption name MultiPV value 1')
        await this.uci.ready().catch(() => undefined)
      }
    }
  }

  async stop(): Promise<void> {
    this.sequence += 1
    await this.uci.stop()
  }

  destroy(): void {
    this.sequence += 1
    this.uci.destroy()
  }
}
