import type { Color, Square } from 'chess.js'
import type { ChessEngine } from '../engine/types'
import type {
  AnalysisEngine,
  MoveAssessment,
  PendingMoveAssessment,
  PositionAnalysis,
} from '../analysis/types'
import { assessMoveQuality } from '../analysis/moveQuality'
import type { MultiPvResult } from '../analysis/types'
import type { HintCandidate, HintLevel, HintUsageRecord } from '../hints/types'
import { convertUciLineToSan } from '../hints/pvToSan'
import { generateTeachingText } from '../hints/explanation'
import type {
  Difficulty,
  GameSettings,
  MatchState,
  MoveResult,
  PromotionPiece,
} from '../types'
import { ChessGame } from './ChessGame'

const DEFAULT_SETTINGS: GameSettings = {
  mode: 'local',
  colorChoice: 'white',
  difficulty: 3,
  analysisEnabled: true,
}

const invalidMoveResult: MoveResult = { success: false, needsPromotion: false }

export class ChessMatchController {
  readonly game: ChessGame
  private state: MatchState
  private listeners = new Set<() => void>()
  private revision = 0
  private engineReady = false
  private initialization: Promise<void> | null = null
  private destroyed = false
  private analysisRevision = 0
  private analysisReady = false
  private analysisInitialization: Promise<void> | null = null
  private analysisRequestId = 0
  private analysisBusy = false
  private analysisTaskToken = 0
  private assessmentQueue: PendingMoveAssessment[] = []
  private desiredAnalysisFen: string | null = null
  private analysisCache = new Map<string, PositionAnalysis>()
  private activeAssessment: PendingMoveAssessment | null = null
  private hintRequestId = 0
  private hintOrder = 0
  private pendingHintUsage: HintUsageRecord | null = null
  private hintCache = new Map<string, HintCandidate[]>()

  constructor(
    private readonly engine: ChessEngine,
    initialSettings: Partial<GameSettings> = {},
    private readonly random: () => number = Math.random,
    initialFen?: string,
    private readonly analysisEngine?: AnalysisEngine,
  ) {
    this.game = new ChessGame(initialFen)
    const settings = { ...DEFAULT_SETTINGS, ...initialSettings }
    this.state = {
      snapshot: this.game.snapshot(),
      settings,
      playerColor: this.resolvePlayerColor(settings.colorChoice),
      engineStatus: 'idle',
      engineError: null,
      isComputerThinking: false,
      analysisStatus: 'off',
      currentAnalysis: null,
      analysisError: null,
      moveAssessments: {},
      hint: null,
      hintRecords: {},
    }
  }

  getState = (): MatchState => this.state

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(reset = true): void {
    this.destroyed = false
    this.beginNewGame(reset)
  }

  configure(settings: Partial<GameSettings>): void {
    this.state = { ...this.state, settings: { ...this.state.settings, ...settings } }
    this.beginNewGame(true)
  }

  restart(): void {
    this.beginNewGame(true)
  }

  playerMove(from: Square, to: Square, promotion?: PromotionPiece): MoveResult {
    if (this.state.settings.mode === 'computer' && !this.canPlayerMove()) {
      return invalidMoveResult
    }

    const before = this.game.snapshot()
    const hintUsage = this.pendingHintUsage
    const hintedCandidates = this.state.hint?.candidates ?? []
    const result = this.game.move(from, to, promotion)
    if (!result.success) return result

    const actualMove = `${from}${to}${promotion ?? ''}`
    this.invalidateHint(false)

    this.updateFromGame()
    if (hintUsage) {
      const candidateMoves = hintedCandidates.map((candidate) => candidate.uci)
      const completed: HintUsageRecord = {
        ...hintUsage,
        ply: this.state.snapshot.history.length,
        actualMove,
        bestMove: candidateMoves[0] ?? null,
        matchedBest: candidateMoves[0] ? candidateMoves[0] === actualMove : null,
        inTopThree: candidateMoves.length ? candidateMoves.includes(actualMove) : null,
      }
      this.state = {
        ...this.state,
        hintRecords: { ...this.state.hintRecords, [completed.ply]: completed },
      }
      this.pendingHintUsage = null
      this.emit()
    }
    if (this.isAnalysisActive()) {
      const lastMove = this.state.snapshot.history.at(-1)!
      this.assessmentQueue.push({
        gameRevision: this.revision,
        ply: this.state.snapshot.history.length,
        san: lastMove.san,
        actualMove,
        playerColor: this.state.playerColor,
        beforeFen: before.fen,
        afterFen: this.state.snapshot.fen,
      })
      this.desiredAnalysisFen = this.state.snapshot.fen
      this.pumpAnalysis()
    }
    if (this.state.settings.mode === 'computer' && !this.state.snapshot.isGameOver) {
      void this.requestComputerMove(this.revision)
    }
    return result
  }

  async undo(): Promise<void> {
    const revision = ++this.revision
    const wasThinking = this.state.isComputerThinking
    const stopped = this.engine.stop().catch(() => undefined)
    this.invalidateAnalysis(false)
    this.state = {
      ...this.state,
      isComputerThinking: false,
      engineStatus: this.engineReady ? 'ready' : 'idle',
      engineError: null,
    }

    if (this.state.settings.mode === 'local') {
      this.game.undo()
    } else if (wasThinking) {
      this.game.undo()
    } else {
      this.game.undo()
      if (this.game.snapshot().history.length > 0 && this.game.snapshot().turn !== this.state.playerColor) {
        this.game.undo()
      }
    }
    this.updateFromGame()
    this.trimAssessments()
    this.trimHintRecords()
    this.scheduleCurrentAnalysis()

    await stopped
    if (this.isCurrentComputerTurn(revision)) void this.requestComputerMove(revision)
  }

  retryEngine(): void {
    this.engine.destroy()
    this.engineReady = false
    this.initialization = null
    const revision = ++this.revision
    this.state = { ...this.state, engineStatus: 'loading', engineError: null, isComputerThinking: false }
    this.emit()
    void this.prepareComputerGame(revision, Promise.resolve())
  }

  setAnalysisEnabled(enabled: boolean): void {
    if (this.state.settings.analysisEnabled === enabled) return
    this.state = {
      ...this.state,
      settings: { ...this.state.settings, analysisEnabled: enabled },
    }
    if (!enabled) {
      this.invalidateHint(false)
      this.pendingHintUsage = null
      this.invalidateAnalysis(true)
      this.state = {
        ...this.state,
        analysisStatus: 'paused',
        currentAnalysis: null,
        analysisError: null,
      }
      this.emit()
      return
    }

    this.state = { ...this.state, analysisStatus: 'loading', analysisError: null }
    this.emit()
    if (this.state.settings.mode === 'computer') void this.prepareAnalysis(this.analysisRevision)
  }

  retryAnalysis(): void {
    if (!this.analysisEngine || !this.isAnalysisActive()) return
    this.invalidateHint(false)
    this.pendingHintUsage = null
    this.analysisEngine.destroy()
    this.analysisReady = false
    this.analysisInitialization = null
    const revision = ++this.analysisRevision
    this.state = { ...this.state, analysisStatus: 'loading', analysisError: null }
    this.emit()
    void this.prepareAnalysis(revision)
  }

  canRequestHint(promotionPending = false): boolean {
    return !promotionPending
      && Boolean(this.analysisEngine?.analyzeMultiPv)
      && this.analysisReady
      && this.state.settings.mode === 'computer'
      && this.state.settings.analysisEnabled
      && !this.state.snapshot.isGameOver
      && !this.state.isComputerThinking
      && this.state.engineStatus === 'ready'
      && this.state.snapshot.turn === this.state.playerColor
      && this.state.analysisStatus !== 'loading'
      && this.state.analysisStatus !== 'error'
  }

  requestNextHint(): void {
    if (!this.canRequestHint()) return
    const current = this.state.hint
    if (current?.fen === this.state.snapshot.fen && current.status === 'ready') {
      const nextLevel = Math.min(3, current.level + 1) as HintLevel
      if (nextLevel === current.level) return
      this.state = { ...this.state, hint: { ...current, level: nextLevel } }
      if (this.pendingHintUsage) this.pendingHintUsage.maxLevel = nextLevel as 1 | 2 | 3
      this.emit()
      return
    }
    if (current?.status === 'loading') return
    void this.loadHint()
  }

  cancelHint(): void {
    if (!this.state.hint) return
    this.invalidateHint(true)
    this.scheduleCurrentAnalysis()
  }

  selectHintCandidate(index: number): void {
    const hint = this.state.hint
    if (!hint || hint.level < 3 || !hint.candidates[index]) return
    this.state = { ...this.state, hint: { ...hint, selectedCandidate: index } }
    this.emit()
  }

  canPlayerMove(): boolean {
    if (this.state.snapshot.isGameOver) return false
    if (this.state.settings.mode === 'local') return true
    return this.state.engineStatus === 'ready'
      && !this.state.isComputerThinking
      && this.state.snapshot.turn === this.state.playerColor
  }

  destroy(): void {
    this.destroyed = true
    this.revision += 1
    this.engine.destroy()
    this.analysisEngine?.destroy()
    this.listeners.clear()
  }

  private beginNewGame(reset: boolean): void {
    const revision = ++this.revision
    const stopped = this.engine.stop().catch(() => undefined)
    if (reset) this.game.reset()
    this.invalidateHint(false)
    this.pendingHintUsage = null
    this.invalidateAnalysis(this.state.settings.mode !== 'computer' || !this.state.settings.analysisEnabled)

    const playerColor = this.resolvePlayerColor(this.state.settings.colorChoice)
    this.state = {
      ...this.state,
      snapshot: this.game.snapshot(),
      playerColor,
      isComputerThinking: false,
      engineError: null,
      engineStatus: this.state.settings.mode === 'computer' ? 'loading' : 'idle',
      analysisStatus: this.state.settings.mode === 'computer' && this.state.settings.analysisEnabled
        ? 'loading'
        : 'off',
      currentAnalysis: null,
      analysisError: null,
      moveAssessments: {},
      hint: null,
      hintRecords: {},
    }
    this.emit()

    if (this.state.settings.mode === 'computer') {
      void this.prepareComputerGame(revision, stopped)
      if (this.state.settings.analysisEnabled) void this.prepareAnalysis(this.analysisRevision)
    }
  }

  private async prepareComputerGame(revision: number, stopped: Promise<unknown>): Promise<void> {
    try {
      await stopped
      await this.ensureEngineReady()
      if (!this.isCurrentComputerGame(revision)) return
      await this.engine.newGame()
      this.engine.setDifficulty(this.state.settings.difficulty)
      if (!this.isCurrentComputerGame(revision)) return

      this.state = { ...this.state, engineStatus: 'ready', engineError: null }
      this.emit()
      if (this.isCurrentComputerTurn(revision)) await this.requestComputerMove(revision)
    } catch (error) {
      this.reportEngineError(error, revision)
    }
  }

  private async loadHint(): Promise<void> {
    if (!this.canRequestHint() || !this.analysisEngine?.analyzeMultiPv) return
    const gameRevision = this.revision
    const fen = this.state.snapshot.fen
    const ply = this.state.snapshot.history.length + 1
    const turn = this.state.snapshot.turn
    const requestId = ++this.hintRequestId
    const requestOrder = ++this.hintOrder
    this.pendingHintUsage = {
      ply,
      requested: true,
      maxLevel: 1,
      fen,
      requestOrder,
      requestedAt: Date.now(),
      successful: false,
      actualMove: null,
      bestMove: null,
      matchedBest: null,
      inTopThree: null,
    }
    this.state = {
      ...this.state,
      hint: {
        gameRevision,
        requestId,
        fen,
        ply,
        turn,
        level: 1,
        status: 'loading',
        direction: null,
        keySquare: null,
        keyPieceText: null,
        candidates: [],
        selectedCandidate: 0,
        error: null,
      },
    }
    this.emit()

    const cacheKey = `sf19|mpv3|d10|${fen}`
    const cached = this.hintCache.get(cacheKey)
    if (cached) {
      this.finishHint(gameRevision, requestId, fen, ply, turn, cached)
      return
    }

    // The same analysis Worker is shared: an explicit hint interrupts background
    // scoring, then background analysis is resumed after the hint finishes.
    if (this.activeAssessment) {
      this.assessmentQueue.unshift(this.activeAssessment)
      this.activeAssessment = null
    }
    this.analysisRevision += 1
    this.analysisTaskToken += 1
    this.analysisBusy = false
    this.desiredAnalysisFen = null

    try {
      await this.analysisEngine.stop()
      if (!this.isHintCurrent(gameRevision, requestId, fen, ply, turn)) return
      const result = await this.analysisEngine.analyzeMultiPv({ requestId, fen, count: 3 })
      if (!this.isHintCurrent(gameRevision, requestId, fen, ply, turn)) return
      const candidates = this.buildHintCandidates(result)
      if (candidates.length === 0) throw new Error('引擎没有返回可以在棋盘上执行的候选走法。')
      this.hintCache.set(cacheKey, candidates)
      if (this.hintCache.size > 12) {
        const oldest = this.hintCache.keys().next().value
        if (oldest) this.hintCache.delete(oldest)
      }
      this.finishHint(gameRevision, requestId, fen, ply, turn, candidates)
    } catch (error) {
      if (!this.isHintCurrent(gameRevision, requestId, fen, ply, turn)) return
      const detail = error instanceof Error ? error.message : String(error)
      this.state = {
        ...this.state,
        hint: { ...this.state.hint!, status: 'error', error: `提示暂时无法生成：${detail}` },
      }
      this.emit()
    } finally {
      if (!this.destroyed && gameRevision === this.revision && this.isAnalysisActive()) {
        this.scheduleCurrentAnalysis()
      }
    }
  }

  private buildHintCandidates(result: MultiPvResult): HintCandidate[] {
    return result.lines.flatMap((line) => {
      if (!line.bestMove) return []
      const conversion = convertUciLineToSan(result.fen, line.pv)
      const first = conversion.firstMove
      if (!first) return []
      const teaching = generateTeachingText(result.fen, line.bestMove, first.san, line.score, conversion.sanMoves)
      if (!teaching) return []
      return [{
        multipv: line.multipv,
        uci: line.bestMove,
        san: first.san,
        score: line.score,
        bound: line.bound,
        depth: line.depth,
        pvUci: line.pv,
        pvSan: conversion.sanMoves,
        conversionComplete: conversion.complete,
        afterFen: first.afterFen,
        explanation: teaching.explanation,
        from: first.from,
        to: first.to,
      }]
    }).sort((a, b) => a.multipv - b.multipv)
  }

  private finishHint(
    gameRevision: number,
    requestId: number,
    fen: string,
    ply: number,
    turn: Color,
    candidates: HintCandidate[],
  ): void {
    if (!this.isHintCurrent(gameRevision, requestId, fen, ply, turn)) return
    const best = candidates[0]
    const teaching = generateTeachingText(fen, best.uci, best.san, best.score, best.pvSan)
    if (!teaching) return
    if (this.pendingHintUsage) {
      this.pendingHintUsage.successful = true
      this.pendingHintUsage.bestMove = best.uci
    }
    this.state = {
      ...this.state,
      hint: {
        ...this.state.hint!,
        status: 'ready',
        direction: teaching.direction,
        keySquare: teaching.keySquare,
        keyPieceText: teaching.keyPieceText,
        candidates,
        error: null,
      },
    }
    this.emit()
  }

  private isHintCurrent(
    gameRevision: number,
    requestId: number,
    fen: string,
    ply: number,
    turn: Color,
  ): boolean {
    const hint = this.state.hint
    return !this.destroyed
      && gameRevision === this.revision
      && hint?.requestId === requestId
      && hint.fen === fen
      && hint.ply === ply
      && hint.turn === turn
      && this.state.snapshot.fen === fen
      && this.state.snapshot.history.length + 1 === ply
      && this.state.snapshot.turn === turn
  }

  private invalidateHint(emit = false): void {
    this.hintRequestId += 1
    if (this.state.hint?.status === 'loading') {
      this.analysisRevision += 1
      this.analysisTaskToken += 1
      this.analysisBusy = false
      void this.analysisEngine?.stop().catch(() => undefined)
    }
    if (this.state.hint) this.state = { ...this.state, hint: null }
    if (emit) this.emit()
  }

  private async ensureEngineReady(): Promise<void> {
    if (this.engineReady) return
    if (!this.initialization) {
      this.initialization = this.engine.initialize()
        .then(() => {
          this.engineReady = true
        })
        .finally(() => {
          this.initialization = null
        })
    }
    await this.initialization
  }

  private async requestComputerMove(revision: number): Promise<void> {
    if (!this.isCurrentComputerTurn(revision) || this.state.engineStatus !== 'ready') return

    this.state = { ...this.state, isComputerThinking: true, engineStatus: 'thinking' }
    this.emit()
    const fen = this.state.snapshot.fen
    const difficulty: Difficulty = this.state.settings.difficulty

    try {
      const uciMove = await this.engine.getBestMove(fen, difficulty)
      if (!this.isCurrentComputerTurn(revision) || !this.state.isComputerThinking) return
      const parsed = uciMove ? this.parseUciMove(uciMove) : null
      if (!parsed) throw new Error('电脑没有返回可用的走法。')

      const result = this.game.move(parsed.from, parsed.to, parsed.promotion)
      if (!result.success) throw new Error(`电脑返回了非法走法：${uciMove}`)

      this.state = {
        ...this.state,
        snapshot: this.game.snapshot(),
        currentAnalysis: null,
        isComputerThinking: false,
        engineStatus: 'ready',
        engineError: null,
      }
      this.emit()
      this.scheduleCurrentAnalysis()
    } catch (error) {
      if (!this.isCurrentComputerGame(revision) || !this.state.isComputerThinking) return
      this.reportEngineError(error, revision)
    }
  }

  private parseUciMove(move: string): { from: Square; to: Square; promotion?: PromotionPiece } | null {
    const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(move.trim())
    if (!match) return null
    return {
      from: match[1] as Square,
      to: match[2] as Square,
      ...(match[3] ? { promotion: match[3] as PromotionPiece } : {}),
    }
  }

  private reportEngineError(error: unknown, revision: number): void {
    if (!this.isCurrentComputerGame(revision)) return
    const detail = error instanceof Error ? error.message : String(error)
    this.state = {
      ...this.state,
      isComputerThinking: false,
      engineStatus: 'error',
      engineError: `电脑棋手暂时无法使用：${detail}`,
    }
    this.emit()
  }

  private async prepareAnalysis(revision: number): Promise<void> {
    if (!this.analysisEngine || !this.isAnalysisActive() || revision !== this.analysisRevision) return
    try {
      if (!this.analysisReady) {
        if (!this.analysisInitialization) {
          this.analysisInitialization = this.analysisEngine.initialize()
            .then(() => { this.analysisReady = true })
            .finally(() => { this.analysisInitialization = null })
        }
        await this.analysisInitialization
      }
      if (!this.isAnalysisRevisionCurrent(revision)) return
      this.state = { ...this.state, analysisStatus: 'analyzing', analysisError: null }
      this.emit()
      this.scheduleCurrentAnalysis()
    } catch (error) {
      this.reportAnalysisError(error, revision)
    }
  }

  private scheduleCurrentAnalysis(): void {
    if (!this.isAnalysisActive()) return
    this.desiredAnalysisFen = this.state.snapshot.fen
    this.pumpAnalysis()
  }

  private pumpAnalysis(): void {
    if (!this.analysisEngine || !this.analysisReady || !this.isAnalysisActive() || this.analysisBusy) return
    const revision = this.analysisRevision
    const token = ++this.analysisTaskToken
    const assessment = this.assessmentQueue.shift()
    this.activeAssessment = assessment ?? null
    const fen = assessment ? null : this.desiredAnalysisFen
    if (!assessment && !fen) return
    if (fen) this.desiredAnalysisFen = null
    this.analysisBusy = true
    this.state = { ...this.state, analysisStatus: 'analyzing', analysisError: null }
    this.emit()

    const task = assessment
      ? this.runMoveAssessment(assessment, revision)
      : this.runPositionAnalysis(fen!, revision)

    void task.catch((error) => {
      if (this.isAnalysisRevisionCurrent(revision)) this.reportAnalysisError(error, revision)
    }).finally(() => {
      if (token !== this.analysisTaskToken) return
      this.analysisBusy = false
      this.activeAssessment = null
      if (this.isAnalysisRevisionCurrent(revision) && this.state.analysisStatus !== 'error') {
        this.state = { ...this.state, analysisStatus: 'ready' }
        this.emit()
        this.pumpAnalysis()
      }
    })
  }

  private async runPositionAnalysis(fen: string, revision: number): Promise<PositionAnalysis> {
    const result = await this.getOrAnalyze(fen, revision)
    if (this.isAnalysisRevisionCurrent(revision) && this.state.snapshot.fen === fen) {
      this.state = { ...this.state, currentAnalysis: result }
      this.emit()
    }
    return result
  }

  private async runMoveAssessment(task: PendingMoveAssessment, revision: number): Promise<void> {
    if (task.gameRevision !== this.revision) return
    const before = await this.getOrAnalyze(task.beforeFen, revision)
    const after = await this.getOrAnalyze(task.afterFen, revision)
    if (!this.isAnalysisRevisionCurrent(revision) || task.gameRevision !== this.revision) return
    const historyMove = this.state.snapshot.history[task.ply - 1]
    if (!historyMove || historyMove.after !== task.afterFen) return

    const quality = assessMoveQuality(before, after, task.playerColor, task.actualMove)
    const assessment: MoveAssessment = {
      ...task,
      before,
      after,
      bestMove: before.bestMove,
      lossCp: quality.lossCp,
      quality: quality.quality,
      depth: Math.min(before.depth, after.depth),
    }
    this.state = {
      ...this.state,
      moveAssessments: { ...this.state.moveAssessments, [task.ply]: assessment },
    }
    this.emit()
  }

  private async getOrAnalyze(fen: string, revision: number): Promise<PositionAnalysis> {
    const cached = this.analysisCache.get(fen)
    if (cached) return cached
    if (!this.analysisEngine) throw new Error('分析引擎不可用。')
    const requestId = ++this.analysisRequestId
    const result = await this.analysisEngine.analyze({
      requestId,
      fen,
      onUpdate: (update) => {
        if (!this.isAnalysisRevisionCurrent(revision) || this.state.snapshot.fen !== fen) return
        this.state = { ...this.state, currentAnalysis: update, analysisStatus: 'analyzing' }
        this.emit()
      },
    })
    if (!this.isAnalysisRevisionCurrent(revision) || result.fen !== fen || result.requestId !== requestId) {
      throw new Error('分析结果已过期。')
    }
    this.analysisCache.set(fen, result)
    if (this.analysisCache.size > 24) {
      const oldest = this.analysisCache.keys().next().value
      if (oldest) this.analysisCache.delete(oldest)
    }
    return result
  }

  private invalidateAnalysis(destroyWorker: boolean): void {
    this.hintRequestId += 1
    this.analysisRevision += 1
    this.analysisTaskToken += 1
    this.analysisBusy = false
    this.assessmentQueue = []
    this.desiredAnalysisFen = null
    this.activeAssessment = null
    void this.analysisEngine?.stop().catch(() => undefined)
    if (destroyWorker) {
      this.analysisEngine?.destroy()
      this.analysisReady = false
      this.analysisInitialization = null
    }
  }

  private trimAssessments(): void {
    const historyLength = this.state.snapshot.history.length
    const moveAssessments = Object.fromEntries(
      Object.entries(this.state.moveAssessments).filter(([ply]) => Number(ply) <= historyLength),
    )
    this.state = { ...this.state, moveAssessments }
  }

  private trimHintRecords(): void {
    const historyLength = this.state.snapshot.history.length
    const hintRecords = Object.fromEntries(
      Object.entries(this.state.hintRecords).filter(([ply]) => Number(ply) <= historyLength),
    )
    this.pendingHintUsage = null
    this.state = { ...this.state, hint: null, hintRecords }
  }

  private isAnalysisActive(): boolean {
    return this.state.settings.mode === 'computer' && this.state.settings.analysisEnabled
  }

  private isAnalysisRevisionCurrent(revision: number): boolean {
    return !this.destroyed && this.isAnalysisActive() && revision === this.analysisRevision
  }

  private reportAnalysisError(error: unknown, revision: number): void {
    if (!this.isAnalysisRevisionCurrent(revision)) return
    const detail = error instanceof Error ? error.message : String(error)
    this.assessmentQueue = []
    this.desiredAnalysisFen = null
    this.state = {
      ...this.state,
      analysisStatus: 'error',
      analysisError: `局面分析暂时不可用：${detail}`,
    }
    this.emit()
  }

  private isCurrentComputerGame(revision: number): boolean {
    return !this.destroyed && revision === this.revision && this.state.settings.mode === 'computer'
  }

  private isCurrentComputerTurn(revision: number): boolean {
    return this.isCurrentComputerGame(revision)
      && !this.state.snapshot.isGameOver
      && this.state.snapshot.turn !== this.state.playerColor
  }

  private updateFromGame(): void {
    const snapshot = this.game.snapshot()
    this.state = {
      ...this.state,
      snapshot,
      ...(snapshot.fen !== this.state.snapshot.fen ? { currentAnalysis: null } : {}),
    }
    this.emit()
  }

  private resolvePlayerColor(choice: GameSettings['colorChoice']): Color {
    if (choice === 'white') return 'w'
    if (choice === 'black') return 'b'
    return this.random() < 0.5 ? 'w' : 'b'
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener())
  }
}
