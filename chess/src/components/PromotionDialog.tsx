import type { Color } from 'chess.js'
import type { PromotionPiece } from '../types'

interface PromotionDialogProps {
  color: Color
  options: PromotionPiece[]
  onSelect: (piece: PromotionPiece) => void
  onCancel: () => void
}

const pieceNames: Record<PromotionPiece, string> = {
  q: '后',
  r: '车',
  b: '象',
  n: '马',
}

const pieceSymbols: Record<Color, Record<PromotionPiece, string>> = {
  w: { q: '♕', r: '♖', b: '♗', n: '♘' },
  b: { q: '♛', r: '♜', b: '♝', n: '♞' },
}

export function PromotionDialog({ color, options, onSelect, onCancel }: PromotionDialogProps) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="promotion-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="promotion-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="promotion-title">选择升变棋子</h2>
        <p>兵到达底线后，可以升变为以下任意棋子。</p>
        <div className="promotion-options">
          {options.map((piece) => (
            <button type="button" key={piece} onClick={() => onSelect(piece)}>
              <span aria-hidden="true">{pieceSymbols[color][piece]}</span>
              {pieceNames[piece]}
            </button>
          ))}
        </div>
        <button type="button" className="cancel-button" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  )
}
