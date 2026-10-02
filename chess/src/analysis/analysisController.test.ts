import { describe, expect, it } from 'vitest'
import type { Difficulty } from '../types'
import type { ChessEngine } from '../engine/types'
import type { AnalysisEngine, AnalysisRequest, EvaluationScore, PositionAnalysis } from './types'
import { ChessMatchController } from '../game/ChessMatchController'

class MockPlayEngine implements ChessEngine {
  requests: Array<{ resolve: (move: string | null) => void }> = []
  async initialize() {}
  async newGame() {}
  setDifficulty(_difficulty: Difficulty) {}
  getBestMove() {
    return new Promise<string | null>((resolve) => this.requests.push({ resolve }))
  }
  async stop() {}
  destroy() {}
}

interface PendingAnalysis {
  request: AnalysisRequest
  resolve: (result: PositionAnalysis) => void
  reject: (error: Error) => void
}

class MockAnalysisEngine implements AnalysisEngine {
  requests: PendingAnalysis[] = []
  initializeError: Error | null = null
  stopCalls = 0
  destroyCalls = 0

  async initialize() {
    if (this.initializeError) throw this.initializeError
  }

  analyze(request: AnalysisRequest) {
    return new Promise<PositionAnalysis>((resolve, reject) => {
      this.requests.push({ request, resolve, reject })
    })
  }

  async stop() { this.stopCalls += 1 }
  destroy() { this.destroyCalls += 1 }

  reply(index: number, score: EvaluationScore, bestMove = 'e2e4', depth = 11) {
    const pending = this.requests[index]
    pending.resolve({
      requestId: pending.request.requestId,
      fen: pending.request.fen,
      score,
      depth,
      bestMove,
      pv: bestMove ? [bestMove] : [],
      bound: 'exact',
    })
  }
}

const settle = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

const start = async (colorChoice: 'white' | 'black' = 'white') => {
  const play = new MockPlayEngine()
  const analysis = new MockAnalysisEngine()
  const controller = new ChessMatchController(
    play,
    { mode: 'computer', colorChoice, analysisEnabled: true },
    () => 0,
    undefined,
    analysis,
  )
  controller.start()
  await settle()
  return { controller, play, analysis }
}

describe('实时分析异步状态', () => {
  it('玩家走子后关联质量标签和引擎首选走法', async () => {
    const { controller, analysis } = await start()
    analysis.reply(0, { type: 'cp', value: 25 }, 'e2e4')
    await settle()

    controller.playerMove('e2', 'e4')
    await settle()
    expect(analysis.requests).toHaveLength(2)
    analysis.reply(1, { type: 'cp', value: 18 }, 'e7e5')
    await settle()

    expect(controller.getState().moveAssessments[1]).toMatchObject({
      actualMove: 'e2e4', bestMove: 'e2e4', quality: 'best', lossCp: 0,
    })
  })

  it('旧局面结果不会覆盖快速变化后的局面', async () => {
    const { controller, analysis } = await start()
    const initialFen = analysis.requests[0].request.fen
    controller.playerMove('e2', 'e4')
    analysis.reply(0, { type: 'cp', value: 10 })
    await settle()

    expect(controller.getState().snapshot.fen).not.toBe(initialFen)
    expect(controller.getState().currentAnalysis).toBeNull()
  })

  it('悔棋后迟到的分析不会添加错误标签', async () => {
    const { controller, analysis } = await start()
    analysis.reply(0, { type: 'cp', value: 0 })
    await settle()
    controller.playerMove('e2', 'e4')
    await settle()
    const old = analysis.requests[1]

    await controller.undo()
    old.resolve({
      requestId: old.request.requestId, fen: old.request.fen, score: { type: 'cp', value: -20 },
      depth: 11, bestMove: 'e7e5', pv: ['e7e5'], bound: 'exact',
    })
    await settle()
    expect(controller.getState().moveAssessments).toEqual({})
  })

  it('重新开始后忽略旧分析', async () => {
    const { controller, analysis } = await start()
    const old = analysis.requests[0]
    controller.restart()
    old.resolve({
      requestId: old.request.requestId, fen: old.request.fen, score: { type: 'cp', value: 80 },
      depth: 11, bestMove: 'e2e4', pv: ['e2e4'], bound: 'exact',
    })
    await settle()
    expect(controller.getState().currentAnalysis).toBeNull()
    expect(controller.getState().moveAssessments).toEqual({})
  })

  it('切换本地模式后忽略旧分析', async () => {
    const { controller, analysis } = await start()
    const old = analysis.requests[0]
    controller.configure({ mode: 'local' })
    old.resolve({
      requestId: old.request.requestId, fen: old.request.fen, score: { type: 'cp', value: 80 },
      depth: 11, bestMove: 'e2e4', pv: ['e2e4'], bound: 'exact',
    })
    await settle()
    expect(controller.getState().analysisStatus).toBe('off')
    expect(controller.getState().currentAnalysis).toBeNull()
    expect(controller.playerMove('e2', 'e4').success).toBe(true)
  })

  it('关闭分析后停止更新并释放分析引擎', async () => {
    const { controller, analysis } = await start()
    const old = analysis.requests[0]
    controller.setAnalysisEnabled(false)
    old.resolve({
      requestId: old.request.requestId, fen: old.request.fen, score: { type: 'cp', value: 10 },
      depth: 11, bestMove: 'e2e4', pv: ['e2e4'], bound: 'exact',
    })
    await settle()
    expect(controller.getState().analysisStatus).toBe('paused')
    expect(controller.getState().currentAnalysis).toBeNull()
    expect(analysis.destroyCalls).toBeGreaterThan(0)
  })

  it('分析失败不影响玩家正常走棋', async () => {
    const { controller, analysis } = await start()
    analysis.requests[0].reject(new Error('analysis worker failed'))
    await settle()
    expect(controller.getState().analysisStatus).toBe('error')
    expect(controller.playerMove('e2', 'e4').success).toBe(true)
  })

  it('玩家执黑时按黑方视角计算质量', async () => {
    const { controller, play, analysis } = await start('black')
    analysis.reply(0, { type: 'cp', value: 0 }, 'e2e4')
    play.requests[0].resolve('e2e4')
    await settle()

    expect(analysis.requests).toHaveLength(2)
    analysis.reply(1, { type: 'cp', value: 100 }, 'c7c5')
    await settle()
    expect(controller.playerMove('e7', 'e5').success).toBe(true)
    await settle()

    expect(analysis.requests).toHaveLength(3)
    analysis.reply(2, { type: 'cp', value: 200 }, 'g1f3')
    await settle()
    expect(controller.getState().moveAssessments[2]).toMatchObject({
      playerColor: 'b', quality: 'good', lossCp: 100,
    })
  })

  it('对弈引擎结果不会被记录成玩家分析标签', async () => {
    const { controller, play, analysis } = await start('black')
    analysis.reply(0, { type: 'cp', value: 0 })
    play.requests[0].resolve('e2e4')
    await settle()
    expect(controller.getState().moveAssessments).toEqual({})
  })
})
