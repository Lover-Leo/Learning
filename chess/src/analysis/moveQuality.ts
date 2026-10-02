import type { Color } from 'chess.js'
import type { EvaluationScore, MoveQuality, PositionAnalysis } from './types'
import { scoreToPlayerPerspective } from './uciParsing'

export const MOVE_QUALITY_LABELS: Record<MoveQuality, string> = {
  best: '最佳',
  excellent: '优秀',
  good: '良好',
  inaccuracy: '不准确',
  mistake: '失误',
  blunder: '严重失误',
}

export function classifyCentipawnLoss(lossCp: number): MoveQuality {
  const loss = Math.max(0, lossCp)
  if (loss <= 20) return 'best'
  if (loss <= 50) return 'excellent'
  if (loss <= 100) return 'good'
  if (loss <= 200) return 'inaccuracy'
  if (loss <= 400) return 'mistake'
  return 'blunder'
}

export interface QualityResult {
  quality: MoveQuality
  lossCp: number | null
}

export function assessMoveQuality(
  before: PositionAnalysis,
  after: PositionAnalysis,
  playerColor: Color,
  actualMove: string,
): QualityResult {
  if (before.bestMove === actualMove) return { quality: 'best', lossCp: 0 }

  const beforePlayer = scoreToPlayerPerspective(before.score, playerColor)
  const afterPlayer = scoreToPlayerPerspective(after.score, playerColor)

  if (beforePlayer.type === 'cp' && afterPlayer.type === 'cp') {
    const lossCp = Math.max(0, beforePlayer.value - afterPlayer.value)
    return { quality: classifyCentipawnLoss(lossCp), lossCp }
  }

  return assessMateTransition(beforePlayer, afterPlayer)
}

function assessMateTransition(
  before: EvaluationScore,
  after: EvaluationScore,
): QualityResult {
  // Mate scores retain their win/loss meaning instead of being converted to a fake cp value.
  if (before.type === 'mate' && before.value > 0) {
    if (after.type === 'mate' && after.value > 0) return { quality: 'excellent', lossCp: null }
    return { quality: 'blunder', lossCp: null }
  }

  if (after.type === 'mate' && after.value < 0) {
    if (before.type === 'mate' && before.value < 0) {
      // Still lost by force: small mate-distance changes are classified conservatively.
      return { quality: Math.abs(after.value) >= Math.abs(before.value) ? 'good' : 'inaccuracy', lossCp: null }
    }
    return { quality: 'blunder', lossCp: null }
  }

  if (before.type === 'mate' && before.value < 0 && !(after.type === 'mate' && after.value < 0)) {
    return { quality: 'best', lossCp: null }
  }

  if (after.type === 'mate' && after.value > 0) return { quality: 'best', lossCp: null }
  return { quality: 'inaccuracy', lossCp: null }
}
