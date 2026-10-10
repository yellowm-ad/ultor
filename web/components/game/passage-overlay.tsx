'use client'

// 첫 이동 연출(lib/passages) — 어떤 지역에 처음 들어갈 때 한 번 거치는 미니게임 넷.
//   안내 화면 → 게임 → 통과(PASSAGE_DONE: 플래그를 켜고 그 포탈로 넘어감) / 실패(다시 하기 · 돌아가기).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '@/lib/game-state'
import { passageById, type PassageId } from '@/lib/passages'

type Phase = 'intro' | 'play' | 'won' | 'lost'

/** 매 프레임 호출(dt 초) — running 일 때만 */
function useTicker(cb: (dt: number, t: number) => void, running: boolean) {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => {
    if (!running) return
    let raf = 0
    let last = performance.now()
    const t0 = last
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      ref.current(dt, (now - t0) / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running])
}

/** 키 입력(게임 중에만) — 월드 이동 키와 겹치므로 전파를 막는다 */
function useKeys(onKey: (key: string) => void, active: boolean) {
  const ref = useRef(onKey)
  ref.current = onKey
  useEffect(() => {
    if (!active) return
    const h = (e: KeyboardEvent) => {
      const k = e.key === ' ' ? 'space' : e.key.toLowerCase()
      if (['space', 'a', 's', 'd', 'w', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) {
        e.preventDefault()
        e.stopPropagation()
        if (!e.repeat) ref.current(k)
      }
    }
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
  }, [active])
}

const Hearts = ({ n, label = '체력' }: { n: number; label?: string }) => (
  <span className="psg-stat">
    {label}
    {[0, 1, 2].map((i) => (
      <span key={i} className={`psg-heart ${i < n ? 'is-on' : ''}`} />
    ))}
  </span>
)
const Bar = ({ label, v, color }: { label: string; v: number; color: string }) => (
  <span className="psg-stat">
    {label}
    <span className="psg-bar">
      <span style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: color }} />
    </span>
  </span>
)

export function PassageOverlay() {
  const { state, dispatch } = useGame()
  const [phase, setPhase] = useState<Phase>('intro')
  const [round, setRound] = useState(0)
  const end = useCallback((ok: boolean) => setPhase(ok ? 'won' : 'lost'), [])
  if (!state.passage) return null
  const def = passageById(state.passage.id)
  const Game = GAMES[def.id]
  return (
    <div className="psg-root">
      <div className="psg-frame">
        <div className="psg-title">{def.title}</div>
        {phase === 'intro' && (
          <div className="psg-card">
            <p className="psg-intro">{def.intro}</p>
            <ul className="psg-howto">
              {def.howto.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <div className="psg-actions">
              <button type="button" className="gw-btn is-gold is-lg" onClick={() => setPhase('play')}>
                출발
              </button>
              <button type="button" className="gw-btn is-quiet" onClick={() => dispatch({ type: 'PASSAGE_CANCEL' })}>
                돌아가기
              </button>
              {state.settings.testMode && (
                <button type="button" className="gw-btn is-quiet" onClick={() => dispatch({ type: 'PASSAGE_DONE' })}>
                  건너뛰기(테스트 모드)
                </button>
              )}
            </div>
          </div>
        )}
        {phase === 'play' && <Game key={round} onEnd={end} />}
        {phase === 'won' && (
          <div className="psg-card">
            <p className="psg-intro">{WON_TEXT[def.id]}</p>
            <div className="psg-actions">
              <button type="button" className="gw-btn is-gold is-lg" onClick={() => dispatch({ type: 'PASSAGE_DONE' })}>
                계속
              </button>
            </div>
          </div>
        )}
        {phase === 'lost' && (
          <div className="psg-card">
            <p className="psg-intro">{LOST_TEXT[def.id]}</p>
            <div className="psg-actions">
              <button
                type="button"
                className="gw-btn is-gold is-lg"
                onClick={() => {
                  setRound((r) => r + 1)
                  setPhase('play')
                }}
              >
                다시 도전
              </button>
              <button type="button" className="gw-btn is-quiet" onClick={() => dispatch({ type: 'PASSAGE_CANCEL' })}>
                돌아가기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const WON_TEXT: Record<PassageId, string> = {
  voyage: '안개가 걷히고, 물 위에 떠 있는 흰 돔과 산호 첨탑이 보인다. 아틀란티스다.',
  spiral: '마지막 계단을 딛자 구름이 발아래로 내려앉는다. 폭풍 위의 땅, 스톰헤이븐에 올랐다.',
  maze: '무너진 벽 틈으로 빛이 쏟아진다. 회랑을 빠져나오자 이끼 덮인 신전의 뜰이 펼쳐진다.',
  survival: '능선에 오르자 밤하늘 가득 오로라가 일렁인다. 설원을 건넜다 — 이제 길을 안다.',
}
const LOST_TEXT: Record<PassageId, string> = {
  voyage: '갑판에서 미끄러져 흠뻑 젖었다. 선장은 뱃머리를 돌려 항구로 돌아왔다.',
  spiral: '함정에 밀려 계단 아래 층계참까지 굴러떨어졌다.',
  maze: '횃불이 꺼졌다. 더듬어 온 길을 되짚어 입구로 돌아왔다.',
  survival: '더는 걸을 수 없다. 순찰대의 썰매에 실려 설원 어귀로 돌아왔다.',
}

// ════════════════════════════════════════════════════════════════════════════
// ① 함선 — 달려드는 물고기 잡기 + 큰 파도에 매달리기
// ════════════════════════════════════════════════════════════════════════════
const FISH = ['fish-mackerel', 'fish-snapper', 'fish-pearlray', 'fish-trout', 'fish-minnow']
interface Fish { id: number; x: number; y: number; vx: number; vy: number; icon: string }

function VoyageGame({ onEnd }: { onEnd: (ok: boolean) => void }) {
  const TOTAL = 36
  const s = useRef({ t: 0, fish: [] as Fish[], nextFish: 1.2, nextWave: 6, wave: null as null | { t: number; grip: boolean }, lives: 3, caught: 0, flash: 0, note: '', noteT: 0, id: 0, done: false })
  const [, redraw] = useState(0)
  const grip = () => {
    const w = s.current.wave
    if (w && !w.grip) w.grip = true
  }
  useKeys((k) => k === 'space' && grip(), true)
  useTicker((dt) => {
    const g = s.current
    if (g.done) return
    g.t += dt
    g.flash = Math.max(0, g.flash - dt)
    g.noteT = Math.max(0, g.noteT - dt)
    // 물고기 — 갈수록 자주
    g.nextFish -= dt
    if (g.nextFish <= 0) {
      const side = Math.random()
      const x = side < 0.4 ? -6 : side < 0.8 ? 106 : 10 + Math.random() * 80
      const y = side < 0.8 ? 8 + Math.random() * 70 : -6
      const sp = 15 + Math.random() * 8 + g.t * 0.25
      const d = Math.hypot(50 - x, 60 - y)
      g.fish.push({ id: g.id++, x, y, vx: ((50 - x) / d) * sp, vy: ((60 - y) / d) * sp, icon: FISH[Math.floor(Math.random() * FISH.length)] })
      g.nextFish = Math.max(0.5, 1.15 - g.t * 0.015) * (0.7 + Math.random() * 0.6)
    }
    for (const f of g.fish) {
      f.x += f.vx * dt
      f.y += f.vy * dt
    }
    const hit = g.fish.filter((f) => Math.hypot(f.x - 50, f.y - 60) < 9)
    if (hit.length) {
      g.fish = g.fish.filter((f) => !hit.includes(f))
      g.lives -= 1
      g.flash = 0.4
      g.note = '물고기에 미끄러졌다!'
      g.noteT = 1.2
    }
    // 큰 파도 — 경고 1.2초 안에 붙잡아야 한다
    g.nextWave -= dt
    if (!g.wave && g.nextWave <= 0) g.wave = { t: 0, grip: false }
    if (g.wave) {
      g.wave.t += dt
      if (g.wave.t >= 1.25) {
        if (g.wave.grip) {
          g.note = '난간을 붙잡고 버텼다!'
        } else {
          g.lives -= 1
          g.flash = 0.5
          g.note = '파도에 휩쓸렸다!'
        }
        g.noteT = 1.3
        g.wave = null
        g.nextWave = 5 + Math.random() * 3.5
      }
    }
    if (g.lives <= 0) {
      g.done = true
      onEnd(false)
    } else if (g.t >= TOTAL) {
      g.done = true
      onEnd(true)
    }
    redraw((n) => n + 1)
  }, true)
  const g = s.current
  const bob = Math.sin(g.t * 2.2) * 1.2
  return (
    <div className="psg-play">
      <div className="psg-hud">
        <Hearts n={g.lives} label="버티기" />
        <span className="psg-stat">잡은 물고기 {g.caught}</span>
        <Bar label="아틀란티스까지" v={(g.t / TOTAL) * 100} color="#ffd84a" />
      </div>
      <div className="psg-stage psg-sea" style={{ filter: g.flash > 0 ? 'brightness(1.5)' : undefined }}>
        <div className="psg-swell" style={{ backgroundPositionX: `${-g.t * 40}px` }} />
        <div className="psg-swell is-far" style={{ backgroundPositionX: `${-g.t * 22}px` }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/map/props/atlantis/atl5_boat2.png" alt="" className="psg-ship" style={{ transform: `translate(-50%,-50%) translateY(${bob}%) rotate(${Math.sin(g.t * 1.6) * 3 + (g.wave ? Math.sin(g.wave.t * 9) * 6 : 0)}deg)` }} />
        {g.fish.map((f) => (
          <button
            key={f.id}
            type="button"
            className="psg-fish"
            style={{ left: `${f.x}%`, top: `${f.y}%`, transform: `translate(-50%,-50%) scaleX(${f.vx > 0 ? -1 : 1})` }}
            onPointerDown={() => {
              g.fish = g.fish.filter((x) => x !== f)
              g.caught += 1
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/images/items/life/${f.icon}.svg`} alt="물고기" draggable={false} />
          </button>
        ))}
        {g.wave && (
          <>
            <div className="psg-wave" style={{ height: `${Math.min(100, g.wave.t * 80)}%` }} />
            <div className={`psg-alert ${g.wave.grip ? 'is-ok' : ''}`}>{g.wave.grip ? '꽉 잡았다!' : '파도! — 스페이스바'}</div>
          </>
        )}
        {g.noteT > 0 && !g.wave && <div className="psg-note">{g.note}</div>}
      </div>
      <div className="psg-pad">
        <button type="button" className="gw-btn is-gold is-lg" onPointerDown={grip}>
          꽉 잡기 (Space)
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ② 나선 계단 — 함정이 표시선에 닿을 때 맞는 동작으로 피한다
// ════════════════════════════════════════════════════════════════════════════
type TrapKind = 'spike' | 'rune' | 'side' | 'boulder'
const TRAP: Record<TrapKind, { name: string; act: 'jump' | 'lean' | 'hide'; key: string; color: string }> = {
  spike: { name: '바닥 가시', act: 'jump', key: 'Space', color: '#c9c2b0' },
  rune: { name: '마법 함정', act: 'jump', key: 'Space', color: '#b78cff' },
  side: { name: '측면 가시', act: 'lean', key: 'A', color: '#ff9a5c' },
  boulder: { name: '구르는 돌', act: 'hide', key: 'S', color: '#8d7a66' },
}
interface Trap { id: number; kind: TrapKind; y: number; state: 'in' | 'ok' | 'hit' }
const LINE = 80

function SpiralGame({ onEnd }: { onEnd: (ok: boolean) => void }) {
  const TOTAL = 22
  const order = useMemo(() => {
    const kinds: TrapKind[] = ['spike', 'side', 'boulder', 'rune']
    return Array.from({ length: TOTAL }, (_, i) => (i < 3 ? kinds[i] : kinds[Math.floor(Math.random() * kinds.length)]))
  }, [])
  const s = useRef({ t: 0, traps: [] as Trap[], spawned: 0, next: 0.8, lives: 3, cleared: 0, pose: '' as '' | 'jump' | 'lean' | 'hide', poseT: 0, flash: 0, done: false })
  const [, redraw] = useState(0)
  const act = (a: 'jump' | 'lean' | 'hide') => {
    const g = s.current
    if (g.done) return
    g.pose = a
    g.poseT = 0.35
    // 표시선에 가장 가까운 함정 하나를 판정
    const near = g.traps.filter((t) => t.state === 'in' && Math.abs(t.y - LINE) < 10).sort((p, q) => Math.abs(p.y - LINE) - Math.abs(q.y - LINE))[0]
    if (!near) return
    if (TRAP[near.kind].act === a) {
      near.state = 'ok'
      g.cleared += 1
    } else {
      near.state = 'hit'
      g.lives -= 1
      g.flash = 0.4
    }
  }
  useKeys((k) => {
    if (k === 'space' || k === 'w' || k === 'arrowup') act('jump')
    else if (k === 'a' || k === 'd' || k === 'arrowleft' || k === 'arrowright') act('lean')
    else if (k === 's' || k === 'arrowdown') act('hide')
  }, true)
  useTicker((dt) => {
    const g = s.current
    if (g.done) return
    g.t += dt
    g.flash = Math.max(0, g.flash - dt)
    g.poseT = Math.max(0, g.poseT - dt)
    if (g.poseT === 0) g.pose = ''
    const speed = 34 + g.spawned * 1.3
    g.next -= dt
    if (g.spawned < TOTAL && g.next <= 0) {
      g.traps.push({ id: g.spawned, kind: order[g.spawned], y: -8, state: 'in' })
      g.spawned += 1
      g.next = Math.max(0.78, 1.5 - g.spawned * 0.035)
    }
    for (const t of g.traps) {
      t.y += speed * dt
      if (t.state === 'in' && t.y > LINE + 10) {
        t.state = 'hit'
        g.lives -= 1
        g.flash = 0.4
      }
    }
    g.traps = g.traps.filter((t) => t.y < 112)
    if (g.lives <= 0) {
      g.done = true
      onEnd(false)
    } else if (g.spawned >= TOTAL && g.traps.every((t) => t.state !== 'in')) {
      g.done = true
      onEnd(true)
    }
    redraw((n) => n + 1)
  }, true)
  const g = s.current
  return (
    <div className="psg-play">
      <div className="psg-hud">
        <Hearts n={g.lives} />
        <Bar label="꼭대기까지" v={(g.cleared / TOTAL) * 100} color="#ffd84a" />
      </div>
      <div className="psg-stage psg-tower" style={{ filter: g.flash > 0 ? 'brightness(1.5) saturate(1.4)' : undefined }}>
        <div className="psg-steps" style={{ backgroundPositionY: `${g.t * 60}px` }} />
        <div className="psg-alcove" style={{ opacity: g.pose === 'hide' ? 1 : 0.35 }} />
        <div className="psg-line" style={{ top: `${LINE}%` }} />
        {g.traps.map((t) => (
          <div key={t.id} className={`psg-trap is-${t.kind} is-${t.state}`} style={{ top: `${t.y}%`, borderColor: TRAP[t.kind].color }}>
            <b style={{ color: TRAP[t.kind].color }}>{TRAP[t.kind].name}</b>
            <i>{TRAP[t.kind].key}</i>
          </div>
        ))}
        <div className={`psg-runner ${g.pose ? `is-${g.pose}` : ''}`} style={{ top: `${LINE}%` }}>
          <span className="head" />
          <span className="body" />
        </div>
      </div>
      <div className="psg-pad">
        <button type="button" className="gw-btn is-lg" onPointerDown={() => act('lean')}>
          몸 틀기 (A)
        </button>
        <button type="button" className="gw-btn is-gold is-lg" onPointerDown={() => act('jump')}>
          뛰어넘기 (Space)
        </button>
        <button type="button" className="gw-btn is-lg" onPointerDown={() => act('hide')}>
          벽 틈에 숨기 (S)
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ③ 미로 — 횃불이 비추는 둘레만 보인다
// ════════════════════════════════════════════════════════════════════════════
const MW = 11
const MH = 9
/** 칸마다 뚫린 방향 비트(1=북 2=동 4=남 8=서) — 깊이 우선으로 판 미로 */
function makeMaze() {
  const open = new Uint8Array(MW * MH)
  const seen = new Uint8Array(MW * MH)
  const dirs = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]] as const
  const stack = [0]
  seen[0] = 1
  while (stack.length) {
    const c = stack[stack.length - 1]
    const x = c % MW, y = (c - x) / MW
    const opts = dirs.filter(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < MW && y + dy < MH && !seen[(y + dy) * MW + x + dx])
    if (!opts.length) {
      stack.pop()
      continue
    }
    const [dx, dy, bit, back] = opts[Math.floor(Math.random() * opts.length)]
    const n = (y + dy) * MW + x + dx
    open[c] |= bit
    open[n] |= back
    seen[n] = 1
    stack.push(n)
  }
  // 막다른 길을 조금 터서 돌아가는 길을 만든다
  for (let k = 0; k < 8; k++) {
    const x = 1 + Math.floor(Math.random() * (MW - 2)), y = 1 + Math.floor(Math.random() * (MH - 2))
    open[y * MW + x] |= 2
    open[y * MW + x + 1] |= 8
  }
  // 입구에서 가장 먼 칸이 출구
  const dist = new Int16Array(MW * MH).fill(-1)
  const q = [0]
  dist[0] = 0
  let far = 0
  while (q.length) {
    const c = q.shift()!
    if (dist[c] > dist[far]) far = c
    const x = c % MW, y = (c - x) / MW
    for (const [dx, dy, bit] of dirs) {
      const n = (y + dy) * MW + x + dx
      if (open[c] & bit && dist[n] < 0) {
        dist[n] = dist[c] + 1
        q.push(n)
      }
    }
  }
  return { open, exit: far }
}

function MazeGame({ onEnd }: { onEnd: (ok: boolean) => void }) {
  const TORCH = 80
  const maze = useMemo(makeMaze, [])
  const [pos, setPos] = useState(0)
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]))
  const left = useRef(TORCH)
  const done = useRef(false)
  const [, redraw] = useState(0)
  const move = (bit: number, d: number) => {
    if (done.current) return
    setPos((p) => {
      if (!(maze.open[p] & bit)) return p
      const n = p + d
      setSeen((s) => new Set(s).add(n))
      if (n === maze.exit && !done.current) {
        done.current = true
        window.setTimeout(() => onEnd(true), 350)
      }
      return n
    })
  }
  useKeys((k) => {
    if (k === 'w' || k === 'arrowup') move(1, -MW)
    else if (k === 'd' || k === 'arrowright') move(2, 1)
    else if (k === 's' || k === 'arrowdown') move(4, MW)
    else if (k === 'a' || k === 'arrowleft') move(8, -1)
  }, true)
  useTicker((dt) => {
    if (done.current) return
    left.current -= dt
    if (left.current <= 0) {
      done.current = true
      onEnd(false)
    }
    redraw((n) => n + 1)
  }, true)
  const px = pos % MW, py = (pos - px) / MW
  return (
    <div className="psg-play">
      <div className="psg-hud">
        <Bar label="횃불" v={(left.current / TORCH) * 100} color="#ff9a3c" />
        <span className="psg-stat">빛이 새는 곳이 출구</span>
      </div>
      <div className="psg-stage psg-maze" style={{ gridTemplateColumns: `repeat(${MW}, 1fr)` }}>
        {Array.from({ length: MW * MH }, (_, c) => {
          const x = c % MW, y = (c - x) / MW
          const d = Math.max(Math.abs(x - px), Math.abs(y - py))
          const lit = d <= 1
          const known = lit || seen.has(c)
          const o = maze.open[c]
          const wall = (bit: number) => (known && !(o & bit) ? '3px solid #6f6250' : '3px solid transparent')
          return (
            <div
              key={c}
              className="psg-cell"
              style={{
                background: !known ? '#0c0a08' : lit ? '#4a4034' : '#2a241d',
                borderTop: wall(1), borderRight: wall(2), borderBottom: wall(4), borderLeft: wall(8),
                boxShadow: c === maze.exit && (known || d <= 3) ? 'inset 0 0 14px 4px #fff2b0' : undefined,
              }}
            >
              {c === pos && <span className="psg-me" />}
            </div>
          )
        })}
      </div>
      <div className="psg-pad">
        <button type="button" className="gw-btn" onPointerDown={() => move(8, -1)}>←</button>
        <button type="button" className="gw-btn" onPointerDown={() => move(1, -MW)}>↑</button>
        <button type="button" className="gw-btn" onPointerDown={() => move(4, MW)}>↓</button>
        <button type="button" className="gw-btn" onPointerDown={() => move(2, 1)}>→</button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ④ 설원 횡단 — 갈림길을 골라 나아가며 체온·허기를 지킨다
// ════════════════════════════════════════════════════════════════════════════
type NodeKind = 'camp' | 'hunt' | 'cave' | 'storm' | 'supply' | 'tracks'
const NODE: Record<NodeKind, { name: string; hint: string; color: string }> = {
  camp: { name: '캠프', hint: '불을 피운다 — 체온 크게 회복', color: '#ff9a3c' },
  hunt: { name: '사냥터', hint: '사냥 — 허기 크게 회복, 다칠 수 있다', color: '#c94f4f' },
  cave: { name: '얼음 동굴', hint: '바람을 피한다 — 체온·허기 조금 회복', color: '#7fd0e8' },
  storm: { name: '눈보라 길', hint: '체온이 크게 깎인다 — 가끔 보급품 발견', color: '#cfd8e6' },
  supply: { name: '버려진 보급소', hint: '체온·허기·체력을 조금씩 회복', color: '#9bd36a' },
  tracks: { name: '수상한 발자국', hint: '따라갈지 고른다', color: '#b78cff' },
}
const LAYERS = 7

function SurvivalGame({ onEnd }: { onEnd: (ok: boolean) => void }) {
  const map = useMemo(() => {
    const pool: NodeKind[] = ['camp', 'hunt', 'cave', 'storm', 'supply', 'tracks', 'hunt', 'camp', 'storm']
    return Array.from({ length: LAYERS }, (_, l) => {
      const row = Array.from({ length: 3 }, () => pool[Math.floor(Math.random() * pool.length)])
      // 한 층에 쉴 곳(캠프·동굴·보급소)이 하나는 있게, 마지막 직전 층은 눈보라가 하나는 있게
      if (!row.some((k) => k === 'camp' || k === 'cave' || k === 'supply')) row[Math.floor(Math.random() * 3)] = l % 2 ? 'camp' : 'cave'
      if (l === LAYERS - 1 && !row.includes('storm')) row[1] = 'storm'
      return row
    })
  }, [])
  const [st, setSt] = useState({ layer: -1, col: 1, warm: 70, food: 70, hp: 3, log: '설원 어귀. 눈 위로 세 갈래 길이 나 있다.', ask: false })
  const settle = (s: typeof st, log: string) => {
    let { warm, food, hp } = s
    const extra: string[] = []
    if (warm <= 0) {
      hp -= 1
      warm = 25
      extra.push('몸이 얼어 체력이 깎였다.')
    }
    if (food <= 0) {
      hp -= 1
      food = 25
      extra.push('굶주려 체력이 깎였다.')
    }
    const next = { ...s, warm: Math.min(100, warm), food: Math.min(100, food), hp: Math.min(3, hp), log: [log, ...extra].join(' ') }
    setSt(next)
    if (next.hp <= 0) window.setTimeout(() => onEnd(false), 900)
    else if (next.layer >= LAYERS - 1 && !next.ask) window.setTimeout(() => onEnd(true), 900)
  }
  const go = (col: number) => {
    const layer = st.layer + 1
    const kind = map[layer][col]
    // 한 칸 걷는 값
    const s = { ...st, layer, col, warm: st.warm - 18, food: st.food - 15, ask: false }
    const r = Math.random()
    switch (kind) {
      case 'camp':
        return settle({ ...s, warm: s.warm + 42, food: s.food - 4 }, '바람막이 뒤에 불을 피웠다. 손끝에 감각이 돌아온다.')
      case 'hunt':
        return r < 0.28
          ? settle({ ...s, food: s.food + 30, warm: s.warm - 8, hp: s.hp - 1 }, '눈토끼를 잡았지만 얼음에 미끄러져 다쳤다.')
          : settle({ ...s, food: s.food + 45, warm: s.warm - 8 }, '눈토끼 두 마리를 잡아 배를 채웠다.')
      case 'cave':
        return settle({ ...s, warm: s.warm + 22, food: s.food + 12 }, '얼음 동굴에서 바람을 피하며 말린 열매를 씹었다.')
      case 'storm':
        return r < 0.5
          ? settle({ ...s, warm: s.warm - 22, food: s.food + 28 }, '눈보라 속에서 반쯤 묻힌 보급 상자를 찾았다.')
          : settle({ ...s, warm: s.warm - 24 }, '눈보라가 뼛속까지 파고든다. 앞이 보이지 않는다.')
      case 'supply':
        return settle({ ...s, warm: s.warm + 14, food: s.food + 22, hp: s.hp + 1 }, '버려진 보급소에 담요와 통조림이 남아 있었다.')
      case 'tracks':
        return setSt({ ...s, ask: true, log: '눈 위에 커다란 발자국이 숲 쪽으로 이어진다. 따라가 볼까?' })
    }
  }
  const tracks = (follow: boolean) => {
    const s = { ...st, ask: false }
    if (!follow) return settle(s, '발자국을 등지고 걸음을 재촉했다.')
    return Math.random() < 0.55
      ? settle({ ...s, food: s.food + 50, warm: s.warm + 10 }, '발자국 끝에 설인 사냥꾼의 모닥불이 있었다. 고깃국을 얻어먹었다.')
      : settle({ ...s, hp: s.hp - 1, warm: s.warm - 10 }, '서리곰의 굴이었다! 간신히 달아났지만 다쳤다.')
  }
  const alive = st.hp > 0 && st.layer < LAYERS - 1
  return (
    <div className="psg-play">
      <div className="psg-hud">
        <Hearts n={st.hp} />
        <Bar label="체온" v={st.warm} color="#ff9a3c" />
        <Bar label="허기" v={st.food} color="#9bd36a" />
      </div>
      <div className="psg-stage psg-snow">
        <div className="psg-goal">오로라 능선</div>
        {map
          .map((row, l) => (
            <div key={l} className="psg-row">
              {row.map((k, c) => {
                const here = l === st.layer && c === st.col
                const can = alive && !st.ask && l === st.layer + 1 && (st.layer < 0 || Math.abs(c - st.col) <= 1)
                return (
                  <button key={c} type="button" disabled={!can} className={`psg-node ${here ? 'is-here' : ''} ${can ? 'is-can' : ''} ${l <= st.layer && !here ? 'is-past' : ''}`} style={{ borderColor: NODE[k].color }} onClick={() => go(c)} title={NODE[k].hint}>
                    <b style={{ color: NODE[k].color }}>{NODE[k].name}</b>
                    <i>{NODE[k].hint}</i>
                  </button>
                )
              })}
            </div>
          ))
          .reverse()}
        <div className="psg-goal is-start">설원 어귀</div>
      </div>
      <div className="psg-log">{st.log}</div>
      {st.ask && (
        <div className="psg-pad">
          <button type="button" className="gw-btn is-gold is-lg" onClick={() => tracks(true)}>
            따라간다
          </button>
          <button type="button" className="gw-btn is-lg" onClick={() => tracks(false)}>
            지나친다
          </button>
        </div>
      )}
    </div>
  )
}

const GAMES: Record<PassageId, (p: { onEnd: (ok: boolean) => void }) => React.ReactNode> = {
  voyage: VoyageGame,
  spiral: SpiralGame,
  maze: MazeGame,
  survival: SurvivalGame,
}
