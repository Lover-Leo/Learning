import { Chess, type PieceSymbol, type Square } from 'chess.js'
import type { EvaluationScore } from '../analysis/types'
import { convertUciLineToSan } from './pvToSan'

const PIECES: Record<PieceSymbol, string> = {
  p: '兵', n: '马', b: '象', r: '车', q: '后', k: '王',
}
const CENTER = new Set(['d4', 'e4', 'd5', 'e5'])
const STARTING_MINOR = new Set(['b1', 'g1', 'c1', 'f1', 'b8', 'g8', 'c8', 'f8'])

export interface TeachingText {
  direction: string
  keySquare: Square
  keyPieceText: string
  explanation: string
}

export function generateTeachingText(
  fen: string,
  uci: string,
  san: string,
  score: EvaluationScore,
  pvSan: string[],
): TeachingText | null {
  const conversion = convertUciLineToSan(fen, [uci])
  const first = conversion.firstMove
  if (!first) return null
  const before = new Chess(fen)
  const piece = before.get(first.from)
  if (!piece) return null

  const facts: string[] = []
  let direction = '先比较所有将军、吃子和直接威胁，再考虑改善最差位置的棋子。'

  if (san.endsWith('#')) {
    direction = '先寻找能够直接将军并结束棋局的走法。'
    facts.push('这步棋形成将死，对方已经没有合法应对。')
  } else if (san.includes('+')) {
    direction = '先寻找能够将军的走法，并检查对方有哪些合法应对。'
    facts.push('这步棋会将军，迫使对方先处理王的安全。')
  }
  if (first.captured) {
    if (!san.includes('+') && !san.endsWith('#')) direction = '检查是否可以安全吃子，并比较交换后的子力得失。'
    facts.push(`这步棋吃掉对方的${PIECES[first.captured as PieceSymbol]}。`)
  }
  if (first.flags.includes('k') || first.flags.includes('q')) {
    direction = '考虑用王车易位改善王的安全。'
    facts.push('这是王车易位：王移向更安全的位置，同时让车投入棋局。')
  }
  if (first.promotion) {
    direction = '寻找兵升变的机会。'
    facts.push(`这个兵到达底线并升变为${PIECES[first.promotion as PieceSymbol]}。`)
  }
  if (CENTER.has(first.to) && piece.type !== 'k') {
    if (facts.length === 0) direction = '关注中心的冲突，并比较哪些棋子能进入中心。'
    facts.push(`这步把${PIECES[piece.type]}移到中心格。`)
  }
  if (STARTING_MINOR.has(first.from) && (piece.type === 'n' || piece.type === 'b')) {
    if (facts.length === 0) direction = '考虑完成出子，让后排的马和象参加战斗。'
    facts.push(`这步让原来在后排的${PIECES[piece.type]}完成出子。`)
  }

  if (facts.length === 0) {
    const scoreText = score.type === 'mate'
      ? '保留了强制将杀的机会'
      : '保持了当前分析深度下较好的局面评价'
    facts.push(`这是引擎在当前分析深度下评分最高的走法，它${scoreText}。`)
  }
  if (pvSan.length > 1) facts.push(`可参考的后续变化是：${pvSan.slice(0, 5).join(' ')}。`)

  return {
    direction,
    keySquare: first.from,
    keyPieceText: `重点观察你在 ${first.from} 的${PIECES[piece.type]}。它可能承担当前局面中最直接的任务。`,
    explanation: facts.slice(0, 3).join(''),
  }
}
