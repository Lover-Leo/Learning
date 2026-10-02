import { describe, expect, it } from 'vitest'
import { assessMoveQuality, classifyCentipawnLoss } from './moveQuality'
import type { EvaluationScore, PositionAnalysis } from './types'

const analysis = (
  score: EvaluationScore,
  bestMove = 'e2e4',
): PositionAnalysis => ({
  requestId: 1,
  fen: '8/8/8/8/8/8/8/8 w - - 0 1',
  score,
  depth: 11,
  bestMove,
  pv: bestMove ? [bestMove] : [],
  bound: 'exact',
})

describe('走子质量分类', () => {
  it.each([
    [0, 'best'], [20, 'best'], [21, 'excellent'], [50, 'excellent'],
    [80, 'good'], [150, 'inaccuracy'], [300, 'mistake'], [401, 'blunder'],
  ] as const)('%i cp 损失分类为 %s', (loss, quality) => {
    expect(classifyCentipawnLoss(loss)).toBe(quality)
  })

  it('实际走法等于首选走法时判为最佳', () => {
    expect(assessMoveQuality(analysis({ type: 'cp', value: 0 }), analysis({ type: 'cp', value: -90 }), 'w', 'e2e4')).toEqual({
      quality: 'best', lossCp: 0,
    })
  })

  it('评分损失最低为 0', () => {
    expect(assessMoveQuality(analysis({ type: 'cp', value: 0 }), analysis({ type: 'cp', value: 100 }), 'w', 'd2d4').lossCp).toBe(0)
  })

  it('黑方玩家使用相反方向计算损失', () => {
    const result = assessMoveQuality(
      analysis({ type: 'cp', value: 100 }),
      analysis({ type: 'cp', value: 200 }),
      'b',
      'e7e5',
    )
    expect(result).toEqual({ quality: 'good', lossCp: 100 })
  })

  it('错过自己的强制将杀判为严重失误', () => {
    expect(assessMoveQuality(
      analysis({ type: 'mate', value: 3 }), analysis({ type: 'cp', value: 500 }), 'w', 'd2d4',
    ).quality).toBe('blunder')
  })

  it('让对手获得强制将杀判为严重失误', () => {
    expect(assessMoveQuality(
      analysis({ type: 'cp', value: 0 }), analysis({ type: 'mate', value: -2 }), 'w', 'f2f3',
    ).quality).toBe('blunder')
  })

  it('从必败将杀中逃脱不会判为严重失误', () => {
    expect(assessMoveQuality(
      analysis({ type: 'mate', value: -2 }), analysis({ type: 'cp', value: -500 }), 'w', 'g1f3',
    ).quality).toBe('best')
  })

  it('仍处于同方向将杀时保守处理步数变化', () => {
    expect(assessMoveQuality(
      analysis({ type: 'mate', value: -3 }), analysis({ type: 'mate', value: -4 }), 'w', 'g1h1',
    ).quality).toBe('good')
  })
})
