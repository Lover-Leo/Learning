import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import type { AnalysisEngine, AnalysisRequest, MultiPvRequest, MultiPvResult, PositionAnalysis } from '../analysis/types'
import type { ChessEngine } from '../engine/types'
import type { Difficulty } from '../types'
import { ChessMatchController } from '../game/ChessMatchController'

class QuietPlayEngine implements ChessEngine {
  requests: Array<{ resolve: (move: string | null) => void }> = []
  async initialize() {}
  async newGame() {}
  setDifficulty(_difficulty: Difficulty) {}
  getBestMove() { return new Promise<string | null>((resolve) => this.requests.push({ resolve })) }
  async stop() {}
  destroy() {}
}

const toUci = (move: { from: string; to: string; promotion?: string }) => `${move.from}${move.to}${move.promotion ?? ''}`

class HintAnalysisEngine implements AnalysisEngine {
  deferHints = false
  hintError: Error | null = null
  pending: Array<{ request: MultiPvRequest; resolve: (result: MultiPvResult) => void }> = []
  hintCalls = 0
  stopCalls = 0
  async initialize() {}
  async analyze(request: AnalysisRequest): Promise<PositionAnalysis> {
    const chess = new Chess(request.fen)
    const move = chess.moves({ verbose: true })[0]
    const result = {
      requestId: request.requestId,
      fen: request.fen,
      score: { type: 'cp' as const, value: request.fen.includes(' b ') ? -20 : 20 },
      depth: 11,
      bestMove: move ? toUci(move) : null,
      pv: move ? [toUci(move)] : [],
      bound: 'exact' as const,
    }
    request.onUpdate?.(result)
    return result
  }
  analyzeMultiPv(request: MultiPvRequest): Promise<MultiPvResult> {
    this.hintCalls += 1
    if (this.hintError) return Promise.reject(this.hintError)
    if (this.deferHints) return new Promise((resolve) => this.pending.push({ request, resolve }))
    return Promise.resolve(this.result(request))
  }
  result(request: MultiPvRequest): MultiPvResult {
    const chess = new Chess(request.fen)
    const moves = chess.moves({ verbose: true }).slice(0, 3)
    return {
      requestId: request.requestId,
      fen: request.fen,
      lines: moves.map((move, index) => ({
        requestId: request.requestId,
        fen: request.fen,
        multipv: index + 1,
        score: { type: 'cp', value: 30 - index * 10 },
        depth: 10,
        bestMove: toUci(move),
        pv: [toUci(move)],
        bound: 'exact',
      })),
    }
  }
  resolvePending(index = 0) {
    const item = this.pending[index]
    item.resolve(this.result(item.request))
  }
  async stop() { this.stopCalls += 1 }
  destroy() {}
}

const settle = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

async function setup(deferHints = false) {
  const play = new QuietPlayEngine()
  const analysis = new HintAnalysisEngine()
  analysis.deferHints = deferHints
  const controller = new ChessMatchController(
    play,
    { mode: 'computer', colorChoice: 'white', analysisEnabled: true },
    Math.random,
    undefined,
    analysis,
  )
  controller.start()
  await settle()
  return { controller, play, analysis }
}

describe('三级按需提示控制', () => {
  it('玩家回合且分析引擎就绪时可以请求提示', async () => {
    const { controller } = await setup()
    expect(controller.canRequestHint()).toBe(true)
  })

  it('本地双人、电脑回合和引擎未就绪时不能请求', async () => {
    const local = new ChessMatchController(new QuietPlayEngine(), { mode: 'local' }, Math.random, undefined, new HintAnalysisEngine())
    local.start()
    expect(local.canRequestHint()).toBe(false)

    const { controller } = await setup()
    controller.playerMove('e2', 'e4')
    expect(controller.canRequestHint()).toBe(false)
  })

  it('游戏结束后不能请求提示', async () => {
    const controller = new ChessMatchController(
      new QuietPlayEngine(),
      { mode: 'computer', colorChoice: 'black', analysisEnabled: true },
      Math.random,
      '7k/7Q/7K/8/8/8/8/8 b - - 0 1',
      new HintAnalysisEngine(),
    )
    controller.start(false)
    await settle()
    expect(controller.getState().snapshot.isGameOver).toBe(true)
    expect(controller.canRequestHint()).toBe(false)
  })

  it('升变选择期间由调用方禁用提示', async () => {
    const { controller } = await setup()
    expect(controller.canRequestHint(true)).toBe(false)
  })

  it('第一级只提供思考方向，第二级增加真实关键棋子且没有完整答案层级', async () => {
    const { controller } = await setup()
    controller.requestNextHint()
    await settle()
    let hint = controller.getState().hint!
    expect(hint.level).toBe(1)
    expect(hint.direction).toBeTruthy()
    expect(hint.keySquare).toMatch(/^[a-h][1-8]$/)

    controller.requestNextHint()
    hint = controller.getState().hint!
    expect(hint.level).toBe(2)
    expect(hint.keyPieceText).toContain(hint.keySquare!)
  })

  it('第三级展示合法候选并允许切换预览', async () => {
    const { controller } = await setup()
    controller.requestNextHint()
    await settle()
    controller.requestNextHint()
    controller.requestNextHint()
    expect(controller.getState().hint?.level).toBe(3)
    expect(controller.getState().hint?.candidates).toHaveLength(3)
    controller.selectHintCandidate(1)
    expect(controller.getState().hint?.selectedCandidate).toBe(1)
  })

  it('提示等级只能逐步增加且最高等级被记录', async () => {
    const { controller } = await setup()
    controller.requestNextHint()
    await settle()
    controller.requestNextHint()
    controller.requestNextHint()
    controller.requestNextHint()
    const best = controller.getState().hint!.candidates[0].uci
    const from = best.slice(0, 2) as 'a2'
    const to = best.slice(2, 4) as 'a3'
    expect(controller.playerMove(from, to).success).toBe(true)
    expect(controller.getState().hintRecords[1].maxLevel).toBe(3)
    expect(controller.getState().hintRecords[1].matchedBest).toBe(true)
  })

  it('玩家走棋后清除提示，并同时保留提示标记和客观质量分析', async () => {
    const { controller } = await setup()
    controller.requestNextHint()
    await settle()
    const best = controller.getState().hint!.candidates[0].uci
    controller.playerMove(best.slice(0, 2) as 'a2', best.slice(2, 4) as 'a3')
    expect(controller.getState().hint).toBeNull()
    expect(controller.getState().hintRecords[1].requested).toBe(true)
    await settle()
    expect(controller.getState().moveAssessments[1]).toBeDefined()
  })

  it('提示生成中玩家走棋时忽略迟到结果', async () => {
    const { controller, analysis } = await setup(true)
    controller.requestNextHint()
    await settle()
    controller.playerMove('e2', 'e4')
    analysis.resolvePending()
    await settle()
    expect(controller.getState().hint).toBeNull()
  })

  it('悔棋会忽略仍在生成的旧提示', async () => {
    const { controller, analysis } = await setup(true)
    controller.requestNextHint()
    await settle()
    await controller.undo()
    analysis.resolvePending()
    await settle()
    expect(controller.getState().hint).toBeNull()
  })

  it('新玩家局面的提示重新从第一级开始', async () => {
    const { controller, play } = await setup()
    controller.requestNextHint()
    await settle()
    controller.requestNextHint()
    controller.requestNextHint()
    const move = controller.getState().hint!.candidates[0].uci
    controller.playerMove(move.slice(0, 2) as 'a2', move.slice(2, 4) as 'a3')
    await settle()
    play.requests[0].resolve('e7e5')
    await settle()
    controller.requestNextHint()
    await settle()
    expect(controller.getState().hint?.level).toBe(1)
  })

  it('提示分析失败时显示错误但仍可正常下棋和重试', async () => {
    const { controller, analysis } = await setup()
    analysis.hintError = new Error('MultiPV unavailable')
    controller.requestNextHint()
    await settle()
    expect(controller.getState().hint?.status).toBe('error')
    expect(controller.getState().hint?.error).toContain('MultiPV unavailable')
    expect(controller.playerMove('e2', 'e4').success).toBe(true)
  })

  it('取消、悔棋、重新开始和切换模式都会使旧提示失效', async () => {
    const { controller, analysis } = await setup(true)
    controller.requestNextHint()
    await settle()
    controller.cancelHint()
    analysis.resolvePending()
    await settle()
    expect(controller.getState().hint).toBeNull()

    controller.requestNextHint()
    await settle()
    controller.restart()
    analysis.resolvePending(1)
    await settle()
    expect(controller.getState().hint).toBeNull()

    await settle()
    controller.requestNextHint()
    await settle()
    controller.configure({ mode: 'local' })
    analysis.resolvePending(2)
    await settle()
    expect(controller.getState().hint).toBeNull()
  })

  it('提示任务不会被当作电脑走棋，也会恢复实时评分', async () => {
    const { controller, play, analysis } = await setup()
    controller.requestNextHint()
    await settle()
    expect(analysis.hintCalls).toBe(1)
    expect(play.requests).toHaveLength(0)
    await settle()
    expect(controller.getState().currentAnalysis).not.toBeNull()
  })
})
