import type { Difficulty } from '../types'
import { ENGINE_DIFFICULTIES, type ChessEngine } from './types'
import { UciWorkerClient } from './UciWorkerClient'

export class StockfishEngine implements ChessEngine {
  private readonly uci: UciWorkerClient

  constructor(createWorker?: (url: string) => Worker) {
    this.uci = new UciWorkerClient(createWorker)
  }

  initialize(): Promise<void> {
    return this.uci.initialize()
  }

  newGame(): Promise<void> {
    return this.uci.newGame()
  }

  setDifficulty(difficulty: Difficulty): void {
    const profile = ENGINE_DIFFICULTIES[difficulty]
    this.uci.command(`setoption name Skill Level value ${profile.skillLevel}`)
  }

  async getBestMove(fen: string, difficulty: Difficulty): Promise<string | null> {
    const profile = ENGINE_DIFFICULTIES[difficulty]
    this.setDifficulty(difficulty)
    this.uci.command(`position fen ${fen}`)
    const bestMoveLine = this.uci.waitForLine((line) => line.startsWith('bestmove '))
    this.uci.command(`go depth ${profile.depth} movetime ${profile.moveTimeMs}`)
    const move = (await bestMoveLine).split(/\s+/)[1]
    return move === '(none)' ? null : move
  }

  stop(): Promise<void> {
    return this.uci.stop()
  }

  destroy(): void {
    this.uci.destroy()
  }
}
