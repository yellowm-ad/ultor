// ============================================================================
// 효과음(2026-11-10) — 파일 없이 Web Audio 로 바로 합성하는 16비트 RPG 풍 효과음.
//   · 배경음(빕박스 칩튠)과 같은 시대 느낌: 사각·삼각파 + 노이즈, 짧고 또렷하게.
//   · 참고한 일반적인 RPG 효과음 구성: UI(커서·확인·취소·오류·창 열기/닫기·구매·장착·저장),
//     보상(아이템·레벨업·퀘스트 완료·스킬 습득), 필드(몬스터 접촉·포탈·상자·채집·낚시),
//     대사(글자 소리 — 목소리 높낮이별), 전투(타격·치명타·빗나감·막기·속성 마법·시전·회복·강화·약화·상태이상·처치·쓰러짐·도주·소환·아이템).
//   · 타격음은 세 겹: ① 딱(노이즈 순간음) ② 몸통(사각파 하강) ③ 쿵(사인 저음). 피해 비율이 클수록 낮고 길게.
//   · 음량 = 설정 「효과음 음량」(SfxBridge 가 setSfxVolume 으로 넘긴다).
// ============================================================================

export type SfxId =
  | 'ui-move' | 'ui-ok' | 'ui-back' | 'ui-error' | 'ui-open' | 'ui-close' | 'coin' | 'equip' | 'save'
  | 'item-get' | 'level-up' | 'quest-done' | 'learn-skill'
  | 'encounter' | 'portal' | 'door' | 'chest' | 'gather' | 'fishing-bite'
  | 'miss' | 'guard' | 'cast' | 'heal' | 'buff' | 'debuff' | 'status' | 'ko-enemy' | 'ko-ally' | 'flee' | 'summon' | 'item-use'
  | 'magic-fire' | 'magic-ice' | 'magic-earth' | 'magic-dark' | 'magic-light' | 'magic-wind' | 'magic-none'

export type Voice = 'female' | 'male' | 'neutral' | 'child' | 'elder' | 'monster' | 'none'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let volume = 0.8
let noiseBuf: AudioBuffer | null = null

export function setSfxVolume(v01: number) {
  volume = Math.max(0, Math.min(1, v01))
  if (master) master.gain.value = volume * 0.55
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!C) return null
    const c = new C()
    const m = c.createGain()
    m.gain.value = volume * 0.55
    // 살짝 눌러 줘서 여러 소리가 겹쳐도 찢어지지 않게
    const comp = c.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    m.connect(comp).connect(c.destination)
    const n = c.sampleRate
    const nb = c.createBuffer(1, n, n)
    const d = nb.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    ctx = c
    master = m
    noiseBuf = nb
  }
  const c = ctx as AudioContext
  if (c.state === 'suspended') void c.resume().catch(() => {})
  return c
}
/** 첫 입력 때 한 번 — 브라우저가 소리를 풀어 준다 */
export function unlockSfx() {
  ac()
}

type Wave = OscillatorType | 'noise'
interface Tone {
  w: Wave
  /** 시작·끝 주파수(Hz, 노이즈면 필터 주파수) */
  f0: number
  f1?: number
  dur: number
  vol?: number
  at?: number
  /** 노이즈 필터 종류 */
  ft?: BiquadFilterType
  q?: number
  /** 지수 하강(기본) 대신 직선 */
  lin?: boolean
  /** 메아리(마법 잔향) */
  echo?: boolean
}

function tone(c: AudioContext, t: Tone, k: number) {
  if (!master) return
  const start = c.currentTime + (t.at ?? 0)
  const end = start + t.dur
  const g = c.createGain()
  const peak = (t.vol ?? 0.5) * k
  g.gain.setValueAtTime(0.0001, start)
  g.gain.linearRampToValueAtTime(peak, start + Math.min(0.006, t.dur / 4))
  if (t.lin) g.gain.linearRampToValueAtTime(0.0001, end)
  else g.gain.exponentialRampToValueAtTime(0.0001, end)
  let src: AudioScheduledSourceNode
  let out: AudioNode = g
  if (t.w === 'noise') {
    const s = c.createBufferSource()
    s.buffer = noiseBuf
    s.loop = true
    const f = c.createBiquadFilter()
    f.type = t.ft ?? 'bandpass'
    f.Q.value = t.q ?? 1
    f.frequency.setValueAtTime(t.f0, start)
    if (t.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, t.f1), end)
    s.connect(f).connect(g)
    src = s
  } else {
    const o = c.createOscillator()
    o.type = t.w
    o.frequency.setValueAtTime(t.f0, start)
    if (t.f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, t.f1), end)
    o.connect(g)
    src = o
  }
  if (t.echo) {
    const d = c.createDelay(0.5)
    d.delayTime.value = 0.11
    const fb = c.createGain()
    fb.gain.value = 0.32
    g.connect(d)
    d.connect(fb).connect(d)
    const wet = c.createGain()
    wet.gain.value = 0.5
    d.connect(wet).connect(master)
    setTimeout(() => wet.disconnect(), (t.dur + (t.at ?? 0) + 1.2) * 1000)
  }
  out.connect(master)
  src.start(start)
  src.stop(end + 0.02)
  src.onended = () => {
    out.disconnect()
    out = g
  }
}

function play(tones: Tone[], k = 1) {
  const c = ac()
  if (!c || volume <= 0) return
  for (const t of tones) tone(c, t, k)
}
const jit = (f: number, p = 0.04) => f * (1 + (Math.random() * 2 - 1) * p)

// ── 프리셋 ───────────────────────────────────────────────────────────────────
const arp = (w: Wave, notes: number[], step: number, dur: number, vol = 0.32, echo = false): Tone[] => notes.map((f, i) => ({ w, f0: f, dur, vol, at: i * step, echo }))
const N = { C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, B5: 988, C6: 1047, D6: 1175, E6: 1319, G6: 1568, C7: 2093 }

const PRESETS: Record<SfxId, () => Tone[]> = {
  'ui-move': () => [{ w: 'square', f0: 1200, dur: 0.03, vol: 0.12 }],
  'ui-ok': () => [{ w: 'square', f0: 880, dur: 0.05, vol: 0.18 }, { w: 'square', f0: 1320, dur: 0.07, vol: 0.18, at: 0.045 }],
  'ui-back': () => [{ w: 'square', f0: 660, f1: 330, dur: 0.09, vol: 0.16 }],
  'ui-error': () => [{ w: 'square', f0: 140, dur: 0.07, vol: 0.22 }, { w: 'square', f0: 140, dur: 0.09, vol: 0.22, at: 0.1 }],
  'ui-open': () => [{ w: 'triangle', f0: 440, f1: 990, dur: 0.1, vol: 0.28 }, { w: 'noise', f0: 3000, f1: 6000, dur: 0.08, vol: 0.06, ft: 'highpass' }],
  'ui-close': () => [{ w: 'triangle', f0: 880, f1: 400, dur: 0.1, vol: 0.26 }],
  coin: () => [{ w: 'square', f0: N.B5, dur: 0.06, vol: 0.18 }, { w: 'square', f0: N.E6, dur: 0.22, vol: 0.18, at: 0.06 }],
  equip: () => [{ w: 'noise', f0: 4200, dur: 0.05, vol: 0.18, ft: 'bandpass', q: 6 }, { w: 'square', f0: 1760, f1: 1500, dur: 0.12, vol: 0.12, at: 0.02 }],
  save: () => arp('triangle', [N.C5, N.G5, N.C6], 0.07, 0.25, 0.3, true),
  'item-get': () => arp('square', [N.G5, N.C6, N.E6, N.G6], 0.06, 0.18, 0.16),
  'level-up': () => [...arp('square', [N.C5, N.E5, N.G5, N.C6, N.E6, N.G6], 0.055, 0.16, 0.15), { w: 'triangle', f0: N.C6, dur: 0.6, vol: 0.3, at: 0.33, echo: true }, { w: 'triangle', f0: N.G6, dur: 0.6, vol: 0.2, at: 0.33 }],
  'quest-done': () => [...arp('square', [N.G5, N.G5, N.G5], 0.09, 0.08, 0.14), { w: 'square', f0: N.C6, dur: 0.4, vol: 0.18, at: 0.3 }, { w: 'triangle', f0: N.E6, dur: 0.4, vol: 0.2, at: 0.3, echo: true }],
  'learn-skill': () => [...arp('triangle', [N.E5, N.A5, N.C6, N.E6, N.A5 * 2], 0.05, 0.3, 0.24, true), { w: 'noise', f0: 8000, dur: 0.4, vol: 0.05, ft: 'highpass', at: 0.1 }],
  // 몬스터 접촉 — 유리가 깨지듯 쨍 + 떨어지는 소용돌이
  encounter: () => [
    { w: 'noise', f0: 6000, f1: 800, dur: 0.35, vol: 0.32, ft: 'bandpass', q: 3 },
    { w: 'square', f0: 1600, f1: 120, dur: 0.45, vol: 0.18 },
    { w: 'square', f0: 1200, f1: 90, dur: 0.45, vol: 0.12, at: 0.05 },
    { w: 'sine', f0: 140, f1: 40, dur: 0.3, vol: 0.5, at: 0.02 },
  ],
  portal: () => [{ w: 'triangle', f0: 300, f1: 1400, dur: 0.35, vol: 0.28, echo: true }, { w: 'noise', f0: 1200, f1: 5000, dur: 0.35, vol: 0.1, ft: 'bandpass', q: 2 }],
  door: () => [{ w: 'noise', f0: 600, f1: 300, dur: 0.12, vol: 0.3, ft: 'lowpass' }, { w: 'square', f0: 180, f1: 120, dur: 0.08, vol: 0.18, at: 0.12 }],
  chest: () => [{ w: 'noise', f0: 900, dur: 0.06, vol: 0.25, ft: 'lowpass' }, ...arp('square', [N.C6, N.E6, N.G6, N.C7], 0.05, 0.14, 0.13).map((t) => ({ ...t, at: (t.at ?? 0) + 0.08 }))],
  gather: () => [{ w: 'noise', f0: 2500, dur: 0.05, vol: 0.18, ft: 'bandpass', q: 3 }, { w: 'triangle', f0: jit(N.A5), dur: 0.1, vol: 0.2, at: 0.04 }],
  'fishing-bite': () => [{ w: 'sine', f0: 600, f1: 250, dur: 0.12, vol: 0.35 }, { w: 'noise', f0: 1800, dur: 0.1, vol: 0.12, ft: 'bandpass', q: 2, at: 0.02 }, { w: 'sine', f0: 600, f1: 250, dur: 0.12, vol: 0.3, at: 0.15 }],
  // ── 전투 ──
  miss: () => [{ w: 'noise', f0: 900, f1: 3200, dur: 0.16, vol: 0.18, ft: 'bandpass', q: 2.5 }],
  guard: () => [{ w: 'square', f0: 2200, f1: 1900, dur: 0.12, vol: 0.12 }, { w: 'noise', f0: 5000, dur: 0.05, vol: 0.18, ft: 'highpass' }, { w: 'triangle', f0: 330, dur: 0.1, vol: 0.2 }],
  cast: () => [{ w: 'triangle', f0: 220, f1: 880, dur: 0.28, vol: 0.18, lin: true }, { w: 'noise', f0: 2000, f1: 6000, dur: 0.28, vol: 0.05, ft: 'bandpass', q: 4 }],
  heal: () => arp('triangle', [N.C6, N.E6, N.G6, N.C7], 0.06, 0.28, 0.2, true),
  buff: () => arp('square', [N.E5, N.A5, N.E6], 0.05, 0.12, 0.13, true),
  debuff: () => [{ w: 'square', f0: 700, f1: 180, dur: 0.25, vol: 0.14 }, { w: 'square', f0: 690, f1: 175, dur: 0.25, vol: 0.1 }],
  status: () => [{ w: 'triangle', f0: 400, f1: 300, dur: 0.08, vol: 0.2 }, { w: 'triangle', f0: 340, f1: 250, dur: 0.12, vol: 0.2, at: 0.09 }],
  'ko-enemy': () => [
    { w: 'noise', f0: 2400, f1: 200, dur: 0.45, vol: 0.32, ft: 'lowpass' },
    { w: 'square', f0: 520, f1: 60, dur: 0.42, vol: 0.14 },
    ...arp('triangle', [N.E6, N.C6, N.G5], 0.06, 0.1, 0.12).map((t) => ({ ...t, at: (t.at ?? 0) + 0.2 })),
  ],
  'ko-ally': () => [{ w: 'triangle', f0: 440, f1: 110, dur: 0.6, vol: 0.3 }, { w: 'noise', f0: 600, f1: 100, dur: 0.4, vol: 0.15, ft: 'lowpass' }],
  flee: () => [0, 0.08, 0.16].map((at) => ({ w: 'noise' as const, f0: 1400, f1: 3500, dur: 0.07, vol: 0.18, ft: 'bandpass' as BiquadFilterType, q: 3, at })),
  summon: () => [{ w: 'triangle', f0: 200, f1: 1200, dur: 0.4, vol: 0.22, echo: true }, ...arp('square', [N.C6, N.G6], 0.08, 0.18, 0.12).map((t) => ({ ...t, at: (t.at ?? 0) + 0.35 }))],
  'item-use': () => [{ w: 'sine', f0: 500, f1: 900, dur: 0.08, vol: 0.25 }, { w: 'sine', f0: 600, f1: 1100, dur: 0.08, vol: 0.22, at: 0.1 }, { w: 'triangle', f0: N.E6, dur: 0.2, vol: 0.15, at: 0.2, echo: true }],
  // ── 속성 마법(맞는 순간 몸통 타격음 위에 겹친다) ──
  'magic-fire': () => [{ w: 'noise', f0: 2600, f1: 300, dur: 0.38, vol: 0.38, ft: 'lowpass', q: 2 }, { w: 'sawtooth', f0: 160, f1: 60, dur: 0.25, vol: 0.12 }, { w: 'noise', f0: 5000, dur: 0.06, vol: 0.12, ft: 'highpass', at: 0.08 }],
  'magic-ice': () => [{ w: 'triangle', f0: 2600, f1: 3400, dur: 0.22, vol: 0.18, echo: true }, { w: 'noise', f0: 7000, dur: 0.08, vol: 0.2, ft: 'highpass' }, { w: 'square', f0: 1900, f1: 1700, dur: 0.1, vol: 0.08, at: 0.06 }],
  'magic-earth': () => [{ w: 'sine', f0: 110, f1: 35, dur: 0.4, vol: 0.6 }, { w: 'noise', f0: 500, f1: 120, dur: 0.4, vol: 0.32, ft: 'lowpass' }],
  'magic-dark': () => [{ w: 'sawtooth', f0: 320, f1: 70, dur: 0.38, vol: 0.14 }, { w: 'sawtooth', f0: 328, f1: 72, dur: 0.38, vol: 0.12 }, { w: 'noise', f0: 400, dur: 0.3, vol: 0.12, ft: 'lowpass' }],
  'magic-light': () => [...arp('square', [N.C6, N.E6, N.G6], 0.035, 0.18, 0.1, true), { w: 'triangle', f0: N.C7, dur: 0.3, vol: 0.12, at: 0.1 }],
  'magic-wind': () => [{ w: 'noise', f0: 700, f1: 3800, dur: 0.32, vol: 0.32, ft: 'bandpass', q: 3 }, { w: 'noise', f0: 3800, f1: 900, dur: 0.25, vol: 0.18, ft: 'bandpass', q: 3, at: 0.18 }],
  'magic-none': () => [{ w: 'triangle', f0: 1400, f1: 400, dur: 0.16, vol: 0.2 }, { w: 'noise', f0: 3000, dur: 0.05, vol: 0.12, ft: 'highpass' }],
}

export function sfx(id: SfxId, k = 1) {
  const p = PRESETS[id]
  if (p) play(p(), k)
}

/**
 * 타격음 — 이번 타가 대상 최대 HP 의 몇 %였는지(ratio)로 무게를 정한다.
 *   가벼운 타(다단 히트 한 대)는 높고 짧게, 묵직한 타는 낮고 길게. 치명타는 쨍한 금속음 + 한 겹 더.
 */
export function hitSfx(ratio: number, opts: { crit?: boolean; magic?: boolean; multi?: boolean } = {}) {
  const w = Math.max(0, Math.min(1, ratio * 2.2)) // 0 가벼움 → 1 묵직
  const pitch = jit(1, opts.multi ? 0.08 : 0.04)
  const body = (240 - 110 * w) * pitch
  const len = 0.08 + 0.09 * w
  const k = opts.multi ? 0.75 : 1
  const tones: Tone[] = [
    // ① 딱 — 짧은 노이즈 순간음
    { w: 'noise', f0: opts.magic ? 4200 : 2800, dur: 0.035, vol: 0.42, ft: 'bandpass', q: 0.9 },
    // ② 몸통 — 사각파가 뚝 떨어진다(16비트 '퍽')
    { w: 'square', f0: body, f1: body * 0.28, dur: len, vol: 0.22 },
    // ③ 쿵 — 사인 저음
    { w: 'sine', f0: 150 - 50 * w, f1: 42, dur: len + 0.05, vol: 0.45 + 0.25 * w },
  ]
  if (opts.crit) {
    tones.unshift({ w: 'square', f0: 2093, f1: 1568, dur: 0.07, vol: 0.18 })
    tones.push({ w: 'noise', f0: 1600, f1: 300, dur: 0.22, vol: 0.32, ft: 'lowpass', at: 0.02 })
    tones.push({ w: 'square', f0: body * 0.75, f1: 40, dur: 0.2, vol: 0.18, at: 0.03 })
  }
  play(tones, k)
}

// ── 대사 글자 소리 ───────────────────────────────────────────────────────────
const VOICE: Record<Exclude<Voice, 'none'>, { w: OscillatorType; f: number; spread: number; dur: number; vol: number }> = {
  female: { w: 'square', f: 760, spread: 0.07, dur: 0.035, vol: 0.07 },
  male: { w: 'square', f: 300, spread: 0.06, dur: 0.04, vol: 0.09 },
  neutral: { w: 'triangle', f: 520, spread: 0.05, dur: 0.035, vol: 0.12 },
  child: { w: 'square', f: 1050, spread: 0.1, dur: 0.03, vol: 0.06 },
  elder: { w: 'triangle', f: 240, spread: 0.04, dur: 0.05, vol: 0.14 },
  monster: { w: 'sawtooth', f: 120, spread: 0.12, dur: 0.05, vol: 0.08 },
}
let lastBlip = 0
/** 한 글자 소리 — 공백·문장부호는 건너뛰고, 너무 촘촘하면 거른다 */
export function blip(voice: Voice, ch: string) {
  if (voice === 'none' || !ch.trim() || /[.,!?…·~"'()\-—「」『』]/.test(ch)) return
  const now = typeof performance !== 'undefined' ? performance.now() : 0
  if (now - lastBlip < 55) return
  lastBlip = now
  const v = VOICE[voice]
  const c = ac()
  if (!c || volume <= 0) return
  // 글자마다 높낮이를 살짝 다르게(한 글자 코드로 정해 같은 말은 같은 가락)
  const code = ch.charCodeAt(0)
  const f = v.f * (1 + (((code * 7919) % 100) / 100 - 0.5) * 2 * v.spread)
  tone(c, { w: v.w, f0: f, dur: v.dur, vol: v.vol }, 1)
  if (voice === 'monster') tone(c, { w: 'noise', f0: 500, dur: v.dur, vol: 0.06, ft: 'lowpass' }, 1)
}
