import { ENGINE_DIFFICULTIES } from '../engine/types'
import type { ColorChoice, Difficulty, GameMode, GameSettings } from '../types'

interface GameSetupProps {
  settings: GameSettings
  playerColor: 'w' | 'b'
  onChange: (settings: Partial<GameSettings>) => void
  onAnalysisToggle: (enabled: boolean) => void
}

const colorOptions: Array<{ value: ColorChoice; label: string }> = [
  { value: 'white', label: '执白' },
  { value: 'black', label: '执黑' },
  { value: 'random', label: '随机' },
]

export function GameSetup({ settings, playerColor, onChange, onAnalysisToggle }: GameSetupProps) {
  const setMode = (mode: GameMode) => onChange({ mode })

  return (
    <section className="setup-card" aria-label="对局设置">
      <div className="mode-tabs">
        <button
          type="button"
          className={settings.mode === 'local' ? 'active' : ''}
          onClick={() => setMode('local')}
        >
          本地双人
        </button>
        <button
          type="button"
          className={settings.mode === 'computer' ? 'active' : ''}
          onClick={() => setMode('computer')}
        >
          人机对战
        </button>
      </div>

      {settings.mode === 'computer' && (
        <div className="computer-settings">
          <div className="setting-group">
            <span className="setting-label">我的颜色</span>
            <div className="segmented-control">
              {colorOptions.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={settings.colorChoice === option.value ? 'active' : ''}
                  onClick={() => onChange({ colorChoice: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {settings.colorChoice === 'random' && (
              <small>本局随机到：{playerColor === 'w' ? '白方' : '黑方'}</small>
            )}
          </div>

          <div className="setting-group">
            <label className="setting-label" htmlFor="difficulty">电脑难度</label>
            <select
              id="difficulty"
              value={settings.difficulty}
              onChange={(event) => onChange({ difficulty: Number(event.target.value) as Difficulty })}
            >
              {(Object.keys(ENGINE_DIFFICULTIES) as unknown as Difficulty[]).map((level) => (
                <option key={level} value={level}>
                  {level}. {ENGINE_DIFFICULTIES[level].label}
                </option>
              ))}
            </select>
          </div>
          <label className="analysis-toggle">
            <input
              type="checkbox"
              checked={settings.analysisEnabled}
              onChange={(event) => onAnalysisToggle(event.target.checked)}
            />
            <span>
              <strong>实时分析</strong>
              <small>显示优势和玩家走子质量</small>
            </span>
          </label>
        </div>
      )}
    </section>
  )
}
