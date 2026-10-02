import type { MultiPvLine, ParsedInfoLine } from '../analysis/types'
import { scoreToWhitePerspective } from '../analysis/uciParsing'

export class MultiPvAccumulator {
  private readonly lines = new Map<number, MultiPvLine>()

  constructor(
    readonly requestId: number,
    readonly fen: string,
    readonly count: number,
  ) {}

  add(requestId: number, fen: string, info: ParsedInfoLine): boolean {
    if (requestId !== this.requestId || fen !== this.fen) return false
    if (info.multipv < 1 || info.multipv > this.count || !info.bestMove) return false
    const current = this.lines.get(info.multipv)
    if (current && current.depth > info.depth) return false
    this.lines.set(info.multipv, {
      requestId,
      fen,
      multipv: info.multipv,
      score: scoreToWhitePerspective(info.score, fen),
      depth: info.depth,
      bestMove: info.bestMove,
      pv: info.pv,
      bound: info.bound,
    })
    return true
  }

  result(): MultiPvLine[] {
    return [...this.lines.values()].sort((a, b) => a.multipv - b.multipv)
  }
}
