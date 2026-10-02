import { evaluationToWhitePercent, formatWhiteEvaluation } from '../analysis/uciParsing'
import type { MatchState } from '../types'

interface AdvantagePanelProps {
  state: MatchState
  onRetry: () => void
}

export function AdvantagePanel({ state, onRetry }: AdvantagePanelProps) {
  const analysis = state.currentAnalysis
  const whitePercent = evaluationToWhitePercent(analysis)
  const scoreText = formatWhiteEvaluation(analysis)

  let statusText = '暂无评分'
  if (!state.settings.analysisEnabled) statusText = '分析已暂停'
  else if (state.analysisStatus === 'loading') statusText = '正在加载分析引擎'
  else if (state.analysisStatus === 'analyzing') {
    statusText = analysis ? `正在分析 · 深度 ${analysis.depth}` : '正在分析'
  } else if (state.analysisStatus === 'ready' && analysis) {
    statusText = `分析深度 ${analysis.depth}${analysis.bound === 'exact' ? '' : ' · 暂定边界'}`
  } else if (state.analysisStatus === 'error') statusText = '分析失败'

  return (
    <section className="advantage-card" aria-label="实时局面评分">
      <div className="analysis-heading">
        <div>
          <span className="analysis-kicker">白方视角</span>
          <strong aria-live="polite">{scoreText}</strong>
        </div>
        <span className={`analysis-state ${state.analysisStatus}`}>{statusText}</span>
      </div>

      <div
        className="advantage-bar"
        role="meter"
        aria-label={`当前局面评分：${scoreText}。正数表示白方占优，负数表示黑方占优。`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(whitePercent)}
      >
        <div className="white-advantage" style={{ width: `${whitePercent}%` }}>
          <span>白</span>
        </div>
        <div className="black-advantage"><span>黑</span></div>
      </div>

      <p className="analysis-help">正数代表白方占优，负数代表黑方占优。</p>
      {state.analysisStatus === 'error' && (
        <div className="analysis-error">
          <span>{state.analysisError}</span>
          <button type="button" onClick={onRetry}>重试分析</button>
        </div>
      )}
    </section>
  )
}
