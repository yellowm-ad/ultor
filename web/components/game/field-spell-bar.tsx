'use client'

// 탐사 마법 줄(lib/field-spells) — 화면 오른쪽 아래. 누르거나 숫자 키 1~5. 배우기 전엔 자물쇠·배우는 레벨,
// 지속형은 켜져 있는 동안 남은 시간을 띄운다. 투명한 물약으로 투명해진 것도 투명화 칸에 같이 보인다.
import { useEffect, useState } from 'react'
import type { GameState } from '@/lib/types'
import { FIELD_SPELLS, type FieldSpellId } from '@/lib/field-spells'

const untilOf = (s: GameState, id: FieldSpellId) => (id === 'vanish' ? s.invisibleUntil : id === 'haste' ? s.hasteUntil : id === 'light' ? s.lightUntil : undefined)
const fmt = (ms: number) => {
  const t = Math.ceil(ms / 1000)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

export function FieldSpellBar({ state, onCast, raised }: { state: GameState; onCast: (id: FieldSpellId) => void; raised?: boolean }) {
  // 남은 시간 표시용 1초 시계(켜진 효과가 있을 때만)
  const anyOn = FIELD_SPELLS.some((s) => (untilOf(state, s.id) ?? 0) > Date.now())
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!anyOn) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [anyOn])

  return (
    <div className={`field-spell-bar pointer-events-auto absolute right-3 z-20 ${raised ? 'bottom-14' : 'bottom-3'}`} role="toolbar" aria-label="탐사 마법">
      <span className="field-spell-title">탐사 마법</span>
      {FIELD_SPELLS.map((sp, i) => {
        const locked = state.player.level < sp.level
        const left = (untilOf(state, sp.id) ?? 0) - now
        const on = left > 0
        const poor = !locked && state.player.mp < sp.mp
        return (
          <button
            key={sp.id}
            type="button"
            className={`field-spell ${locked ? 'is-locked' : ''} ${on ? 'is-on' : ''} ${poor ? 'is-poor' : ''}`}
            title={`${i + 1} · ${sp.name} (MP ${sp.mp}${locked ? ` · Lv.${sp.level}에 배움` : ''})\n${sp.desc}`}
            onClick={() => onCast(sp.id)}
          >
            <span className="field-spell-key">{i + 1}</span>
            <span className="field-spell-icon" aria-hidden>{locked ? '🔒' : sp.icon}</span>
            <span className="field-spell-name">{sp.name}</span>
            <span className="field-spell-sub">{locked ? `Lv.${sp.level}` : on ? fmt(left) : `MP ${sp.mp}`}</span>
          </button>
        )
      })}
    </div>
  )
}
