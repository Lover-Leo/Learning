import { Chess, type Square } from 'chess.js'

export interface SanConversionResult {
  sanMoves: string[]
  complete: boolean
  finalFen: string
  firstMove: {
    from: Square
    to: Square
    san: string
    flags: string
    captured?: string
    promotion?: string
    afterFen: string
  } | null
}

export function convertUciLineToSan(fen: string, uciMoves: string[]): SanConversionResult {
  const chess = new Chess(fen)
  const sanMoves: string[] = []
  let firstMove: SanConversionResult['firstMove'] = null

  for (const uci of uciMoves) {
    const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci)
    if (!match) return { sanMoves, complete: false, finalFen: chess.fen(), firstMove }
    try {
      const move = chess.move({
        from: match[1],
        to: match[2],
        ...(match[3] ? { promotion: match[3] } : {}),
      })
      sanMoves.push(move.san)
      if (!firstMove) {
        firstMove = {
          from: move.from,
          to: move.to,
          san: move.san,
          flags: move.flags,
          ...(move.captured ? { captured: move.captured } : {}),
          ...(move.promotion ? { promotion: move.promotion } : {}),
          afterFen: chess.fen(),
        }
      }
    } catch {
      return { sanMoves, complete: false, finalFen: chess.fen(), firstMove }
    }
  }
  return { sanMoves, complete: true, finalFen: chess.fen(), firstMove }
}
