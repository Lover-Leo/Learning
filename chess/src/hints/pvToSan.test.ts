import { describe, expect, it } from 'vitest'
import { convertUciLineToSan } from './pvToSan'

describe('UCI 线路转 SAN', () => {
  it('转换普通走法且不修改来源局面', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const result = convertUciLineToSan(fen, ['e2e4', 'e7e5'])
    expect(result.sanMoves).toEqual(['e4', 'e5'])
    expect(result.finalFen).not.toBe(fen)
  })

  it('转换吃子', () => {
    const result = convertUciLineToSan('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', ['e4d5'])
    expect(result.sanMoves).toEqual(['exd5'])
    expect(result.firstMove?.captured).toBe('p')
  })

  it('转换将军', () => {
    expect(convertUciLineToSan('4k3/8/8/8/8/8/4R3/4K3 w - - 0 1', ['e2e7']).sanMoves[0]).toBe('Re7+')
  })

  it('转换将死', () => {
    expect(convertUciLineToSan('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1', ['f7g7']).sanMoves[0]).toBe('Qg7#')
  })

  it('转换王车易位', () => {
    expect(convertUciLineToSan('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', ['e1g1']).sanMoves[0]).toBe('O-O')
  })

  it('转换升变', () => {
    expect(convertUciLineToSan('7k/P7/8/8/8/8/8/7K w - - 0 1', ['a7a8q']).sanMoves[0]).toContain('a8=Q')
  })

  it('转换吃过路兵', () => {
    const result = convertUciLineToSan('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2', ['e5d6'])
    expect(result.sanMoves).toEqual(['exd6'])
    expect(result.firstMove?.captured).toBe('p')
  })

  it('非法 PV 安全停止并保留已转换部分', () => {
    const result = convertUciLineToSan('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ['e2e4', 'bad'])
    expect(result.sanMoves).toEqual(['e4'])
    expect(result.complete).toBe(false)
  })
})
