import { Chess, type Move, type Square } from 'chess.js'
import type { GameSnapshot, MoveResult, PromotionPiece } from '../types'

const PROMOTION_ORDER: PromotionPiece[] = ['q', 'r', 'b', 'n']

export class ChessGame {
  private chess: Chess

  constructor(fen?: string) {
    this.chess = new Chess(fen)
  }

  snapshot(): GameSnapshot {
    const history = this.chess.history({ verbose: true })

    return {
      fen: this.chess.fen(),
      turn: this.chess.turn(),
      history,
      lastMove: history.length
        ? { from: history.at(-1)!.from, to: history.at(-1)!.to }
        : null,
      isCheck: this.chess.isCheck(),
      isCheckmate: this.chess.isCheckmate(),
      isStalemate: this.chess.isStalemate(),
      isDraw: this.chess.isDraw(),
      isGameOver: this.chess.isGameOver(),
      drawReason: this.getDrawReason(),
    }
  }

  move(from: Square, to: Square, promotion?: PromotionPiece): MoveResult {
    if (this.chess.isGameOver()) {
      return { success: false, needsPromotion: false }
    }

    const promotionOptions = this.getPromotionOptions(from, to)
    if (promotionOptions.length > 0 && !promotion) {
      return { success: false, needsPromotion: true, options: promotionOptions }
    }

    try {
      this.chess.move({ from, to, ...(promotion ? { promotion } : {}) })
      return { success: true, needsPromotion: false }
    } catch {
      return { success: false, needsPromotion: false }
    }
  }

  legalMoves(square: Square): Move[] {
    return this.chess.moves({ square, verbose: true })
  }

  getPromotionOptions(from: Square, to: Square): PromotionPiece[] {
    const available = new Set(
      this.legalMoves(from)
        .filter((move) => move.to === to && move.promotion)
        .map((move) => move.promotion as PromotionPiece),
    )

    return PROMOTION_ORDER.filter((piece) => available.has(piece))
  }

  pieceAt(square: Square) {
    return this.chess.get(square)
  }

  undo(): boolean {
    return this.chess.undo() !== null
  }

  reset(): void {
    this.chess.reset()
  }

  private getDrawReason(): string | null {
    if (this.chess.isStalemate()) return '逼和（无合法走法）'
    if (this.chess.isThreefoldRepetition()) return '三次重复局面'
    if (this.chess.isInsufficientMaterial()) return '子力不足'
    if (this.chess.isDrawByFiftyMoves()) return '五十回合规则'
    if (this.chess.isDraw()) return '和棋'
    return null
  }
}
