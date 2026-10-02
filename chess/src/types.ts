import type { Color, Move, PieceSymbol, Square } from 'chess.js'
import type { AnalysisStatus, MoveAssessment, PositionAnalysis } from './analysis/types'
import type { HintSession, HintUsageRecord } from './hints/types'

export type PromotionPiece = Extract<PieceSymbol, 'q' | 'r' | 'b' | 'n'>

export interface GameSnapshot {
  fen: string
  turn: Color
  history: Move[]
  lastMove: Pick<Move, 'from' | 'to'> | null
  isCheck: boolean
  isCheckmate: boolean
  isStalemate: boolean
  isDraw: boolean
  isGameOver: boolean
  drawReason: string | null
}

export type MoveResult =
  | { success: true; needsPromotion: false }
  | { success: false; needsPromotion: false }
  | { success: false; needsPromotion: true; options: PromotionPiece[] }

export interface PendingPromotion {
  from: Square
  to: Square
  options: PromotionPiece[]
}

export type GameMode = 'local' | 'computer'
export type ColorChoice = 'white' | 'black' | 'random'
export type Difficulty = 1 | 2 | 3 | 4 | 5
export type EngineStatus = 'idle' | 'loading' | 'ready' | 'thinking' | 'error'

export interface GameSettings {
  mode: GameMode
  colorChoice: ColorChoice
  difficulty: Difficulty
  analysisEnabled: boolean
}

export interface MatchState {
  snapshot: GameSnapshot
  settings: GameSettings
  playerColor: Color
  engineStatus: EngineStatus
  engineError: string | null
  isComputerThinking: boolean
  analysisStatus: AnalysisStatus
  currentAnalysis: PositionAnalysis | null
  analysisError: string | null
  moveAssessments: Record<number, MoveAssessment>
  hint: HintSession | null
  hintRecords: Record<number, HintUsageRecord>
}
