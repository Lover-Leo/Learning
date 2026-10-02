import { ENGINE_DIFFICULTIES } from '../engine/types'
import type { MatchState } from '../types'

interface StatusPanelProps {
  state: MatchState
  onRetryEngine: () => void
}

export function StatusPanel({ state, onRetryEngine }: StatusPanelProps) {
  const { snapshot, settings } = state
  const side = snapshot.turn === 'w' ? '白方' : '黑方'
  const winner = snapshot.turn === 'w' ? '黑方' : '白方'

  let title = `${side}走棋`
  let detail = snapshot.isCheck ? `${side}的王正在被将军` : '棋局进行中'

  if (snapshot.isCheckmate) {
    title = '将死，棋局结束'
    detail = `${winner}获胜`
  } else if (snapshot.isDraw) {
    title = '和棋，棋局结束'
    detail = snapshot.drawReason ?? '双方和棋'
  } else if (settings.mode === 'computer') {
    if (state.engineStatus === 'loading') {
      title = '正在加载电脑棋手'
      detail = '首次加载 WebAssembly 可能需要几秒钟'
    } else if (state.engineStatus === 'thinking') {
      title = '电脑正在思考'
      detail = '页面仍可正常操作，请稍候…'
    } else if (state.engineStatus === 'error') {
      title = '电脑棋手加载失败'
      detail = state.engineError ?? '请检查浏览器支持或刷新后重试'
    } else if (snapshot.turn === state.playerColor) {
      title = '轮到你走棋'
      detail = `你执${state.playerColor === 'w' ? '白' : '黑'}，电脑执${state.playerColor === 'w' ? '黑' : '白'}`
    } else {
      title = '电脑棋手已准备好'
      detail = '即将开始计算下一步'
    }
  }

  return (
    <section className="status-card" data-engine-status={state.engineStatus} aria-live="polite">
      <span className={`turn-dot ${snapshot.turn === 'w' ? 'white' : 'black'}`} />
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
        {settings.mode === 'computer' && (
          <div className="status-tags">
            <span>你：{state.playerColor === 'w' ? '白方' : '黑方'}</span>
            <span>电脑：{state.playerColor === 'w' ? '黑方' : '白方'}</span>
            <span>{ENGINE_DIFFICULTIES[settings.difficulty].label}</span>
          </div>
        )}
        {state.engineStatus === 'error' && settings.mode === 'computer' && (
          <button type="button" className="retry-button" onClick={onRetryEngine}>
            重试加载
          </button>
        )}
      </div>
    </section>
  )
}
