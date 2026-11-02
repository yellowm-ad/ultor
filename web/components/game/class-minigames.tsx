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
  RHYTHM_CODES,
  RHYTHM_KEYS,
  RHYTHM_STYLE_META,
  RHYTHM_WINDOWS,
  RUNE_PAIRS,
  matchPairCount,
  sigilNodes,
  sigilStartLength,
  SORT_SETS,
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
 * 라운드 수 — 미니게임 한 판이 대략 2~3분(2026-10-07: 퀴즈 4문제×3라운드가 길다는 피드백으로 단축).
 * 시험(중간·기말)은 게임을 2~3개 잇달아 하므로 게임마다 1라운드만 — 시험 전체가 3~4분.
 * 최종 점수 = 라운드 평균, 판정 라벨은 평균 점수로 다시 매긴다.
 */
export const MINIGAME_ROUNDS: Record<MiniGameType, number> = { chant: 3, draw: 3, quiz: 2, rhythm: 2, alchemy: 2, match: 2, sigil: 2, sort: 2 }

function roundLabel(type: MiniGameType, score: number): string {
  if (type === 'rhythm') return score >= 95 ? 'PERFECT' : score >= 80 ? 'GREAT' : score >= 60 ? 'GOOD' : 'MISS'
  if (type === 'draw') return score >= 85 ? 'LUCKY' : 'PASS'
  return score >= 90 ? 'PERFECT' : score >= 75 ? 'GREAT' : score >= 50 ? 'PASS' : 'FAIL'
}

export function MiniGame({ type, seed, onDone, exam, ...p }: MiniGameProps & { type: MiniGameType; exam?: boolean }) {
  const total = exam ? 1 : MINIGAME_ROUNDS[type]
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
    case 'match':
      return <MatchGame {...p} />
    case 'sigil':
      return <SigilGame {...p} />
    case 'sort':
      return <SortGame {...p} />
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
  craft: ['math', 'alchemy', 'magic', 'manners', 'time'],
  liberal: ['world', 'world', 'time', 'ethics', 'manners'],
}
// 2026-10-07 — 몬스터 생태·연금 문제를 계열별로 섞는다
FIELD_QUIZ_CATS.combat.push('monster', 'monster')
FIELD_QUIZ_CATS.life.push('alchemy', 'monster')
FIELD_QUIZ_CATS.magic.push('monster')
const QUIZ_COUNT = 4 // 라운드당(2라운드 = 8문제)
const QUIZ_TIME = 16 // 2026-11-02 난이도 완화: 12 → 16초

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
    const label = correct === questions.length ? 'PERFECT' : correct >= questions.length - 1 ? 'GREAT' : correct >= Math.ceil(questions.length / 2) ? 'PASS' : 'FAIL'
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
// 2. 마법 리듬 실습 — 4레인 낙하, Q W E R(또는 레인 클릭)
// ─────────────────────────────────────────────────────────────────────────────
type Judge = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS'
const JUDGE_POINT: Record<Judge, number> = { PERFECT: 100, GREAT: 80, GOOD: 50, MISS: 0 }
const LANE_H_MAX = 360
/** 레인 높이 — 폰 가로처럼 세로가 낮은 화면에선 줄인다(판정선이 화면 밖으로 잘렸다, 2026-10-18). 판정선은 바닥에서 60px 위 */
const laneHeight = () => (typeof window === 'undefined' ? LANE_H_MAX : Math.max(200, Math.min(LANE_H_MAX, window.innerHeight - 150)))
const FALL_MS = 1650 // 노트가 조금 천천히(1400 → 1650)

function RhythmGame({ seed, year, style, onDone, round = 0 }: MiniGameProps) {
  const chart = useMemo(() => buildRhythmChart(style, year, mulberry32(seed ^ 0x7e11), round), [seed, year, style, round])
  const meta = RHYTHM_STYLE_META[style]
  const [LANE_H] = useState(laneHeight)
  const JUDGE_Y = LANE_H - 60
  const [started, setStarted] = useState(false)
  // 2026-11-02 최적화 — 매 프레임 React 를 다시 그리지 않는다. 시간은 ref, 노트는 캔버스(RhythmField)가 그린다
  const nowRef = useRef(0)
  const [ended, setEnded] = useState(false)
  const startRef = useRef(0)
  const hitRef = useRef<Map<number, Judge | 'FAKE'>>(new Map())
  const [, force] = useState(0)
  const [pop, setPop] = useState<{ j: string; lane: number; at: number } | null>(null)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [pressed, setPressed] = useState<boolean[]>([false, false, false, false])
  const endAt = (chart[chart.length - 1]?.t ?? 0) + 1200
  const finished = started && ended

  // 시간 루프
  useEffect(() => {
    if (!started || finished) return
    let raf = 0
    const tick = () => {
      const t = performance.now() - startRef.current
      // 놓친 노트(판정창 지남) → MISS
      let missed = false
      for (let i = 0; i < chart.length; i++) {
        const n = chart[i]
        if (n.t - t > FALL_MS) break // 차트는 시간순 — 아직 안 내려온 노트는 볼 필요 없다
        if (hitRef.current.has(i) || n.fake) continue
        if (t - n.t > RHYTHM_WINDOWS.good) {
          hitRef.current.set(i, 'MISS')
          missed = true
        }
      }
      if (missed) setCombo(0)
      nowRef.current = t
      if (t > endAt) {
        setEnded(true)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [started, finished, chart, endAt])

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
    // 리듬 실습 중엔 Q/W/E/R 를 이 게임이 독점 — 캡처 단계에서 먼저 받아 이동(W)·상호작용(E) 등 다른 단축키로 새지 않게 막는다
    const down = (e: KeyboardEvent) => {
      const lane = RHYTHM_CODES.indexOf(e.code)
      if (lane < 0) return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (e.repeat) return
      setPressed((p) => p.map((v, i) => (i === lane ? true : v)))
      hit(lane)
    }
    const up = (e: KeyboardEvent) => {
      const lane = RHYTHM_CODES.indexOf(e.code)
      if (lane < 0) return
      e.stopImmediatePropagation()
      setPressed((p) => p.map((v, i) => (i === lane ? false : v)))
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
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
      <RhythmField
        height={LANE_H}
        judgeY={JUDGE_Y}
        chart={chart}
        style={style}
        color={meta.color}
        nowRef={nowRef}
        hitRef={hitRef}
        pressed={pressed}
        pop={pop}
        onLane={hit}
      />
    </div>
  )
}

/**
 * 리듬 레인(캔버스) — 속성별 도트 마력 구슬(PixelLab)이 떨어지고, 판정선 마법진에서 터진다.
 * 매 프레임 DOM 을 만들지 않으므로 휴대폰에서도 가볍다(2026-11-02).
 */
function RhythmField({
  height,
  judgeY,
  chart,
  style,
  color,
  nowRef,
  hitRef,
  pressed,
  pop,
  onLane,
}: {
  height: number
  judgeY: number
  chart: RhythmNote[]
  style: RhythmStyle
  color: string
  nowRef: React.RefObject<number>
  hitRef: React.RefObject<Map<number, Judge | 'FAKE'>>
  pressed: boolean[]
  pop: { j: string; lane: number; at: number } | null
  onLane: (lane: number) => void
}) {
  const cv = useRef<HTMLCanvasElement | null>(null)
  const wrap = useRef<HTMLDivElement | null>(null)
  const live = useRef({ pressed, pop })
  useEffect(() => {
    live.current = { pressed, pop }
  })
  useEffect(() => {
    const note = new window.Image()
    note.src = `/images/class/notes/${style}.png`
    const fake = new window.Image()
    fake.src = '/images/class/notes/fake.png'
    const ring = new window.Image()
    ring.src = `${UI}hit_ring.png`
    const c = cv.current!
    const ctx = c.getContext('2d')!
    let raf = 0
    let w = 0
    const bursts: { lane: number; at: number; j: string }[] = []
    let lastPop: unknown = null
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cw = wrap.current?.clientWidth ?? 300
      if (cw !== w) {
        w = cw
        c.width = Math.round(cw * dpr)
        c.height = Math.round(height * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = false
      const now = nowRef.current ?? 0
      const lw = w / 4
      // 바탕 — 레인 4줄, 판정선 쪽으로 갈수록 속성 빛
      ctx.fillStyle = '#0f0c09'
      ctx.fillRect(0, 0, w, height)
      for (let l = 0; l < 4; l++) {
        const x = l * lw
        ctx.fillStyle = live.current.pressed[l] ? 'rgba(240,217,153,0.16)' : l % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.045)'
        ctx.fillRect(x + 2, 0, lw - 4, height)
        ctx.fillStyle = 'rgba(240,217,153,0.14)'
        ctx.fillRect(x, 0, 1, height)
        const g = ctx.createLinearGradient(0, judgeY - 80, 0, judgeY + 10)
        g.addColorStop(0, 'rgba(0,0,0,0)')
        g.addColorStop(1, color + '33')
        ctx.fillStyle = g
        ctx.fillRect(x + 2, judgeY - 80, lw - 4, 90)
      }
      // 판정선 + 마법진 고리 + 키
      ctx.fillStyle = '#b8862e'
      ctx.fillRect(0, judgeY, w, 2)
      ctx.font = 'bold 13px Pretendard, sans-serif'
      ctx.textAlign = 'center'
      for (let l = 0; l < 4; l++) {
        const cx = l * lw + lw / 2
        if (ring.complete && ring.naturalWidth) {
          const rw = 60
          const rh = (ring.naturalHeight / ring.naturalWidth) * rw
          ctx.drawImage(ring, Math.round(cx - rw / 2), Math.round(judgeY - rh / 2), rw, Math.round(rh))
        }
        ctx.fillStyle = '#f0d999'
        ctx.fillText(RHYTHM_KEYS[l].toUpperCase(), cx, height - 8)
      }
      // 노트(차트는 시간순 — 아직 먼 노트에서 멈춘다)
      const hits = hitRef.current
      for (let i = 0; i < chart.length; i++) {
        const n = chart[i]
        if (n.t - now > FALL_MS + 100) break
        const res = hits?.get(i)
        if (res && res !== 'MISS') continue
        const y = judgeY - ((n.t - now) / FALL_MS) * judgeY
        if (y < -40 || y > height + 20) continue
        const im = n.fake ? fake : note
        const cx = n.lane * lw + lw / 2
        ctx.globalAlpha = res === 'MISS' ? 0.25 : n.fake ? 0.5 : 1
        if (im.complete && im.naturalWidth) ctx.drawImage(im, Math.round(cx - 20), Math.round(y - 20), 40, 40)
        else {
          ctx.fillStyle = color
          ctx.fillRect(Math.round(cx - 10), Math.round(y - 10), 20, 20)
        }
        ctx.globalAlpha = 1
      }
      // 판정 — 도트 파편 + 글자
      const p = live.current.pop
      if (p && p !== lastPop) {
        lastPop = p
        bursts.push({ lane: p.lane, at: p.at, j: p.j })
      }
      for (let k = bursts.length - 1; k >= 0; k--) {
        const b = bursts[k]
        const age = now - b.at
        if (age > 450) {
          bursts.splice(k, 1)
          continue
        }
        const cx = b.lane * lw + lw / 2
        const a = 1 - age / 450
        ctx.globalAlpha = a
        ctx.fillStyle = b.j === '환영!' ? '#c08aff' : color
        for (let q = 0; q < 8; q++) {
          const ang = (q / 8) * Math.PI * 2
          const r = 8 + age * 0.08
          ctx.fillRect(Math.round(cx + Math.cos(ang) * r) - 2, Math.round(judgeY + Math.sin(ang) * r * 0.6) - 2, 4, 4)
        }
        ctx.font = 'bold 12px Pretendard, sans-serif'
        ctx.fillStyle = b.j === 'PERFECT' ? '#ffd65a' : b.j === 'GREAT' ? '#8fe08a' : b.j === 'GOOD' ? '#7fc4ff' : '#c08aff'
        ctx.fillText(b.j, cx, judgeY - 40 - age * 0.03)
        ctx.globalAlpha = 1
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [chart, style, color, height, judgeY, nowRef, hitRef])
  return (
    <div ref={wrap} className="mg-rhythm-field" style={{ height, display: 'block' }}>
      <canvas
        ref={cv}
        style={{ width: '100%', height, display: 'block', imageRendering: 'pixelated', touchAction: 'none' }}
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          onLane(Math.max(0, Math.min(3, Math.floor(((e.clientX - r.left) / r.width) * 4))))
        }}
      />
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
    return { answer, tiles: shuffle([...answer, ...decoys], rand), showMs: 3000 + n * 900 }
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
  const recipe = useMemo(() => {
    // 보상 아이템이 실제로 있는 레시피만
    const valid = ALCHEMY_RECIPES.filter((r) => itemById(r.rewardItemId))
    return valid[Math.floor(mulberry32(seed ^ 0xa1c3)() * valid.length)]
  }, [seed])
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
    const tScore = Math.max(0, 20 * (1 - Math.max(0, Math.abs(temp - recipe.temp) - 6) / 44))
    const mScore = Math.max(0, 20 * (1 - Math.max(0, Math.abs(mana - recipe.mana) - 6) / 44))
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
          <img src="/images/class/ui/cauldron.png" alt="" className={`mg-cauldron ${result?.kind === 'boom' ? 'mg-boom' : result ? 'mg-bubble' : ''}`} />
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

// ─────────────────────────────────────────────────────────────────────────────
// 6. 룬 짝맞추기(2026-10-07) — 처음 1.6초 동안 전부 보여 준 뒤 뒤집는다. 두 장씩 열어 같은 룬을 찾는다
// ─────────────────────────────────────────────────────────────────────────────
function MatchGame({ seed, year, onDone }: MiniGameProps) {
  const cards = useMemo(() => {
    const rand = mulberry32(seed ^ 0x3a7c)
    const pairs = shuffle(RUNE_PAIRS, rand).slice(0, matchPairCount(year))
    return shuffle(pairs.flatMap((p, i) => [{ ...p, pair: i, key: `${i}a` }, { ...p, pair: i, key: `${i}b` }]), rand)
  }, [seed, year])
  const [peek, setPeek] = useState(true)
  const [open, setOpen] = useState<number[]>([])
  const [found, setFound] = useState<Set<number>>(new Set())
  const [mistakes, setMistakes] = useState(0)
  const startRef = useRef(0)
  const [elapsed, setElapsed] = useState(0)
  const pairCount = cards.length / 2
  const done = found.size === pairCount

  useEffect(() => {
    const t = setTimeout(() => {
      setPeek(false)
      startRef.current = performance.now()
    }, 2400)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (open.length !== 2) return
    const [a, b] = open
    if (cards[a].pair === cards[b].pair) {
      const next = new Set(found).add(cards[a].pair)
      setFound(next)
      setOpen([])
      if (next.size === pairCount) setElapsed((performance.now() - startRef.current) / 1000)
      return
    }
    setMistakes((m) => m + 1)
    const t = setTimeout(() => setOpen([]), 900)
    return () => clearTimeout(t)
  }, [open, cards, found, pairCount])

  function flip(i: number) {
    if (peek || done || open.length >= 2 || open.includes(i) || found.has(cards[i].pair)) return
    setOpen((o) => [...o, i])
  }

  if (done) {
    // 실수는 짝 수의 절반까지 봐주고, 시간은 짝당 5초 넘게 쓴 만큼 깎는다
    const score = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, mistakes - pairCount / 2) * 7 - Math.max(0, elapsed - pairCount * 5) * 0.8)))
    const label = roundLabel('match', score)
    return (
      <div className="mg-board flex flex-col items-center gap-2 p-6 text-center">
        <div className="mg-judge" data-j={label}>{label}</div>
        <div className="text-xs text-[#f3e6c4]">
          {pairCount}쌍 · 실수 {mistakes}회 · {elapsed.toFixed(1)}초
        </div>
        <DoneButton label="룬 정리 완료" onClick={() => onDone(score, label)} />
      </div>
    )
  }
  return (
    <div className="mg-board flex flex-col gap-3 p-5">
      <div className="flex justify-between text-xs text-[#d8c79c]">
        <span>{peek ? '룬의 자리를 기억하세요…' : '같은 룬 두 장을 찾으세요'}</span>
        <span>
          찾은 짝 {found.size}/{pairCount} · 실수 {mistakes}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 self-center">
        {cards.map((c, i) => {
          const shown = peek || open.includes(i) || found.has(c.pair)
          return (
            <button key={c.key} onClick={() => flip(i)} className={`mg-card ${shown ? 'mg-card-up' : ''} ${found.has(c.pair) ? 'mg-card-done' : ''}`} style={{ ['--rune' as string]: c.color }}>
              {shown ? (
                <>
                  {/* 룬석 도트(PixelLab) — 룬마다 다른 돌 */}
                  <img src={`/images/class/runes/r${Math.max(0, RUNE_PAIRS.findIndex((r) => r.glyph === c.glyph))}.png`} alt={c.glyph} className="mg-card-stone" draggable={false} />
                  <span className="text-[10px] opacity-90">{c.name}</span>
                </>
              ) : (
                <img src="/images/class/cards/back.png" alt="" className="mg-card-backimg" draggable={false} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. 마법진 따라 그리기(2026-10-07) — 꼭짓점이 빛나는 순서를 보고 그대로 잇는다. 한 라운드 = 시도 3번(성공할 때마다 한 획 길어짐)
// ─────────────────────────────────────────────────────────────────────────────
const SIGIL_TRIES = 4
function SigilGame({ seed, year, style, onDone, round = 0 }: MiniGameProps) {
  const n = sigilNodes(year)
  const color = RHYTHM_STYLE_META[style].color
  const rand = useMemo(() => mulberry32(seed ^ 0x51c1), [seed])
  const makeSeq = (len: number) => {
    const out: number[] = []
    while (out.length < len) {
      const v = Math.floor(rand() * n)
      if (v !== out[out.length - 1]) out.push(v)
    }
    return out
  }
  const baseLen = sigilStartLength(year) + round
  const [tryNo, setTryNo] = useState(0)
  const [len, setLen] = useState(baseLen)
  const [seq, setSeq] = useState<number[]>(() => makeSeq(baseLen))
  const [phase, setPhase] = useState<'show' | 'input' | 'ok' | 'fail' | 'done'>('show')
  const [lit, setLit] = useState(-1)
  const [input, setInput] = useState<number[]>([])
  const [scores, setScores] = useState<number[]>([])

  // 순서 보여 주기
  useEffect(() => {
    if (phase !== 'show') return
    const timers: number[] = []
    seq.forEach((v, i) => {
      timers.push(window.setTimeout(() => setLit(v), 500 + i * 760))
      timers.push(window.setTimeout(() => setLit(-1), 500 + i * 760 + 540))
    })
    timers.push(window.setTimeout(() => setPhase('input'), 500 + seq.length * 760))
    return () => timers.forEach((t) => clearTimeout(t))
  }, [phase, seq])

  // 성공/실패 표시 뒤 다음 시도
  useEffect(() => {
    if (phase !== 'ok' && phase !== 'fail') return
    const t = setTimeout(() => {
      const nextTry = tryNo + 1
      if (nextTry >= SIGIL_TRIES) {
        setPhase('done')
        return
      }
      const nl = phase === 'ok' ? len + 1 : len
      setTryNo(nextTry)
      setLen(nl)
      setSeq(makeSeq(nl))
      setInput([])
      setPhase('show')
    }, 900)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function press(i: number) {
    if (phase !== 'input') return
    const next = [...input, i]
    setInput(next)
    setLit(i)
    window.setTimeout(() => setLit((l) => (l === i ? -1 : l)), 180)
    if (seq[next.length - 1] !== i) {
      // 틀린 곳까지 맞힌 비율만큼 부분 점수
      setScores((s) => [...s, Math.round(((next.length - 1) / seq.length) * 60)])
      setPhase('fail')
    } else if (next.length === seq.length) {
      setScores((s) => [...s, 100])
      setPhase('ok')
    }
  }

  const R = 92
  const pts = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2
    return { x: 120 + Math.cos(a) * R, y: 120 + Math.sin(a) * R }
  })
  if (phase === 'done') {
    const score = Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length))
    const label = roundLabel('sigil', score)
    return (
      <div className="mg-board flex flex-col items-center gap-2 p-6 text-center">
        <div className="mg-judge" data-j={label}>{label}</div>
        <div className="text-xs text-[#f3e6c4]">
          마법진 {SIGIL_TRIES}번 중 {scores.filter((s) => s === 100).length}번 완성 · 최장 {len}획
        </div>
        <DoneButton label="마법진 완성" onClick={() => onDone(score, label)} />
      </div>
    )
  }
  return (
    <div className="mg-board flex flex-col items-center gap-2 p-5">
      <div className="flex w-full justify-between text-xs text-[#d8c79c]">
        <span>{phase === 'show' ? '빛나는 순서를 기억하세요' : phase === 'input' ? '같은 순서로 꼭짓점을 누르세요' : phase === 'ok' ? '술식 완성!' : '술식이 흐트러졌다…'}</span>
        <span>
          시도 {tryNo + 1}/{SIGIL_TRIES} · {seq.length}획
        </span>
      </div>
      <svg width={240} height={240} className={phase === 'fail' ? 'mg-shake' : ''}>
        <circle cx={120} cy={120} r={R + 14} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={2} />
        <circle cx={120} cy={120} r={R - 26} fill="none" stroke={color} strokeOpacity={0.2} strokeWidth={1} strokeDasharray="4 4" />
        {/* 지금까지 이은 선 */}
        {input.slice(1).map((v, k) => (
          <line key={k} x1={pts[input[k]].x} y1={pts[input[k]].y} x2={pts[v].x} y2={pts[v].y} stroke={phase === 'fail' && k === input.length - 2 ? '#e08a8a' : color} strokeWidth={3} strokeLinecap="round" />
        ))}
        {pts.map((p, i) => (
          <g key={i} onClick={() => press(i)} style={{ cursor: phase === 'input' ? 'pointer' : 'default' }}>
            <circle cx={p.x} cy={p.y} r={17} fill={lit === i ? color : '#241f17'} stroke={color} strokeWidth={2} style={{ filter: lit === i ? `drop-shadow(0 0 8px ${color})` : undefined, transition: 'fill 0.12s' }} />
            <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fill={lit === i ? '#2a1d10' : '#d8c79c'} pointerEvents="none">
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex gap-1">
        {Array.from({ length: SIGIL_TRIES }).map((_, i) => (
          <span key={i} className={`mg-round-pip ${scores[i] === 100 ? 'done' : scores[i] == null && i === tryNo ? 'now' : ''}`}>
            {scores[i] != null ? (scores[i] === 100 ? '✓' : '✗') : '·'}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. 분류 실습(2026-10-07) — 카드가 한 장씩 나온다. ←/A 왼쪽 · →/D 오른쪽(또는 바구니 클릭). 카드당 4.5초
// ─────────────────────────────────────────────────────────────────────────────
const SORT_CARDS = 8
const SORT_TIME = 6000
function SortGame({ seed, year, field, onDone }: MiniGameProps) {
  const { set, cards } = useMemo(() => {
    const rand = mulberry32(seed ^ 0x5047)
    const pool = SORT_SETS.filter((s) => s.field.includes(field) && (s.minYear ?? 1) <= year)
    const set = shuffle(pool.length ? pool : SORT_SETS, rand)[0]
    return { set, cards: shuffle(set.items, rand).slice(0, SORT_CARDS) }
  }, [seed, year, field])
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<{ ok: boolean; ms: number }[]>([])
  const [flash, setFlash] = useState<{ side: 0 | 1; ok: boolean } | null>(null)
  const [shownAt, setShownAt] = useState(() => performance.now())
  const [now, setNow] = useState(() => performance.now())
  const done = idx >= cards.length

  function answer(side: 0 | 1 | null) {
    if (done || flash) return
    const ok = side != null && side === cards[idx][1]
    setResults((r) => [...r, { ok, ms: performance.now() - shownAt }])
    setFlash({ side: side ?? (cards[idx][1] === 0 ? 1 : 0), ok })
    window.setTimeout(() => {
      setFlash(null)
      setIdx((i) => i + 1)
      setShownAt(performance.now())
    }, 420)
  }

  // 남은 시간 표시 + 시간 초과(오답 처리)
  useEffect(() => {
    if (done || flash) return
    const id = window.setInterval(() => {
      const t = performance.now()
      setNow(t)
      if (t - shownAt >= SORT_TIME) answer(null)
    }, 100)
    return () => clearInterval(id)
  })

  // ←/A · →/D — 이동 키로 새지 않게 캡처 단계에서 가로챈다
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const side = e.code === 'ArrowLeft' || e.code === 'KeyA' ? 0 : e.code === 'ArrowRight' || e.code === 'KeyD' ? 1 : null
      if (side == null) return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (!e.repeat) answer(side)
    }
    window.addEventListener('keydown', down, true)
    return () => window.removeEventListener('keydown', down, true)
  })

  if (done) {
    const right = results.filter((r) => r.ok).length
    const fast = results.filter((r) => r.ok && r.ms < 2000).length
    const score = Math.min(100, Math.round((right / cards.length) * 90 + (fast / cards.length) * 10))
    const label = roundLabel('sort', score)
    return (
      <div className="mg-board flex flex-col items-center gap-2 p-6 text-center">
        <div className="mg-judge" data-j={label}>{label}</div>
        <div className="text-xs text-[#f3e6c4]">
          {set.title} — {cards.length}장 중 {right}장 정답 · 빠른 판단 {fast}번
        </div>
        <DoneButton label="분류 제출" onClick={() => onDone(score, label)} />
      </div>
    )
  }
  const left = Math.max(0, SORT_TIME - (now - shownAt))
  return (
    <div className="mg-board flex flex-col gap-3 p-5">
      <div className="flex justify-between text-xs text-[#d8c79c]">
        <span>{set.title}</span>
        <span>
          {idx + 1}/{cards.length}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <button onClick={() => answer(0)} className={`mg-bin ${flash?.side === 0 ? (flash.ok ? 'mg-bin-ok' : 'mg-bin-bad') : ''}`}>
          <span className="text-[10px] opacity-70">← A</span>
          <span>{set.left}</span>
        </button>
        <div key={idx} className={`mg-sort-card ${flash ? (flash.ok ? 'mg-sort-ok' : 'mg-sort-bad') : ''}`}>
          {cards[idx][0]}
        </div>
        <button onClick={() => answer(1)} className={`mg-bin ${flash?.side === 1 ? (flash.ok ? 'mg-bin-ok' : 'mg-bin-bad') : ''}`}>
          <span className="text-[10px] opacity-70">D →</span>
          <span>{set.right}</span>
        </button>
      </div>
      <div className="mg-progress">
        <div style={{ width: `${(left / SORT_TIME) * 100}%`, transition: 'width 0.1s linear' }} />
      </div>
    </div>
  )
}
