'use client'

// ============================================================================
// 수업 미니게임 5종(통합 PRD §16~20) — 퀴즈 · 마법 리듬 · 영창 암기 · 실습 도구 뽑기 · 시약 합성
// 모두 onDone(score 0~100, 판정 라벨) 로 끝난다. 실패해도 수업은 수료(§16).
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { mulberry32 } from '@/lib/rng'
import type { MiniGameType, RhythmStyle, MasteryField } from '@/lib/curriculum'
import {
  ALCHEMY_RECIPES,
  buildRhythmChart,
  chantLength,
  chantSetFor,
  CHANT_SETS,
  DRAW_RARITY_META,
  DRAW_TABLE,
  QUIZ_BANK,
  QUIZ_CATEGORY_LABEL,
  REAGENTS,
  RHYTHM_KEYS,
  RHYTHM_STYLE_META,
  RHYTHM_WINDOWS,
  type QuizCategory,
  type RhythmNote,
} from '@/lib/class-content'
import { itemById } from '@/lib/mock-data'

export interface MiniGameProps {
  seed: number
  year: number
  style: RhythmStyle
  field: MasteryField
  courseId: string
  onDone: (score: number, label: string) => void
  /** 미니게임에서 얻은 아이템(뽑기·합성) */
  onGrant: (items: { itemId: string; qty: number }[]) => void
  /** 라운드 번호(0부터) — 라운드가 오를수록 조금씩 어려워진다 */
  round?: number
}

const UI = '/images/class/ui/'

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 라운드 수 — 빨리 끝나는 게임 5라운드, 한 판이 긴 게임 3라운드.
 * 최종 점수 = 라운드 평균, 판정 라벨은 평균 점수로 다시 매긴다.
 */
export const MINIGAME_ROUNDS: Record<MiniGameType, number> = { chant: 5, draw: 5, quiz: 3, rhythm: 3, alchemy: 3 }

function roundLabel(type: MiniGameType, score: number): string {
  if (type === 'rhythm') return score >= 95 ? 'PERFECT' : score >= 80 ? 'GREAT' : score >= 60 ? 'GOOD' : 'MISS'
  if (type === 'draw') return score >= 85 ? 'LUCKY' : 'PASS'
  return score >= 90 ? 'PERFECT' : score >= 75 ? 'GREAT' : score >= 50 ? 'PASS' : 'FAIL'
}

export function MiniGame({ type, seed, onDone, ...p }: MiniGameProps & { type: MiniGameType }) {
  const total = MINIGAME_ROUNDS[type]
  const [round, setRound] = useState(0)
  const [results, setResults] = useState<{ score: number; label: string }[]>([])
  const [between, setBetween] = useState<{ score: number; label: string } | null>(null)
  const finish = (score: number, label: string) => {
    const next = [...results, { score, label }]
    setResults(next)
    if (next.length >= total) {
      const avg = Math.round(next.reduce((a, b) => a + b.score, 0) / next.length)
      onDone(avg, roundLabel(type, avg))
    } else {
      setBetween({ score, label })
    }
  }
  return (
    <div>
      <div className="mg-rounds">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`mg-round-pip ${i < results.length ? 'done' : i === round ? 'now' : ''}`} title={results[i] ? `${results[i].score}점` : ''}>
            {results[i] ? results[i].score : i + 1}
          </span>
        ))}
        <span className="mg-round-label">
          ROUND {Math.min(round + 1, total)}/{total}
        </span>
      </div>
      {between ? (
        <div className="mg-board flex flex-col items-center gap-2 p-6 text-center">
          <div className="text-xs tracking-[0.3em] text-[#d8c79c]">ROUND {round + 1} 결과</div>
          <div className="mg-judge" data-j={between.label}>
            {between.label}
          </div>
          <div className="text-sm text-[#f3e6c4]">{between.score}점</div>
          <button
            className="mg-btn mg-btn-gold mt-2"
            onClick={() => {
              setBetween(null)
              setRound((r) => r + 1)
            }}
          >
            다음 라운드 ▶
          </button>
        </div>
      ) : (
        <SingleGame key={round} type={type} {...p} seed={seed + round * 104729} round={round} onDone={finish} />
      )}
    </div>
  )
}

function SingleGame({ type, ...p }: MiniGameProps & { type: MiniGameType }) {
  switch (type) {
    case 'quiz':
      return <QuizGame {...p} />
    case 'rhythm':
      return <RhythmGame {...p} />
    case 'chant':
      return <ChantGame {...p} />
    case 'draw':
      return <DrawGame {...p} />
    case 'alchemy':
      return <AlchemyGame {...p} />
  }
}

function DoneButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mg-btn mg-btn-gold mt-3">
      {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 지식 퀴즈
// ─────────────────────────────────────────────────────────────────────────────
const FIELD_QUIZ_CATS: Record<MasteryField, QuizCategory[]> = {
  magic: ['magic', 'magic', 'world', 'math', 'manners'],
  combat: ['magic', 'world', 'nature', 'ethics', 'math'],
  life: ['nature', 'nature', 'math', 'time', 'ethics'],
  craft: ['math', 'math', 'magic', 'manners', 'time'],
  liberal: ['world', 'world', 'time', 'ethics', 'manners'],
}
const QUIZ_COUNT = 4 // 라운드당(3라운드 = 12문제)
const QUIZ_TIME = 15

function QuizGame({ seed, year, field, onDone }: MiniGameProps) {
  const questions = useMemo(() => {
    const rand = mulberry32(seed ^ 0x51a3)
    const pool = QUIZ_BANK.filter((q) => (q.minYear ?? 1) <= year)
    const used = new Set<string>()
    const out = []
    for (const cat of shuffle(FIELD_QUIZ_CATS[field], rand)) {
      const cands = shuffle(pool.filter((q) => q.cat === cat && !used.has(q.id)), rand)
      const q = cands[0] ?? shuffle(pool.filter((x) => !used.has(x.id)), rand)[0]
      if (!q) continue
      used.add(q.id)
      // 보기 순서도 섞는다
      const order = shuffle(q.choices.map((_, i) => i), rand)
      out.push({ ...q, choices: order.map((i) => q.choices[i]), answer: order.indexOf(q.answer) })
    }
    return out.slice(0, QUIZ_COUNT)
  }, [seed, year, field])
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const [timeLeft, setTimeLeft] = useState(QUIZ_TIME)
  const [timeBonus, setTimeBonus] = useState(0)
  const finished = idx >= questions.length
  const q = questions[idx]

  useEffect(() => {
    if (finished || picked != null) return
    if (timeLeft <= 0) {
      setPicked(-1)
      return
    }
    const t = setTimeout(() => setTimeLeft((x) => x - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, picked, finished])

  useEffect(() => {
    if (picked == null) return
    const t = setTimeout(() => {
      setIdx((i) => i + 1)
      setPicked(null)
      setTimeLeft(QUIZ_TIME)
    }, 1100)
    return () => clearTimeout(t)
  }, [picked])

  function choose(i: number) {
    if (picked != null) return
    setPicked(i)
    if (i === q.answer) {
      setCorrect((c) => c + 1)
      setTimeBonus((b) => b + timeLeft)
    }
  }

  if (finished) {
    const score = Math.min(100, Math.round((correct / questions.length) * 92 + (timeBonus / (QUIZ_TIME * questions.length)) * 8))
    const label = correct === questions.length ? 'PERFECT' : correct >= 4 ? 'GREAT' : correct >= 3 ? 'PASS' : 'FAIL'
    return (
      <div className="mg-board flex flex-col items-center gap-2 p-6 text-center">
        <div className="mg-judge" data-j={label}>{label}</div>
        <div className="text-sm text-[#f3e6c4]">{questions.length}문제 중 {correct}문제 정답</div>
        <DoneButton label="결과 제출" onClick={() => onDone(score, label)} />
      </div>
    )
  }
  return (
    <div className="mg-board flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between text-xs text-[#d8c79c]">
        <span>
          문제 {idx + 1}/{questions.length} · {QUIZ_CATEGORY_LABEL[q.cat]}
        </span>
        <span className={`mg-timer ${timeLeft <= 5 ? 'mg-timer-low' : ''}`}>⏳ {timeLeft}</span>
      </div>
      <div className="mg-chalk min-h-[64px] text-[15px] leading-relaxed">{q.q}</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {q.choices.map((c, i) => {
          const state = picked == null ? '' : i === q.answer ? 'mg-choice-right' : i === picked ? 'mg-choice-wrong' : 'opacity-60'
          return (
            <button key={i} onClick={() => choose(i)} className={`mg-choice ${state}`}>
              <span className="mg-choice-no">{'ABCD'[i]}</span>
              {c}
            </button>
          )
        })}
      </div>
      <div className="mg-progress">
        <div style={{ width: `${(timeLeft / QUIZ_TIME) * 100}%` }} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. 마법 리듬 실습 — 4레인 낙하, D F J K(또는 레인 클릭)
// ─────────────────────────────────────────────────────────────────────────────
type Judge = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS'
const JUDGE_POINT: Record<Judge, number> = { PERFECT: 100, GREAT: 80, GOOD: 50, MISS: 0 }
const LANE_H = 360
const JUDGE_Y = 300
const FALL_MS = 1400

function RhythmGame({ seed, year, style, onDone, round = 0 }: MiniGameProps) {
  const chart = useMemo(() => buildRhythmChart(style, year, mulberry32(seed ^ 0x7e11), round), [seed, year, style, round])
  const meta = RHYTHM_STYLE_META[style]
  const [started, setStarted] = useState(false)
  const [now, setNow] = useState(0)
  const startRef = useRef(0)
  const hitRef = useRef<Map<number, Judge | 'FAKE'>>(new Map())
  const [, force] = useState(0)
  const [pop, setPop] = useState<{ j: string; lane: number; at: number } | null>(null)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [pressed, setPressed] = useState<boolean[]>([false, false, false, false])
  const endAt = (chart[chart.length - 1]?.t ?? 0) + 1200
  const finished = started && now > endAt

  // 시간 루프
  useEffect(() => {
    if (!started || finished) return
    let raf = 0
    const tick = () => {
      const t = performance.now() - startRef.current
      // 놓친 노트(판정창 지남) → MISS
      for (let i = 0; i < chart.length; i++) {
        const n = chart[i]
        if (hitRef.current.has(i) || n.fake) continue
        if (t - n.t > RHYTHM_WINDOWS.good) {
          hitRef.current.set(i, 'MISS')
          setCombo(0)
        }
      }
      setNow(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [started, finished, chart])

  function hit(lane: number) {
    if (!started || finished) return
    const t = performance.now() - startRef.current
    let best = -1
    let bestD = Infinity
    chart.forEach((n, i) => {
      if (n.lane !== lane || hitRef.current.has(i)) return
      const d = Math.abs(t - n.t)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    if (best < 0 || bestD > RHYTHM_WINDOWS.good + 40) return
    const n = chart[best]
    if (n.fake) {
      hitRef.current.set(best, 'FAKE')
      setCombo(0)
      setPop({ j: '환영!', lane, at: t })
      force((x) => x + 1)
      return
    }
    const j: Judge = bestD <= RHYTHM_WINDOWS.perfect ? 'PERFECT' : bestD <= RHYTHM_WINDOWS.great ? 'GREAT' : 'GOOD'
    hitRef.current.set(best, j)
    setCombo((c) => {
      const nc = c + 1
      setMaxCombo((m) => Math.max(m, nc))
      return nc
    })
    setPop({ j, lane, at: t })
    force((x) => x + 1)
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const lane = RHYTHM_KEYS.indexOf(e.key.toLowerCase())
      if (lane < 0 || e.repeat) return
      e.preventDefault()
      setPressed((p) => p.map((v, i) => (i === lane ? true : v)))
      hit(lane)
    }
    const up = (e: KeyboardEvent) => {
      const lane = RHYTHM_KEYS.indexOf(e.key.toLowerCase())
      if (lane >= 0) setPressed((p) => p.map((v, i) => (i === lane ? false : v)))
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  })

  const real = chart.filter((n) => !n.fake).length
  const results = [...hitRef.current.entries()]
  const points = results.reduce((a, [, j]) => a + (j === 'FAKE' ? -40 : JUDGE_POINT[j as Judge] ?? 0), 0)
  const count = (j: Judge) => results.filter(([, x]) => x === j).length
  const score = Math.max(0, Math.min(100, Math.round(points / Math.max(1, real))))

  if (!started) {
    return (
      <div className="mg-board flex flex-col items-center gap-3 p-6 text-center">
        <div className="text-sm text-[#f3e6c4]">
          마력 노드가 <b>판정선(마법진)</b>에 닿는 순간 해당 레인 키를 누르세요.
        </div>
        <div className="flex gap-2">
          {RHYTHM_KEYS.map((k) => (
            <span key={k} className="mg-key">{k.toUpperCase()}</span>
          ))}
        </div>
        <div className="text-xs" style={{ color: meta.color }}>
          이번 실습: {meta.label}
          {style === 'dark' && ' — 보랏빛 흐릿한 환영 노트는 누르지 마세요!'}
        </div>
        <button
          className="mg-btn mg-btn-gold"
          onClick={() => {
            startRef.current = performance.now()
            setStarted(true)
          }}
        >
          시전 시작
        </button>
      </div>
    )
  }
  if (finished) {
    const label = score >= 95 ? 'PERFECT' : score >= 80 ? 'GREAT' : score >= 60 ? 'GOOD' : 'MISS'
    return (
      <div className="mg-board flex flex-col items-center gap-2 p-6 text-center">
        <div className="mg-judge" data-j={label}>{label}</div>
        <div className="grid grid-cols-4 gap-3 text-xs text-[#f3e6c4]">
          <span>PERFECT {count('PERFECT')}</span>
          <span>GREAT {count('GREAT')}</span>
          <span>GOOD {count('GOOD')}</span>
          <span>MISS {count('MISS')}</span>
        </div>
        <div className="text-xs text-[#d8c79c]">최대 콤보 {maxCombo} · 정확도 {score}%</div>
        <DoneButton label="주문 완성" onClick={() => onDone(score, label)} />
      </div>
    )
  }
  return (
    <div className="mg-board p-4">
      <div className="mb-2 flex justify-between text-xs text-[#d8c79c]">
        <span style={{ color: meta.color }}>{meta.label}</span>
        <span>COMBO {combo}</span>
      </div>
      <div className="mg-rhythm-field" style={{ height: LANE_H }}>
        {[0, 1, 2, 3].map((lane) => (
          <div key={lane} className={`mg-lane ${pressed[lane] ? 'mg-lane-on' : ''}`} onMouseDown={() => hit(lane)} onTouchStart={() => hit(lane)}>
            {chart.map((n: RhythmNote, i) => {
              if (n.lane !== lane) return null
              const res = hitRef.current.get(i)
              if (res && res !== 'MISS') return null
              const y = JUDGE_Y - ((n.t - now) / FALL_MS) * JUDGE_Y
              if (y < -40 || y > LANE_H + 20) return null
              return (
                <img
                  key={i}
                  src={`${UI}note_orb.png`}
                  alt=""
                  className="mg-note"
                  style={{
                    top: y - 18,
                    filter: n.fake ? 'grayscale(0.4) hue-rotate(220deg) opacity(0.45) blur(0.6px)' : `drop-shadow(0 0 6px ${meta.color})`,
                    opacity: res === 'MISS' ? 0.25 : 1,
                  }}
                />
              )
            })}
            <img src={`${UI}hit_ring.png`} alt="" className="mg-hitring" style={{ top: JUDGE_Y - 22 }} />
            <span className="mg-lane-key">{RHYTHM_KEYS[lane].toUpperCase()}</span>
            {pop && pop.lane === lane && now - pop.at < 450 && (
              <span className="mg-pop" data-j={pop.j} style={{ top: JUDGE_Y - 60 }}>
                {pop.j}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. 영창 암기 — 순서를 외운 뒤 숨김 → 올바른 순서로 배치
// ─────────────────────────────────────────────────────────────────────────────
function ChantGame({ seed, year, style, courseId, onDone, round = 0 }: MiniGameProps) {
  const { answer, tiles, showMs } = useMemo(() => {
    const rand = mulberry32(seed ^ 0xc4a7)
    const set = chantSetFor(style, courseId)
    const n = Math.min(set.length, chantLength(year, rand) + Math.floor(round / 2))
    // 영창은 술식 순서를 유지한 채 n개를 고른다
    const keep = shuffle(set.map((_, i) => i), rand).slice(0, n).sort((a, b) => a - b)
    const answer = keep.map((i) => set[i])
    // 4학년: 유사 패턴(다른 원소의 비슷한 조각) 2개 섞기
    const decoys = year >= 4 ? shuffle(Object.values(CHANT_SETS).flat().filter((x) => !set.includes(x)), rand).slice(0, 2) : []
    return { answer, tiles: shuffle([...answer, ...decoys], rand), showMs: 2200 + n * 700 }
  }, [seed, year, style, courseId, round])
  const [phase, setPhase] = useState<'show' | 'input' | 'done'>('show')
  const [placed, setPlaced] = useState<string[]>([])
  const [mistakes, setMistakes] = useState(0)
  const [shake, setShake] = useState<string | null>(null)
  const [left, setLeft] = useState(Math.ceil(showMs / 1000))
  const startInput = useRef(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (phase !== 'show') return
    if (left <= 0) {
      setPhase('input')
      startInput.current = performance.now()
      return
    }
    const t = setTimeout(() => setLeft((x) => x - 1), 1000)
    return () => clearTimeout(t)
  }, [left, phase])

  function pick(tile: string) {
    if (phase !== 'input' || placed.includes(tile)) return
    if (answer[placed.length] === tile) {
      const next = [...placed, tile]
      setPlaced(next)
      if (next.length === answer.length) {
        setElapsed((performance.now() - startInput.current) / 1000)
        setPhase('done')
      }
    } else {
      setMistakes((m) => m + 1)
      setShake(tile)
      setTimeout(() => setShake(null), 380)
    }
  }

  if (phase === 'done') {
    const timePenalty = Math.max(0, elapsed - answer.length * 2.5) * 1.5
    const score = Math.max(0, Math.round(100 - mistakes * 14 - timePenalty))
    const label = mistakes === 0 && score >= 90 ? 'PERFECT' : score >= 75 ? 'GREAT' : score >= 50 ? 'PASS' : 'FAIL'
    return (
      <div className="mg-board flex flex-col items-center gap-2 p-6 text-center">
        <div className="mg-judge" data-j={label}>{label}</div>
        <div className="text-xs text-[#f3e6c4]">
          영창 {answer.length}구절 · 실수 {mistakes}회 · {elapsed.toFixed(1)}초
        </div>
        <DoneButton label="영창 완료" onClick={() => onDone(score, label)} />
      </div>
    )
  }
  return (
    <div className="mg-board flex flex-col gap-3 p-5">
      <div className="text-center text-xs text-[#d8c79c]">{phase === 'show' ? `영창 순서를 외우세요 — ${left}초` : '순서대로 구절을 고르세요'}</div>
      <div className="flex flex-wrap justify-center gap-2">
        {answer.map((a, i) => (
          <div key={i} className="mg-rune">
            <span className="mg-rune-no">{i + 1}</span>
            <span>{phase === 'show' ? a : placed[i] ?? '？'}</span>
          </div>
        ))}
      </div>
      {phase === 'input' && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {tiles.map((t) => (
            <button key={t} disabled={placed.includes(t)} onClick={() => pick(t)} className={`mg-tile ${placed.includes(t) ? 'opacity-30' : ''} ${shake === t ? 'mg-shake' : ''}`}>
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. 실습 도구 뽑기 — 3번 뽑는다(현금 가챠 아님 · 수업 실습물)
// ─────────────────────────────────────────────────────────────────────────────
const DRAWS = 1 // 라운드당(5라운드 = 5번)
function DrawGame({ seed, onDone, onGrant }: MiniGameProps) {
  const pulls = useMemo(() => {
    const rand = mulberry32(seed ^ 0xd2a3)
    const valid = DRAW_TABLE.filter((e) => itemById(e.itemId))
    const total = valid.reduce((a, b) => a + b.weight, 0)
    return Array.from({ length: DRAWS }, () => {
      let r = rand() * total
      for (const e of valid) {
        r -= e.weight
        if (r <= 0) return e
      }
      return valid[0]
    })
  }, [seed])
  const [opened, setOpened] = useState(0)
  const [anim, setAnim] = useState<'idle' | 'shake' | 'open'>('idle')
  const granted = useRef(false)

  function pull() {
    if (anim !== 'idle' || opened >= DRAWS) return
    setAnim('shake')
    setTimeout(() => setAnim('open'), 700)
    setTimeout(() => {
      setOpened((o) => o + 1)
      setAnim('idle')
    }, 1500)
  }
  const done = opened >= DRAWS
  useEffect(() => {
    if (done && !granted.current) {
      granted.current = true
      onGrant(pulls.map((p) => ({ itemId: p.itemId, qty: p.qty })))
    }
  }, [done, pulls, onGrant])
  const current = anim === 'open' ? pulls[opened] : null
  const score = Math.round(pulls.reduce((a, p) => a + DRAW_RARITY_META[p.rarity].score, 0) / DRAWS)
  const best = pulls.some((p) => p.rarity === 'odd') ? '수상한 발견!' : pulls.some((p) => p.rarity === 'rare') ? 'LUCKY' : 'PASS'
  return (
    <div className="mg-board flex flex-col items-center gap-3 p-5">
      <div className="text-xs text-[#d8c79c]">수업용 실습 상자 — 상자를 열어 이번 실습 재료를 뽑는다</div>
      <div className="relative flex h-36 w-full items-center justify-center">
        <img src={`${UI}${anim === 'open' ? 'chest_open' : 'chest_closed'}.png`} alt="" className={`mg-chest ${anim === 'shake' ? 'mg-chest-shake' : ''}`} />
        {current && (
          <div className="mg-reveal" style={{ ['--rar' as string]: DRAW_RARITY_META[current.rarity].color }}>
            <Image src={itemById(current.itemId)!.icon} alt="" width={40} height={40} unoptimized />
          </div>
        )}
      </div>
      <div className="flex min-h-[72px] flex-wrap justify-center gap-2">
        {pulls.slice(0, opened).map((p, i) => (
          <div key={i} className="mg-draw-card" style={{ borderColor: DRAW_RARITY_META[p.rarity].color }}>
            <Image src={itemById(p.itemId)!.icon} alt="" width={28} height={28} unoptimized />
            <span className="text-[10px]" style={{ color: DRAW_RARITY_META[p.rarity].color }}>
              {DRAW_RARITY_META[p.rarity].label}
            </span>
            <span className="text-[11px]">
              {itemById(p.itemId)!.name} ×{p.qty}
            </span>
            <span className="text-[9px] opacity-70">{p.note}</span>
          </div>
        ))}
      </div>
      {!done ? (
        <button className="mg-btn mg-btn-gold" onClick={pull} disabled={anim !== 'idle'}>
          상자 열기
        </button>
      ) : (
        <DoneButton label="실습 재료 확정" onClick={() => onDone(score, best)} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. 시약 합성 — 재료 2~4개 · 순서 · 온도 · 마나
// ─────────────────────────────────────────────────────────────────────────────
function AlchemyGame({ seed, onDone, onGrant }: MiniGameProps) {
  const recipe = useMemo(() => ALCHEMY_RECIPES[Math.floor(mulberry32(seed ^ 0xa1c3)() * ALCHEMY_RECIPES.length)], [seed])
  const [pot, setPot] = useState<string[]>([])
  const [temp, setTemp] = useState(50)
  const [mana, setMana] = useState(50)
  const [result, setResult] = useState<{ score: number; label: string; kind: 'great' | 'ok' | 'low' | 'boom' } | null>(null)
  const granted = useRef(false)

  function brew() {
    const want = recipe.order
    const setHit = pot.filter((x) => want.includes(x)).length
    const extra = pot.filter((x) => !want.includes(x)).length
    const ing = Math.max(0, (setHit / want.length) * 40 - extra * 10)
    let ord = 0
    for (let i = 0; i < want.length; i++) if (pot[i] === want[i]) ord += 20 / want.length
    const tScore = Math.max(0, 20 * (1 - Math.abs(temp - recipe.temp) / 40))
    const mScore = Math.max(0, 20 * (1 - Math.abs(mana - recipe.mana) / 40))
    const score = Math.round(Math.min(100, ing + ord + tScore + mScore))
    const kind = score >= 88 ? 'great' : score >= 60 ? 'ok' : score >= 35 ? 'low' : 'boom'
    const label = kind === 'great' ? '고급 시약!' : kind === 'ok' ? '기본 시약' : kind === 'low' ? '저급 시약' : '펑! 폭발'
    setResult({ score, label, kind })
    if (score >= 60 && !granted.current) {
      granted.current = true
      onGrant([{ itemId: recipe.rewardItemId, qty: kind === 'great' ? 2 : 1 }])
    }
  }

  return (
    <div className="mg-board flex flex-col gap-3 p-5">
      <div className="mg-scroll">
        <div className="text-sm font-bold">목표: {recipe.name}</div>
        <div className="text-[11px] leading-relaxed opacity-85">{recipe.hint}</div>
      </div>
      <div className="flex items-end gap-4">
        <div className="grid flex-1 grid-cols-3 gap-2">
          {REAGENTS.map((r) => (
            <button key={r.id} disabled={!!result || pot.length >= 4} onClick={() => setPot((p) => [...p, r.id])} className="mg-reagent">
              {itemById(r.itemIcon) && <Image src={itemById(r.itemIcon)!.icon} alt="" width={28} height={28} unoptimized />}
              <span className="text-[11px]">{r.name}</span>
            </button>
          ))}
        </div>
        <div className="relative flex w-36 flex-col items-center">
          <img src="/images/map/academy/iso_cauldron.png" alt="" className={`mg-cauldron ${result?.kind === 'boom' ? 'mg-boom' : result ? 'mg-bubble' : ''}`} />
          {result?.kind === 'boom' && <div className="mg-smoke" />}
        </div>
      </div>
      <div className="flex min-h-[34px] flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-[#d8c79c]">투입 순서:</span>
        {pot.map((id, i) => (
          <span key={i} className="mg-chip">
            {i + 1}. {REAGENTS.find((r) => r.id === id)?.name}
          </span>
        ))}
        {pot.length > 0 && !result && (
          <button className="text-[10px] underline opacity-70" onClick={() => setPot((p) => p.slice(0, -1))}>
            되돌리기
          </button>
        )}
      </div>
      <label className="mg-slider">
        <span>🔥 온도 {temp}</span>
        <input type="range" min={0} max={100} value={temp} disabled={!!result} onChange={(e) => setTemp(+e.target.value)} />
      </label>
      <label className="mg-slider">
        <span>✦ 마나 {mana}</span>
        <input type="range" min={0} max={100} value={mana} disabled={!!result} onChange={(e) => setMana(+e.target.value)} />
      </label>
      {!result ? (
        <button className="mg-btn mg-btn-gold self-center" disabled={pot.length < 2} onClick={brew}>
          혼합!
        </button>
      ) : (
        <div className="flex flex-col items-center">
          <div className="mg-judge" data-j={result.kind === 'boom' ? 'FAIL' : result.kind === 'great' ? 'PERFECT' : 'PASS'}>
            {result.label}
          </div>
          {result.score >= 60 && <div className="text-xs text-[#f3e6c4]">{itemById(recipe.rewardItemId)?.name} 획득</div>}
          {result.kind === 'boom' && <div className="text-xs text-[#ffb0a0]">셀린 강사: &ldquo;…다음엔 순서부터 다시 보자.&rdquo;</div>}
          <DoneButton label="결과 제출" onClick={() => onDone(result.score, result.label)} />
        </div>
      )}
    </div>
  )
}
