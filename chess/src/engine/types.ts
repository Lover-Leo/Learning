import type { Difficulty } from '../types'

export interface EngineDifficulty {
  label: string
  skillLevel: number
  depth: number
  moveTimeMs: number
}

export const ENGINE_DIFFICULTIES: Record<Difficulty, EngineDifficulty> = {
  1: { label: '入门', skillLevel: 0, depth: 3, moveTimeMs: 120 },
  2: { label: '简单', skillLevel: 4, depth: 5, moveTimeMs: 250 },
  3: { label: '中等', skillLevel: 8, depth: 8, moveTimeMs: 500 },
  4: { label: '困难', skillLevel: 14, depth: 12, moveTimeMs: 900 },
  5: { label: '专家', skillLevel: 20, depth: 16, moveTimeMs: 1500 },
}

export interface ChessEngine {
  initialize(): Promise<void>
  newGame(): Promise<void>
  setDifficulty(difficulty: Difficulty): void
  getBestMove(fen: string, difficulty: Difficulty): Promise<string | null>
  stop(): Promise<void>
  destroy(): void
}
