import { useState } from 'react'
import type { Move } from 'chess.js'
import { MOVE_QUALITY_LABELS } from '../analysis/moveQuality'
import { formatWhiteEvaluation } from '../analysis/uciParsing'
import type { MoveAssessment } from '../analysis/types'
import type { HintUsageRecord } from '../hints/types'

interface MoveHistoryProps {
  history: Move[]
  assessments: Record<number, MoveAssessment>
  hintRecords: Record<number, HintUsageRecord>
}

export function MoveHistory({ history, assessments, hintRecords }: MoveHistoryProps) {
  const [selectedPly, setSelectedPly] = useState<number | null>(null)
  const selected = selectedPly ? assessments[selectedPly] : undefined
  const rows = Array.from({ length: Math.ceil(history.length / 2) }, (_, index) => ({
    number: index + 1,
    white: history[index * 2]?.san ?? '',
    black: history[index * 2 + 1]?.san ?? '',
  }))

  return (
    <section className="history-card">
      <div className="section-heading">
        <h2>走棋记录</h2>
        <span>{history.length} 步</span>
      </div>
      <div className="history-list" aria-label="标准代数记谱走棋记录">
        {rows.length === 0 ? (
          <p className="empty-history">走出第一步后，记录会显示在这里。</p>
        ) : (
          rows.map((row) => (
            <div className="history-row" key={row.number}>
              <span className="move-number">{row.number}.</span>
              <MoveCell san={row.white} ply={row.number * 2 - 1} assessment={assessments[row.number * 2 - 1]} hint={hintRecords[row.number * 2 - 1]} onSelect={setSelectedPly} />
              <MoveCell san={row.black} ply={row.number * 2} assessment={assessments[row.number * 2]} hint={hintRecords[row.number * 2]} onSelect={setSelectedPly} />
            </div>
          ))
        )}
      </div>
      {selected && (
        <div className="move-analysis-detail" aria-live="polite">
          <div className="detail-title">
            <strong>{selected.san} · {MOVE_QUALITY_LABELS[selected.quality]}</strong>
            <button type="button" onClick={() => setSelectedPly(null)} aria-label="关闭走子分析">×</button>
          </div>
          <dl>
            <div><dt>实际走法</dt><dd>{selected.actualMove}</dd></div>
            <div><dt>引擎首选</dt><dd>{selected.bestMove ?? '无可用结果'}</dd></div>
            <div><dt>走棋前</dt><dd>{formatWhiteEvaluation(selected.before)}</dd></div>
            <div><dt>走棋后</dt><dd>{formatWhiteEvaluation(selected.after)}</dd></div>
            <div><dt>评分损失</dt><dd>{selected.lossCp === null ? '将杀变化' : `${(selected.lossCp / 100).toFixed(2)} 兵`}</dd></div>
            <div><dt>分析深度</dt><dd>{selected.depth}</dd></div>
          </dl>
        </div>
      )}
    </section>
  )
}

interface MoveCellProps {
  san: string
  ply: number
  assessment?: MoveAssessment
  hint?: HintUsageRecord
  onSelect: (ply: number) => void
}

function MoveCell({ san, ply, assessment, hint, onSelect }: MoveCellProps) {
  if (!san) return <span />
  if (!assessment && !hint) return <span className="move-cell">{san}</span>
  const label = assessment ? MOVE_QUALITY_LABELS[assessment.quality] : ''
  return (
    <button
      type="button"
      className={`move-cell assessed ${assessment?.quality ?? ''}`}
      onClick={() => assessment && onSelect(ply)}
      aria-label={`${san}${assessment ? `，${label}` : ''}${hint ? `，已使用第 ${hint.maxLevel} 级提示` : ''}`}
    >
      <span>{san}</span>
      <small>{assessment ? `${label} · ${formatWhiteEvaluation(assessment.after)}` : ''}{hint ? `${assessment ? ' · ' : ''}已使用提示 L${hint.maxLevel}` : ''}</small>
    </button>
  )
}
