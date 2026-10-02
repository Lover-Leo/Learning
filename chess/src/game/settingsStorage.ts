import type { ColorChoice, Difficulty, GameMode, GameSettings } from '../types'

const STORAGE_KEY = 'local-chess.settings.v2'
const defaults: GameSettings = {
  mode: 'local', colorChoice: 'white', difficulty: 3, analysisEnabled: true,
}

const isMode = (value: unknown): value is GameMode => value === 'local' || value === 'computer'
const isColorChoice = (value: unknown): value is ColorChoice =>
  value === 'white' || value === 'black' || value === 'random'
const isDifficulty = (value: unknown): value is Difficulty =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5

export function loadSettings(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): GameSettings {
  if (import.meta.env.DEV && globalThis.location?.search.includes('__smoke=computer')) {
    return { mode: 'computer', colorChoice: 'white', difficulty: 1, analysisEnabled: true }
  }
  if (!storage) return defaults
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as Partial<GameSettings>
    return {
      mode: isMode(saved.mode) ? saved.mode : defaults.mode,
      colorChoice: isColorChoice(saved.colorChoice) ? saved.colorChoice : defaults.colorChoice,
      difficulty: isDifficulty(saved.difficulty) ? saved.difficulty : defaults.difficulty,
      analysisEnabled: typeof saved.analysisEnabled === 'boolean'
        ? saved.analysisEnabled
        : defaults.analysisEnabled,
    }
  } catch {
    return defaults
  }
}

export function saveSettings(
  settings: GameSettings,
  storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage may be unavailable in privacy mode; the game remains usable.
  }
}
