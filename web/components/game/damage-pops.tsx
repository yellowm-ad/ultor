'use client'

// 전투 데미지 숫자(2026-11-04) — 화면에 보이는 전투원 HP(battle-screen 의 view, 연출 타격 시점에 맞춘 상태)를
//   직전과 비교해 바뀐 만큼 머리 위로 숫자를 튀운다. 엔진은 건드리지 않는다.
//   · 피해 = 흰 숫자(붉은 테) · 치명타 = 금빛 큰 숫자 + 'CRITICAL' + 흔들림 · 회복 = 초록 +숫자 · 빗나감 = MISS
//   · 치명타·빗나감은 새로 쌓인 전투 로그 문구로 가린다(lib/battle-engine 로그 형식).

import { useEffect, useRef, useState } from 'react'
import type { BattleLogEntry, Combatant } from '@/lib/types'

type Pop = { id: number; uid: string; kind: 'dmg' | 'crit' | 'heal' | 'miss'; amount: number; t: number; jitter: number; stack: number }

const CRIT_RE = /! (.+?)에게 (\d+)의 피해 \(치명타!\)/
let seq = 0

export function DamagePopLayer({
  combatants,
  log,
  posOf,
  missTargets,
  liftOf,
}: {
  combatants: Combatant[]
  log: BattleLogEntry[]
  posOf: (uid: string) => { left: number; top: number } | undefined
  /** 직전 행동의 대상(빗나감 표시용) */
  missTargets: string[]
  /** 발밑에서 숫자를 띄울 높이(무대 %) */
  liftOf: (uid: string) => number
}) {
  const prev = useRef<Map<string, number> | null>(null)
  const seen = useRef<string | null>(null)
  // 다단 히트 — 치명타 표시는 그 행동의 모든 타에 이어 붙인다(새 로그가 오면 갱신)
  const lastCrits = useRef<Set<string>>(new Set())
  const [pops, setPops] = useState<Pop[]>([])

  useEffect(() => {
    const cur = new Map(combatants.map((c) => [c.uid, c.hp]))
    if (!prev.current) {
      prev.current = cur
      seen.current = log[log.length - 1]?.id ?? null
      return
    }
    const at = seen.current ? log.findIndex((l) => l.id === seen.current) : -1
    const fresh = at >= 0 ? log.slice(at + 1) : log.slice(-6)
    seen.current = log[log.length - 1]?.id ?? seen.current
    if (fresh.length) lastCrits.current = new Set(fresh.map((l) => CRIT_RE.exec(l.text)?.[1]).filter((n): n is string => !!n))
    const crits = lastCrits.current
    const missed = fresh.some((l) => l.text.includes('빗나갔다'))
    const now = Date.now()
    const add: Pop[] = []
    const stackOf = new Map<string, number>()
    const push = (uid: string, kind: Pop['kind'], amount: number) => {
      const stack = stackOf.get(uid) ?? 0
      stackOf.set(uid, stack + 1)
      add.push({ id: ++seq, uid, kind, amount, t: now, jitter: (Math.random() - 0.5) * 5, stack })
    }
    for (const c of combatants) {
      const before = prev.current.get(c.uid)
      if (before == null) continue
      const d = c.hp - before
      if (d < 0) push(c.uid, crits.has(c.name) ? 'crit' : 'dmg', -d)
      else if (d > 0) push(c.uid, 'heal', d)
    }
    if (missed) for (const uid of missTargets) if (!add.some((p) => p.uid === uid)) push(uid, 'miss', 0)
    prev.current = cur
    if (!add.length) return
    setPops((p) => [...p.filter((x) => now - x.t < 1600), ...add])
    const id = window.setTimeout(() => setPops((p) => p.filter((x) => Date.now() - x.t < 1600)), 1700)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combatants, log])

  return (
    <div className="dmg-layer" aria-hidden>
      {pops.map((p) => {
        const pos = posOf(p.uid)
        if (!pos) return null
        return (
          <span
            key={p.id}
            className={`dmg-pop is-${p.kind}`}
            style={{ left: `${pos.left + p.jitter}%`, top: `${pos.top - liftOf(p.uid) - p.stack * 6}%`, animationDelay: `${p.stack * 90}ms` }}
          >
            {p.kind === 'crit' && <small>CRITICAL</small>}
            {p.kind === 'miss' ? 'MISS' : p.kind === 'heal' ? `+${p.amount}` : p.amount}
          </span>
        )
      })}
    </div>
  )
}
