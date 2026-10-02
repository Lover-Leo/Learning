import { describe, expect, it } from 'vitest'
import { generateTeachingText } from './explanation'

const cp = { type: 'cp' as const, value: 30 }

describe('可验证的中文教学解释', () => {
  it('将军走法只说明真实将军事实', () => {
    const text = generateTeachingText('4k3/8/8/8/8/8/4R3/4K3 w - - 0 1', 'e2e7', 'Re7+', cp, ['Re7+'])
    expect(text?.direction).toContain('将军')
    expect(text?.explanation).toContain('会将军')
  })

  it('吃子会说明被吃棋子', () => {
    const text = generateTeachingText('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1', 'e4d5', 'exd5', cp, ['exd5'])
    expect(text?.explanation).toContain('吃掉对方的兵')
  })

  it('王车易位说明可验证的王安全与出车', () => {
    const text = generateTeachingText('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1g1', 'O-O', cp, ['O-O'])
    expect(text?.direction).toContain('王车易位')
    expect(text?.explanation).toContain('王移向更安全')
  })

  it('无法识别具体主题时使用保守解释', () => {
    const text = generateTeachingText('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'a2a3', 'a3', cp, ['a3'])
    expect(text?.direction).toContain('将军、吃子和直接威胁')
    expect(text?.explanation).toContain('当前分析深度')
  })

  it('不会无依据声称叉攻、牵制或必胜', () => {
    const text = generateTeachingText('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'g1f3', 'Nf3', cp, ['Nf3'])!
    expect(`${text.direction}${text.explanation}`).not.toMatch(/叉攻|牵制|一定能赢|唯一好棋/)
  })
})
