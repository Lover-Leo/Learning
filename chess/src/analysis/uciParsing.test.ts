import { describe, expect, it } from 'vitest'
import {
  evaluationToWhitePercent,
  formatWhiteEvaluation,
  parseInfoLine,
  scoreToPlayerPerspective,
  scoreToWhitePerspective,
} from './uciParsing'
import type { PositionAnalysis } from './types'

describe('UCI 评分解析', () => {
  it('解析正数 cp、深度、PV 和首选走法', () => {
    expect(parseInfoLine('info depth 12 seldepth 18 multipv 1 score cp 35 nodes 1234 pv e2e4 e7e5')).toEqual({
      depth: 12,
      multipv: 1,
      score: { type: 'cp', value: 35 },
      bound: 'exact',
      pv: ['e2e4', 'e7e5'],
      bestMove: 'e2e4',
    })
  })

  it('解析负数 cp', () => {
    expect(parseInfoLine('info depth 8 score cp -180 pv e7e5')?.score).toEqual({ type: 'cp', value: -180 })
  })

  it('解析正数 mate', () => {
    expect(parseInfoLine('info depth 20 score mate 3 pv h5h7')?.score).toEqual({ type: 'mate', value: 3 })
  })

  it('解析负数 mate', () => {
    expect(parseInfoLine('info depth 20 score mate -2 pv g8h8')?.score).toEqual({ type: 'mate', value: -2 })
  })

  it.each([
    ['lowerbound', 'lower'],
    ['upperbound', 'upper'],
  ] as const)('识别 %s 边界而不当作精确值', (token, expected) => {
    expect(parseInfoLine(`info depth 9 score cp 80 ${token} pv e2e4`)?.bound).toBe(expected)
  })

  it.each([
    '',
    'bestmove e2e4',
    'info depth x score cp 10 pv e2e4',
    'info depth 8 score bananas 10 pv e2e4',
    'info depth 8 score cp nope pv e2e4',
  ])('忽略格式不正确的行：%s', (line) => {
    expect(parseInfoLine(line)).toBeNull()
  })
})

describe('评分视角转换', () => {
  const whiteFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  const blackFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

  it('白方行棋时保持 UCI 分数', () => {
    expect(scoreToWhitePerspective({ type: 'cp', value: 42 }, whiteFen)).toEqual({ type: 'cp', value: 42 })
  })

  it('黑方行棋时翻转为白方视角', () => {
    expect(scoreToWhitePerspective({ type: 'cp', value: 42 }, blackFen)).toEqual({ type: 'cp', value: -42 })
  })

  it('白方玩家保持白方视角', () => {
    expect(scoreToPlayerPerspective({ type: 'cp', value: 150 }, 'w').value).toBe(150)
  })

  it('黑方玩家翻转白方视角', () => {
    expect(scoreToPlayerPerspective({ type: 'cp', value: 150 }, 'b').value).toBe(-150)
  })

  it('mate 分数也按相同规则翻转且保留类型', () => {
    expect(scoreToWhitePerspective({ type: 'mate', value: 3 }, blackFen)).toEqual({ type: 'mate', value: -3 })
    expect(scoreToPlayerPerspective({ type: 'mate', value: -2 }, 'b')).toEqual({ type: 'mate', value: 2 })
  })

  it('格式化 mate 并把优势条限制在范围内', () => {
    const analysis: PositionAnalysis = {
      requestId: 1, fen: whiteFen, score: { type: 'mate', value: -2 }, depth: 10,
      bestMove: 'e2e4', pv: ['e2e4'], bound: 'exact',
    }
    expect(formatWhiteEvaluation(analysis)).toBe('黑方 M2')
    expect(evaluationToWhitePercent(analysis)).toBe(3)
  })
})
