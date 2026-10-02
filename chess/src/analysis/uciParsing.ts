import type { EvaluationScore, ParsedInfoLine, PositionAnalysis } from './types'

export function parseInfoLine(line: string): ParsedInfoLine | null {
  const tokens = line.trim().split(/\s+/)
  if (tokens[0] !== 'info') return null

  const depthIndex = tokens.indexOf('depth')
  const scoreIndex = tokens.indexOf('score')
  if (depthIndex < 0 || scoreIndex < 0) return null

  const depth = Number(tokens[depthIndex + 1])
  const scoreType = tokens[scoreIndex + 1]
  const scoreValue = Number(tokens[scoreIndex + 2])
  if (!Number.isInteger(depth) || depth < 0 || !Number.isInteger(scoreValue)) return null
  if (scoreType !== 'cp' && scoreType !== 'mate') return null

  const multipvIndex = tokens.indexOf('multipv')
  const multipv = multipvIndex >= 0 ? Number(tokens[multipvIndex + 1]) : 1
  if (!Number.isInteger(multipv) || multipv < 1) return null

  const pvIndex = tokens.indexOf('pv')
  const pv = pvIndex >= 0 ? tokens.slice(pvIndex + 1).filter(isUciMove) : []
  const bound = tokens.includes('lowerbound')
    ? 'lower'
    : tokens.includes('upperbound')
      ? 'upper'
      : 'exact'

  return {
    depth,
    multipv,
    score: { type: scoreType, value: scoreValue },
    bound,
    pv,
    bestMove: pv[0] ?? null,
  }
}

export function scoreToWhitePerspective(score: EvaluationScore, fen: string): EvaluationScore {
  const activeColor = fen.trim().split(/\s+/)[1]
  if (activeColor !== 'w' && activeColor !== 'b') throw new Error('FEN 中缺少有效的行棋方。')
  return activeColor === 'w' ? score : { ...score, value: -score.value }
}

export function scoreToPlayerPerspective(
  score: EvaluationScore,
  playerColor: 'w' | 'b',
): EvaluationScore {
  return playerColor === 'w' ? score : { ...score, value: -score.value }
}

export function formatWhiteEvaluation(analysis: PositionAnalysis | null): string {
  if (!analysis) return '暂无评分'
  const { score } = analysis
  const provisional = analysis.bound === 'exact' ? '' : '≈'
  if (score.type === 'mate') {
    return `${provisional}${score.value >= 0 ? '白方' : '黑方'} M${Math.abs(score.value)}`
  }
  if (Math.abs(score.value) < 5) return `${provisional}均势`
  return `${provisional}${score.value >= 0 ? '+' : ''}${(score.value / 100).toFixed(2)}`
}

export function evaluationToWhitePercent(analysis: PositionAnalysis | null): number {
  if (!analysis) return 50
  if (analysis.score.type === 'mate') return analysis.score.value >= 0 ? 97 : 3
  const percentage = 50 + 47 * Math.tanh(analysis.score.value / 450)
  return Math.min(97, Math.max(3, percentage))
}

export function isUciMove(value: string): boolean {
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(value)
}
