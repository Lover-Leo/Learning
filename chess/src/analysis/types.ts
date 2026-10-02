import type { Color } from 'chess.js'

export type EvaluationScore =
  | { type: 'cp'; value: number }
  | { type: 'mate'; value: number }

export type ScoreBound = 'exact' | 'lower' | 'upper'
export type AnalysisStatus = 'off' | 'loading' | 'analyzing' | 'ready' | 'paused' | 'error'
export type MoveQuality = 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'

export interface ParsedInfoLine {
  depth: number
  multipv: number
  score: EvaluationScore
  bound: ScoreBound
  pv: string[]
  bestMove: string | null
}

export interface PositionAnalysis {
  requestId: number
  fen: string
  score: EvaluationScore
  depth: number
  bestMove: string | null
  pv: string[]
  bound: ScoreBound
}

export interface AnalysisRequest {
  requestId: number
  fen: string
  onUpdate?: (result: PositionAnalysis) => void
}

export interface MultiPvRequest {
  requestId: number
  fen: string
  count: number
}

export interface MultiPvLine extends PositionAnalysis {
  multipv: number
}

export interface MultiPvResult {
  requestId: number
  fen: string
  lines: MultiPvLine[]
}

export interface AnalysisEngine {
  initialize(): Promise<void>
  analyze(request: AnalysisRequest): Promise<PositionAnalysis>
  analyzeMultiPv?(request: MultiPvRequest): Promise<MultiPvResult>
  stop(): Promise<void>
  destroy(): void
}

export interface MoveAssessment {
  ply: number
  san: string
  actualMove: string
  bestMove: string | null
  playerColor: Color
  beforeFen: string
  afterFen: string
  before: PositionAnalysis
  after: PositionAnalysis
  lossCp: number | null
  quality: MoveQuality
  depth: number
}

export interface PendingMoveAssessment {
  gameRevision: number
  ply: number
  san: string
  actualMove: string
  playerColor: Color
  beforeFen: string
  afterFen: string
}
