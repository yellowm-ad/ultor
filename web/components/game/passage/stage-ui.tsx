'use client'

// 첫 이동 스테이지 공용 HUD · 터치 버튼(중세풍 도트 UI — app/globals.css 의 .pst-*)
import type { Key } from './px-engine'

export function StageHud({
  lives,
  maxLives = 3,
  items = [],
  bars = [],
  progress,
}: {
  lives?: number
  maxLives?: number
  items?: { label: string; value: string }[]
  bars?: { label: string; v: number; tone: 'warm' | 'food' | 'torch' | 'sea' }[]
  progress?: { label: string; pct: number }
}) {
  return (
    <div className="pst-hud">
      {lives !== undefined && (
        <span className="pst-chip">
          {Array.from({ length: maxLives }, (_, i) => (
            <i key={i} className={`pst-heart ${i < lives ? 'is-on' : ''}`} />
          ))}
        </span>
      )}
      {items.map((it) => (
        <span key={it.label} className="pst-chip">
          <em>{it.label}</em>
          <b>{it.value}</b>
        </span>
      ))}
      {bars.map((b) => (
        <span key={b.label} className="pst-chip">
          <em>{b.label}</em>
          <span className={`pst-gauge is-${b.tone}`}>
            <span style={{ width: `${Math.max(0, Math.min(100, b.v))}%` }} />
          </span>
        </span>
      ))}
      {progress && (
        <span className="pst-chip is-grow">
          <em>{progress.label}</em>
          <span className="pst-gauge is-gold">
            <span style={{ width: `${Math.max(0, Math.min(100, progress.pct))}%` }} />
          </span>
        </span>
      )}
    </div>
  )
}

export function TouchPad({ buttons, onTap }: { buttons: { k: Key; label: string; sub?: string; big?: boolean }[]; onTap: (k: Key) => void }) {
  return (
    <div className="pst-pad">
      {buttons.map((b) => (
        <button
          key={b.k}
          type="button"
          className={`pst-btn ${b.big ? 'is-big' : ''}`}
          onPointerDown={(e) => {
            e.preventDefault()
            onTap(b.k)
          }}
        >
          <span>{b.label}</span>
          {b.sub && <small>{b.sub}</small>}
        </button>
      ))}
    </div>
  )
}
