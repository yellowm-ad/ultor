'use client'

// ============================================================================
// 성장 연출(2026-11-03) — 레벨 업 · 장비 강화 결과. 도트 느낌(네모 불티 · 마름모 고리 · 계단식 빛기둥)으로 맞춘다.
//   · LevelUpFx : 주인공 레벨이 오르면 화면 위쪽에 빛기둥 + 「LEVEL UP」 + Lv.a → Lv.b. 입력을 막지 않는다(pointer-events none).
//                 불러오기·새 게임·관리자 레벨 지정처럼 한 번에 크게 뛰는 경우는 건너뛴다.
//   · EnhanceBurst : 강화 메달 위에 겹친다 — 성공(금빛 폭발) · 유지(잿빛 연기) · 하락(붉은 파편).
// 「번쩍임 끄기」(html.no-flash)·동작 줄이기에서는 빛을 약하게/움직임 없이(app/screens.css).
// ============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useGame } from '@/lib/game-state'

/** 결정적 의사난수(같은 i 는 같은 값) */
const rnd = (i: number, s: number) => {
  const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function LevelUpFx() {
  const { state } = useGame()
  const lv = state.player?.level ?? 0
  const screen = state.screen
  const prev = useRef<{ lv: number; screen: string }>({ lv, screen })
  const [show, setShow] = useState<{ k: number; from: number; to: number } | null>(null)

  useEffect(() => {
    const p = prev.current
    prev.current = { lv, screen }
    if (lv <= p.lv) return
    // 타이틀·캐릭터 생성에서 막 들어왔거나(불러오기) 한 번에 10 이상 뛰면(관리자) 연출하지 않는다
    if (p.screen === 'title' || p.screen === 'create' || lv - p.lv >= 10) return
    setShow({ k: Date.now(), from: p.lv, to: lv })
  }, [lv, screen])

  useEffect(() => {
    if (!show) return
    const t = window.setTimeout(() => setShow(null), 2600)
    return () => window.clearTimeout(t)
  }, [show])

  if (!show) return null
  return (
    <div key={show.k} className="lvup-fx" aria-live="polite">
      <div className="lvup-beam" />
      <div className="lvup-ring" />
      <div className="lvup-ring is-late" />
      {Array.from({ length: 22 }, (_, i) => (
        <i
          key={i}
          className="lvup-spark"
          style={
            {
              left: `${50 + (rnd(i, 1) - 0.5) * 34}%`,
              animationDelay: `${120 + rnd(i, 2) * 700}ms`,
              ['--rise' as string]: `${-90 - rnd(i, 3) * 140}px`,
              ['--sz' as string]: `${3 + Math.round(rnd(i, 4) * 3)}px`,
              background: i % 4 === 0 ? '#ffffff' : i % 2 ? '#ffd65a' : '#ffb347',
            } as CSSProperties
          }
        />
      ))}
      <div className="lvup-title">
        <span className="lvup-word">LEVEL UP!</span>
        <span className="lvup-sub">
          Lv.{show.from} <b>→</b> Lv.{show.to}
        </span>
      </div>
    </div>
  )
}

export type EnhanceResult = 'up' | 'down' | 'keep'

export function EnhanceBurst({ kind, enh }: { kind: EnhanceResult; enh: number }) {
  const n = kind === 'up' ? 16 : kind === 'down' ? 12 : 9
  return (
    <div className={`enh-burst is-${kind}`} aria-hidden>
      {kind === 'up' && (
        <>
          <div className="enh-burst-ring" />
          <div className="enh-burst-ring is-late" />
          <div className="enh-burst-rays" />
        </>
      )}
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + rnd(i, 7) * 0.4
        const d = (kind === 'keep' ? 18 : 42) + rnd(i, 8) * (kind === 'keep' ? 16 : 30)
        return (
          <i
            key={i}
            className="enh-burst-bit"
            style={
              {
                ['--bx' as string]: `${Math.cos(a) * d}px`,
                ['--by' as string]: `${Math.sin(a) * d - (kind === 'keep' ? 26 : 0)}px`,
                ['--sz' as string]: `${kind === 'keep' ? 7 + Math.round(rnd(i, 9) * 5) : 3 + Math.round(rnd(i, 9) * 3)}px`,
                animationDelay: `${rnd(i, 10) * 120}ms`,
              } as CSSProperties
            }
          />
        )
      })}
      <span className="enh-burst-label">{kind === 'up' ? `강화 성공! +${enh}` : kind === 'down' ? `하락… +${enh}` : '실패 — 단계 유지'}</span>
    </div>
  )
}
