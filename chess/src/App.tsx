import { useEffect, useState } from 'react'
import type { Square } from 'chess.js'
import { ChessBoard } from './components/ChessBoard'
import { GameControls } from './components/GameControls'
import { GameSetup } from './components/GameSetup'
import { AdvantagePanel } from './components/AdvantagePanel'
import { MoveHistory } from './components/MoveHistory'
import { PromotionDialog } from './components/PromotionDialog'
import { StatusPanel } from './components/StatusPanel'
import { HintPanel } from './components/HintPanel'
import { useChessMatch } from './hooks/useChessMatch'
import type { PendingPromotion, PromotionPiece } from './types'
import './styles.css'

export default function App() {
  const { controller, state } = useChessMatch()
  const { snapshot } = state
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null)
  const hintCandidate = state.hint?.candidates[state.hint.selectedCandidate]
  const hintCanRequest = controller.canRequestHint(Boolean(pendingPromotion))
  const hintDisabledReason = state.settings.mode !== 'computer'
    ? '本地双人模式不提供实时最佳走法提示。'
    : !state.settings.analysisEnabled
      ? '请先开启实时分析，才能获取提示。'
      : pendingPromotion
        ? '请先完成升变选择。'
        : state.snapshot.isGameOver
          ? '棋局已经结束。'
          : state.isComputerThinking || state.snapshot.turn !== state.playerColor
            ? '请等到玩家回合再获取提示。'
            : state.analysisStatus === 'error' || state.analysisStatus === 'loading'
              ? '分析引擎尚未准备好。'
              : '当前暂时不能获取提示。'

  useEffect(() => {
    if (state.settings.mode === 'computer') {
      setOrientation(state.playerColor === 'w' ? 'white' : 'black')
    }
  }, [state.playerColor, state.settings.mode])

  const requestMove = (from: Square, to: Square) => {
    const result = controller.playerMove(from, to)
    if (result.needsPromotion) {
      setPendingPromotion({ from, to, options: result.options })
    }
    return result
  }

  const finishPromotion = (piece: PromotionPiece) => {
    if (!pendingPromotion) return
    controller.playerMove(pendingPromotion.from, pendingPromotion.to, piece)
    setPendingPromotion(null)
  }

  const handleUndo = () => {
    setPendingPromotion(null)
    void controller.undo()
  }

  const handleReset = () => {
    setPendingPromotion(null)
    controller.restart()
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <span className="eyebrow">LOCAL CHESS · STOCKFISH 19</span>
        <h1>浏览器国际象棋</h1>
        <p>既可以同屏双人对弈，也可以挑战在本机运行的 Stockfish。</p>
      </header>

      <div className="game-layout">
        <section className="board-column" aria-label="国际象棋棋盘">
          <GameSetup
            settings={state.settings}
            playerColor={state.playerColor}
            onChange={(settings) => {
              setPendingPromotion(null)
              controller.configure(settings)
            }}
            onAnalysisToggle={(enabled) => controller.setAnalysisEnabled(enabled)}
          />
          <ChessBoard
            game={controller.game}
            snapshot={snapshot}
            orientation={orientation}
            interactionEnabled={controller.canPlayerMove()}
            movableColor={state.settings.mode === 'local' ? snapshot.turn : state.playerColor}
            onMove={requestMove}
            hintKeySquare={state.hint?.level === 2 ? state.hint.keySquare : null}
            hintArrow={state.hint?.level === 3 && hintCandidate
              ? { from: hintCandidate.from, to: hintCandidate.to }
              : null}
          />
        </section>

        <aside className="side-panel">
          <StatusPanel state={state} onRetryEngine={() => controller.retryEngine()} />
          {state.settings.mode === 'computer' && (
            <AdvantagePanel state={state} onRetry={() => controller.retryAnalysis()} />
          )}
          <HintPanel
            hint={state.hint}
            canRequest={hintCanRequest}
            disabledReason={hintDisabledReason}
            onNext={() => controller.requestNextHint()}
            onCancel={() => controller.cancelHint()}
            onSelectCandidate={(index) => controller.selectHintCandidate(index)}
          />
          <GameControls
            canUndo={snapshot.history.length > 0 && state.engineStatus !== 'loading'}
            onUndo={handleUndo}
            onReset={handleReset}
            onFlip={() => setOrientation((value) => (value === 'white' ? 'black' : 'white'))}
          />
          <MoveHistory history={snapshot.history} assessments={state.moveAssessments} hintRecords={state.hintRecords} />
        </aside>
      </div>

      <footer>规则由 chess.js 负责 · 电脑棋手由 Stockfish 19 WebAssembly 驱动</footer>

      {pendingPromotion && (
        <PromotionDialog
          color={snapshot.turn}
          options={pendingPromotion.options}
          onSelect={finishPromotion}
          onCancel={() => setPendingPromotion(null)}
        />
      )}
    </main>
  )
}
