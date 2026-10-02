import { useEffect, useMemo, useState } from 'react'
import { Chessboard, type ChessboardOptions } from 'react-chessboard'
import type { Square } from 'chess.js'
import type { ChessGame } from '../game/ChessGame'
import type { GameSnapshot, MoveResult } from '../types'

interface ChessBoardProps {
  game: ChessGame
  snapshot: GameSnapshot
  orientation: 'white' | 'black'
  interactionEnabled: boolean
  movableColor: 'w' | 'b'
  onMove: (from: Square, to: Square) => MoveResult
  hintKeySquare?: Square | null
  hintArrow?: { from: Square; to: Square } | null
}

const isSquare = (value: string | null | undefined): value is Square =>
  Boolean(value && /^[a-h][1-8]$/.test(value))

export function ChessBoard({
  game,
  snapshot,
  orientation,
  interactionEnabled,
  movableColor,
  onMove,
  hintKeySquare,
  hintArrow,
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)

  useEffect(() => {
    if (!interactionEnabled) setSelectedSquare(null)
  }, [interactionEnabled, snapshot.fen])

  const legalMoves = useMemo(
    () => (selectedSquare ? game.legalMoves(selectedSquare) : []),
    [game, selectedSquare, snapshot.fen],
  )

  const squareStyles = useMemo<NonNullable<ChessboardOptions['squareStyles']>>(() => {
    const styles: NonNullable<ChessboardOptions['squareStyles']> = {}

    if (snapshot.lastMove) {
      const highlight = { background: 'rgba(246, 210, 73, 0.56)' }
      styles[snapshot.lastMove.from] = highlight
      styles[snapshot.lastMove.to] = highlight
    }

    if (selectedSquare) {
      styles[selectedSquare] = {
        ...styles[selectedSquare],
        boxShadow: 'inset 0 0 0 4px rgba(255, 244, 143, 0.95)',
      }
    }

    if (hintKeySquare) {
      styles[hintKeySquare] = {
        ...styles[hintKeySquare],
        boxShadow: 'inset 0 0 0 5px rgba(63, 128, 181, 0.9)',
      }
    }

    legalMoves.forEach((move) => {
      const occupied = game.pieceAt(move.to)
      styles[move.to] = {
        ...styles[move.to],
        background: occupied
          ? 'radial-gradient(circle, transparent 55%, rgba(32, 68, 50, 0.58) 57%, rgba(32, 68, 50, 0.58) 70%, transparent 72%)'
          : 'radial-gradient(circle, rgba(32, 68, 50, 0.58) 0 17%, transparent 19%)',
      }
    })

    return styles
  }, [game, hintKeySquare, legalMoves, selectedSquare, snapshot.lastMove])

  const selectIfOwnPiece = (square: Square) => {
    const piece = game.pieceAt(square)
    if (interactionEnabled && piece?.color === snapshot.turn && piece.color === movableColor) {
      setSelectedSquare(square)
      return true
    }
    return false
  }

  const tryMove = (from: Square, to: Square) => {
    if (!interactionEnabled) return false
    const result = onMove(from, to)
    if (result.success || result.needsPromotion) setSelectedSquare(null)
    return result.success || result.needsPromotion
  }

  const options: ChessboardOptions = {
    position: snapshot.fen,
    boardOrientation: orientation,
    squareStyles,
    animationDurationInMs: 180,
    allowDrawingArrows: false,
    arrows: hintArrow ? [{ startSquare: hintArrow.from, endSquare: hintArrow.to, color: '#2878b8' }] : [],
    allowDragging: interactionEnabled,
    canDragPiece: ({ piece }) =>
      interactionEnabled && piece.pieceType[0] === snapshot.turn && piece.pieceType[0] === movableColor,
    onPieceDrag: ({ square }) => {
      if (isSquare(square)) selectIfOwnPiece(square)
    },
    onPieceDrop: ({ sourceSquare, targetSquare }) => {
      if (!isSquare(sourceSquare) || !isSquare(targetSquare)) return false
      return tryMove(sourceSquare, targetSquare)
    },
    onSquareClick: ({ square }) => {
      if (!isSquare(square) || !interactionEnabled) return
      if (!selectedSquare) {
        selectIfOwnPiece(square)
        return
      }
      if (square === selectedSquare) {
        setSelectedSquare(null)
        return
      }
      if (!tryMove(selectedSquare, square)) selectIfOwnPiece(square) || setSelectedSquare(null)
    },
    boardStyle: {
      width: '100%',
      maxWidth: '100%',
      borderRadius: '10px',
      boxShadow: '0 18px 50px rgba(6, 18, 12, 0.3)',
    },
    lightSquareStyle: { backgroundColor: '#e8dec6' },
    darkSquareStyle: { backgroundColor: '#55715d' },
  }

  return (
    <div
      className="board-shell"
      data-hint-arrow={hintArrow ? `${hintArrow.from}-${hintArrow.to}` : ''}
      data-hint-key={hintKeySquare ?? ''}
    >
      <Chessboard options={options} />
      {snapshot.isGameOver && <div className="board-finished">棋局已结束</div>}
    </div>
  )
}
