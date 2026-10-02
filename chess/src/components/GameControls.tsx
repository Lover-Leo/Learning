interface GameControlsProps {
  canUndo: boolean
  onUndo: () => void
  onReset: () => void
  onFlip: () => void
}

export function GameControls({ canUndo, onUndo, onReset, onFlip }: GameControlsProps) {
  return (
    <div className="controls" aria-label="棋局操作">
      <button type="button" onClick={onUndo} disabled={!canUndo}>
        ↶ 悔棋
      </button>
      <button type="button" onClick={onReset}>
        ↻ 重新开始
      </button>
      <button type="button" onClick={onFlip}>
        ⇅ 翻转棋盘
      </button>
    </div>
  )
}
