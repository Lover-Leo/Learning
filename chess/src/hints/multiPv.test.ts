import { describe, expect, it } from 'vitest'
import { parseInfoLine } from '../analysis/uciParsing'
import { MultiPvAccumulator } from './multiPv'

const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const info = (text: string) => parseInfoLine(text)!

describe('MultiPV 候选汇总', () => {
  it('解析并按 MultiPV 1、2、3 排序，即使信息乱序', () => {
    const acc = new MultiPvAccumulator(7, fen, 3)
    acc.add(7, fen, info('info depth 8 multipv 3 score cp 10 pv g1f3'))
    acc.add(7, fen, info('info depth 9 multipv 1 score cp 30 pv e2e4 e7e5'))
    acc.add(7, fen, info('info depth 7 multipv 2 score cp 20 pv d2d4'))
    expect(acc.result().map((line) => [line.multipv, line.bestMove])).toEqual([[1, 'e2e4'], [2, 'd2d4'], [3, 'g1f3']])
  })

  it('不同请求不会混合', () => {
    const acc = new MultiPvAccumulator(7, fen, 3)
    expect(acc.add(8, fen, info('info depth 8 multipv 1 score cp 20 pv e2e4'))).toBe(false)
    expect(acc.result()).toHaveLength(0)
  })

  it('不同 FEN 不会混合', () => {
    const acc = new MultiPvAccumulator(7, fen, 3)
    expect(acc.add(7, fen.replace(' w ', ' b '), info('info depth 8 multipv 1 score cp 20 pv e2e4'))).toBe(false)
  })

  it('同一线路只保留更深结果', () => {
    const acc = new MultiPvAccumulator(7, fen, 3)
    acc.add(7, fen, info('info depth 10 multipv 1 score cp 25 pv e2e4'))
    acc.add(7, fen, info('info depth 7 multipv 1 score cp 90 pv d2d4'))
    expect(acc.result()[0].bestMove).toBe('e2e4')
  })

  it('只有一条线路时安全降级', () => {
    const acc = new MultiPvAccumulator(7, fen, 3)
    acc.add(7, fen, info('info depth 8 multipv 1 score cp 20 pv e2e4'))
    expect(acc.result()).toHaveLength(1)
  })

  it('保留 mate 候选', () => {
    const acc = new MultiPvAccumulator(7, fen, 3)
    acc.add(7, fen, info('info depth 8 multipv 1 score mate 3 pv e2e4'))
    expect(acc.result()[0].score).toEqual({ type: 'mate', value: 3 })
  })

  it('lowerbound 和 upperbound 保持为边界值', () => {
    const acc = new MultiPvAccumulator(7, fen, 3)
    acc.add(7, fen, info('info depth 8 multipv 1 score cp 20 lowerbound pv e2e4'))
    acc.add(7, fen, info('info depth 8 multipv 2 score cp 10 upperbound pv d2d4'))
    expect(acc.result().map((line) => line.bound)).toEqual(['lower', 'upper'])
  })
})
