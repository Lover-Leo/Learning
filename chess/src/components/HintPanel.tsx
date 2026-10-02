import type { HintSession } from '../hints/types'
import type { HintCandidate } from '../hints/types'

const formatCandidateScore = (candidate: HintCandidate) => {
  const provisional = candidate.bound === 'exact' ? '' : '≈'
  if (candidate.score.type === 'mate') {
    return `${provisional}${candidate.score.value >= 0 ? '白方' : '黑方'} M${Math.abs(candidate.score.value)}`
  }
  if (Math.abs(candidate.score.value) < 5) return `${provisional}均势`
  return `${provisional}${candidate.score.value >= 0 ? '+' : ''}${(candidate.score.value / 100).toFixed(2)}`
}

interface HintPanelProps {
  hint: HintSession | null
  canRequest: boolean
  disabledReason: string
  onNext: () => void
  onCancel: () => void
  onSelectCandidate: (index: number) => void
}

export function HintPanel({
  hint,
  canRequest,
  disabledReason,
  onNext,
  onCancel,
  onSelectCandidate,
}: HintPanelProps) {
  const selected = hint?.candidates[hint.selectedCandidate]
  const buttonLabel = !hint || hint.status === 'error'
    ? (hint?.status === 'error' ? '重试提示' : '获取提示')
    : hint.level < 3 ? '再给一点提示' : '已显示完整提示'

  return (
    <section className="hint-card" data-hint-level={hint?.level ?? 0} aria-labelledby="hint-title">
      <div className="section-heading hint-heading">
        <div>
          <h2 id="hint-title">按需提示</h2>
          <span>{hint ? `第 ${hint.level} 级 / 3` : '从思考方向开始'}</span>
        </div>
        {hint?.status === 'loading' && <span className="hint-loading">正在思考…</span>}
      </div>

      <div className="hint-content" aria-live="polite">
        {!hint && <p className="hint-empty">需要时再主动获取，提示不会自动泄露答案。</p>}
        {hint?.status === 'loading' && <p>Stockfish 正在整理候选走法，期间你仍可直接走棋。</p>}
        {hint?.status === 'error' && <p className="hint-error">{hint.error}</p>}
        {hint?.status === 'ready' && (
          <>
            <p className="hint-level-label">第一级 · 思考方向</p>
            <p>{hint.direction}</p>

            {hint.level >= 2 && (
              <div className="hint-layer">
                <p className="hint-level-label">第二级 · 关键棋子</p>
                <p>{hint.keyPieceText}</p>
                <small>棋盘已高亮关键棋子的起始格，但还没有画出答案箭头。</small>
              </div>
            )}

            {hint.level >= 3 && selected && (
              <div className="hint-layer hint-answer">
                <p className="hint-level-label">第三级 · 完整答案</p>
                <div className="candidate-list" aria-label="候选走法">
                  {hint.candidates.map((candidate, index) => (
                    <button
                      type="button"
                      key={`${candidate.multipv}-${candidate.uci}`}
                      className={index === hint.selectedCandidate ? 'active' : ''}
                      data-uci={candidate.uci}
                      onClick={() => onSelectCandidate(index)}
                    >
                      <strong>{index + 1}. {candidate.san}</strong>
                      <span>{formatCandidateScore(candidate)}</span>
                    </button>
                  ))}
                </div>
                <div className="candidate-detail">
                  <p><strong>{selected.san}</strong>（{selected.from} → {selected.to}）· 深度 {selected.depth}</p>
                  <p>{selected.explanation}</p>
                  <p className="pv-line"><span>PV：</span>{selected.pvSan.join(' ') || '暂无完整变化'}</p>
                  {selected.bound !== 'exact' && <small>此评分是边界值，仅作为暂定参考。</small>}
                  {!selected.conversionComplete && <small>部分后续线路无法转换，已安全显示可识别部分。</small>}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="hint-actions">
        <button
          type="button"
          onClick={onNext}
          disabled={!canRequest || hint?.status === 'loading' || hint?.level === 3}
          title={!canRequest ? disabledReason : undefined}
        >{buttonLabel}</button>
        {hint && <button type="button" className="secondary" onClick={onCancel}>取消提示</button>}
      </div>
      {!canRequest && !hint && <p className="hint-unavailable">{disabledReason}</p>}
    </section>
  )
}
