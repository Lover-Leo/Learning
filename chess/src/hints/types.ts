import type { Color, Square } from 'chess.js'
import type { EvaluationScore, ScoreBound } from '../analysis/types'

export type HintLevel = 0 | 1 | 2 | 3
export type HintStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface HintCandidate {
  multipv: number
  uci: string
  san: string
  score: EvaluationScore
  bound: ScoreBound
  depth: number
  pvUci: string[]
  pvSan: string[]
  conversionComplete: boolean
  afterFen: string | null
  explanation: string
  from: Square
  to: Square
}

export interface HintSession {
  gameRevision: number
  requestId: number
  fen: string
  ply: number
  turn: Color
  level: HintLevel
  status: HintStatus
  direction: string | null
  keySquare: Square | null
  keyPieceText: string | null
  candidates: HintCandidate[]
  selectedCandidate: number
  error: string | null
}

export interface HintUsageRecord {
  ply: number
  requested: boolean
  maxLevel: Exclude<HintLevel, 0>
  fen: string
  requestOrder: number
  requestedAt: number
  successful: boolean
  actualMove: string | null
  bestMove: string | null
  matchedBest: boolean | null
  inTopThree: boolean | null
}
