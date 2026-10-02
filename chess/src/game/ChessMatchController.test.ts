import { describe, expect, it } from 'vitest'
import type { Difficulty } from '../types'
import type { ChessEngine } from '../engine/types'
import { ChessMatchController } from './ChessMatchController'

interface PendingRequest {
  fen: string
  difficulty: Difficulty
  resolve: (move: string | null) => void
  reject: (error: Error) => void
}

class MockEngine implements ChessEngine {
  initializeCalls = 0
  newGameCalls = 0
  stopCalls = 0
  destroyCalls = 0
  difficulty: Difficulty = 3
  requests: PendingRequest[] = []
  initializeError: Error | null = null

  async initialize() {
    this.initializeCalls += 1
    if (this.initializeError) throw this.initializeError
  }

  async newGame() {
    this.newGameCalls += 1
  }

  setDifficulty(difficulty: Difficulty) {
    this.difficulty = difficulty
  }

  getBestMove(fen: string, difficulty: Difficulty) {
    return new Promise<string | null>((resolve, reject) => {
      this.requests.push({ fen, difficulty, resolve, reject })
    })
  }

  async stop() {
    this.stopCalls += 1
  }

  destroy() {
    this.destroyCalls += 1
  }

  reply(move: string | null, index = this.requests.length - 1) {
    this.requests[index].resolve(move)
  }
}

const settle = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

const startHumanWhite = async (engine = new MockEngine()) => {
  const controller = new ChessMatchController(engine, {
    mode: 'computer', colorChoice: 'white', difficulty: 3,
  })
  controller.start()
  await settle()
  return { controller, engine }
}

describe('ChessMatchController', () => {
  it('保留本地双人模式的正常走棋', () => {
    const controller = new ChessMatchController(new MockEngine(), { mode: 'local' })
    controller.start()
    expect(controller.playerMove('e2', 'e4').success).toBe(true)
    expect(controller.playerMove('e7', 'e5').success).toBe(true)
  })

  it('人机模式不能移动电脑一方的棋子', async () => {
    const { controller } = await startHumanWhite()
    expect(controller.playerMove('e7', 'e5').success).toBe(false)
    expect(controller.getState().snapshot.history).toHaveLength(0)
  })

  it('玩家落子后请求电脑走棋，并正确应用合法结果', async () => {
    const { controller, engine } = await startHumanWhite()
    expect(controller.playerMove('e2', 'e4').success).toBe(true)
    await settle()
    expect(engine.requests).toHaveLength(1)
    expect(engine.requests[0].difficulty).toBe(3)

    engine.reply('e7e5')
    await settle()
    expect(controller.getState().snapshot.history.map((move) => move.san)).toEqual(['e4', 'e5'])
    expect(controller.getState().engineStatus).toBe('ready')
  })

  it('正确应用电脑返回的 UCI 升变走法', async () => {
    const engine = new MockEngine()
    const controller = new ChessMatchController(
      engine,
      { mode: 'computer', colorChoice: 'black' },
      () => 0,
      '8/P7/8/8/8/8/7k/5K2 w - - 0 1',
    )
    controller.start(false)
    await settle()
    expect(engine.requests).toHaveLength(1)

    engine.reply('a7a8q')
    await settle()
    expect(controller.game.pieceAt('a8')).toMatchObject({ type: 'q', color: 'w' })
  })

  it.each(['bad-move', 'e2e5'])('引擎返回无效走法 %s 时不会崩溃', async (move) => {
    const { controller, engine } = await startHumanWhite()
    controller.playerMove('e2', 'e4')
    await settle()
    engine.reply(move)
    await settle()
    expect(controller.getState().engineStatus).toBe('error')
    expect(controller.getState().snapshot.history).toHaveLength(1)
  })

  it('玩家执黑时电脑先走', async () => {
    const engine = new MockEngine()
    const controller = new ChessMatchController(engine, { mode: 'computer', colorChoice: 'black' })
    controller.start()
    await settle()
    expect(engine.requests).toHaveLength(1)
    expect(controller.canPlayerMove()).toBe(false)

    engine.reply('e2e4')
    await settle()
    expect(controller.getState().snapshot.history[0].san).toBe('e4')
    expect(controller.canPlayerMove()).toBe(true)
  })

  it('电脑思考时玩家不能连续走棋', async () => {
    const { controller } = await startHumanWhite()
    controller.playerMove('e2', 'e4')
    expect(controller.getState().isComputerThinking).toBe(true)
    expect(controller.playerMove('d2', 'd4').success).toBe(false)
  })

  it('人机模式悔棋撤销电脑和玩家的一整回合', async () => {
    const { controller, engine } = await startHumanWhite()
    controller.playerMove('e2', 'e4')
    await settle()
    engine.reply('e7e5')
    await settle()

    await controller.undo()
    expect(controller.getState().snapshot.history).toHaveLength(0)
  })

  it('电脑思考时悔棋会忽略旧结果', async () => {
    const { controller, engine } = await startHumanWhite()
    controller.playerMove('e2', 'e4')
    await settle()
    const oldRequest = engine.requests[0]

    await controller.undo()
    oldRequest.resolve('e7e5')
    await settle()
    expect(controller.getState().snapshot.history).toHaveLength(0)
  })

  it('重新开始后旧 bestmove 不会污染新棋局', async () => {
    const { controller, engine } = await startHumanWhite()
    controller.playerMove('e2', 'e4')
    await settle()
    const oldRequest = engine.requests[0]

    controller.restart()
    await settle()
    oldRequest.resolve('e7e5')
    await settle()
    expect(controller.getState().snapshot.history).toHaveLength(0)
  })

  it('切换到本地模式后旧 bestmove 不会污染棋局', async () => {
    const { controller, engine } = await startHumanWhite()
    controller.playerMove('e2', 'e4')
    await settle()
    const oldRequest = engine.requests[0]

    controller.configure({ mode: 'local' })
    oldRequest.resolve('e7e5')
    await settle()
    expect(controller.getState().settings.mode).toBe('local')
    expect(controller.getState().snapshot.history).toHaveLength(0)
  })

  it('游戏结束后不会再次请求电脑走棋', async () => {
    const { controller, engine } = await startHumanWhite()
    controller.playerMove('f2', 'f3')
    await settle()
    engine.reply('e7e5')
    await settle()
    controller.playerMove('g2', 'g4')
    await settle()
    engine.reply('d8h4')
    await settle()

    expect(controller.getState().snapshot.isCheckmate).toBe(true)
    expect(engine.requests).toHaveLength(2)
  })

  it('引擎加载失败会显示错误，但本地双人仍可用', async () => {
    const engine = new MockEngine()
    engine.initializeError = new Error('WASM unavailable')
    const controller = new ChessMatchController(engine, { mode: 'computer' })
    controller.start()
    await settle()
    expect(controller.getState().engineStatus).toBe('error')
    expect(controller.getState().engineError).toContain('WASM unavailable')

    controller.configure({ mode: 'local' })
    expect(controller.playerMove('e2', 'e4').success).toBe(true)
  })
})
