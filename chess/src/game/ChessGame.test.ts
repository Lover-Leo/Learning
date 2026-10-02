import { describe, expect, it } from 'vitest'
import type { Square } from 'chess.js'
import { ChessGame } from './ChessGame'

const playMoves = (game: ChessGame, moves: Array<[Square, Square]>) => {
  moves.forEach(([from, to]) => expect(game.move(from, to).success).toBe(true))
}

describe('ChessGame', () => {
  it('接受普通合法走子', () => {
    const game = new ChessGame()
    expect(game.move('e2', 'e4').success).toBe(true)
    expect(game.pieceAt('e4')).toMatchObject({ type: 'p', color: 'w' })
    expect(game.snapshot().history[0].san).toBe('e4')
  })

  it('拒绝非法走子且不改变棋局', () => {
    const game = new ChessGame()
    const before = game.snapshot().fen
    expect(game.move('e2', 'e5').success).toBe(false)
    expect(game.snapshot().fen).toBe(before)
  })

  it('正确执行王车易位', () => {
    const game = new ChessGame()
    playMoves(game, [
      ['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6'],
      ['f1', 'c4'], ['g8', 'f6'], ['e1', 'g1'],
    ])

    expect(game.pieceAt('g1')?.type).toBe('k')
    expect(game.pieceAt('f1')?.type).toBe('r')
    expect(game.snapshot().history.at(-1)?.san).toBe('O-O')
  })

  it('正确执行吃过路兵', () => {
    const game = new ChessGame()
    playMoves(game, [
      ['e2', 'e4'], ['a7', 'a6'], ['e4', 'e5'], ['d7', 'd5'], ['e5', 'd6'],
    ])

    expect(game.pieceAt('d6')).toMatchObject({ type: 'p', color: 'w' })
    expect(game.pieceAt('d5')).toBeUndefined()
    expect(game.snapshot().history.at(-1)?.san).toBe('exd6')
  })

  it('要求玩家选择并执行兵升变', () => {
    const game = new ChessGame('8/P7/8/8/8/8/7k/5K2 w - - 0 1')
    const pending = game.move('a7', 'a8')

    expect(pending).toEqual({
      success: false,
      needsPromotion: true,
      options: ['q', 'r', 'b', 'n'],
    })
    expect(game.pieceAt('a7')?.type).toBe('p')
    expect(game.move('a7', 'a8', 'n').success).toBe(true)
    expect(game.pieceAt('a8')?.type).toBe('n')
  })

  it('识别将死', () => {
    const game = new ChessGame()
    playMoves(game, [
      ['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4'],
    ])

    expect(game.snapshot()).toMatchObject({ isCheck: true, isCheckmate: true, isGameOver: true })
    expect(game.move('e2', 'e4').success).toBe(false)
  })

  it('识别逼和', () => {
    const game = new ChessGame('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')
    expect(game.snapshot()).toMatchObject({
      isStalemate: true,
      isDraw: true,
      isGameOver: true,
      drawReason: '逼和（无合法走法）',
    })
  })

  it('悔棋后恢复此前状态', () => {
    const game = new ChessGame()
    const initialFen = game.snapshot().fen
    game.move('e2', 'e4')

    expect(game.undo()).toBe(true)
    expect(game.snapshot().fen).toBe(initialFen)
    expect(game.snapshot().history).toHaveLength(0)
  })
})
