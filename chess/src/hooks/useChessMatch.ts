import { useEffect, useRef, useSyncExternalStore } from 'react'
import { StockfishEngine } from '../engine/StockfishEngine'
import { StockfishAnalysisEngine } from '../analysis/StockfishAnalysisEngine'
import { ChessMatchController } from '../game/ChessMatchController'
import { loadSettings, saveSettings } from '../game/settingsStorage'

export function useChessMatch() {
  const controllerRef = useRef<ChessMatchController | null>(null)
  const destroyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedRef = useRef(false)
  if (!controllerRef.current) {
    controllerRef.current = new ChessMatchController(
      new StockfishEngine(),
      loadSettings(),
      Math.random,
      undefined,
      new StockfishAnalysisEngine(),
    )
  }
  const controller = controllerRef.current
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)

  useEffect(() => {
    if (destroyTimerRef.current) clearTimeout(destroyTimerRef.current)
    if (!startedRef.current) {
      startedRef.current = true
      controller.start()
    }
    return () => {
      // A short delay keeps React StrictMode's development-only effect replay
      // from destroying a Worker that is immediately needed again.
      destroyTimerRef.current = setTimeout(() => controller.destroy(), 0)
    }
  }, [controller])

  useEffect(() => {
    saveSettings(state.settings)
  }, [state.settings])

  return { controller, state }
}
