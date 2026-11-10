// ============================================================================
// 빕박스(BeepBox) 배경음(2026-11-10) — 음원 파일 대신 빕박스 곡 문자열을 게임 안 신디로 바로 튼다.
//   · 배포본: public/bgm/beepbox.json { songs: { 칸 id: 곡 문자열 }, gain: { 칸 id: 음량 보정 } }
//     (scripts/gen-bgm-beepbox.mjs 가 지은 오리지널 곡 — 16비트 JRPG 풍)
//   · 이 브라우저에서 고친 곡: localStorage 'ultor-bgm-beepbox' { 칸 id: 곡 문자열 } — 배포본보다 먼저
//   · 고치기: 관리자 「브금 관리」 → 「빕박스에서 열기」(beepbox.co/#곡) → 고친 뒤 주소창 주소를 복사해 「붙여넣기」
//   · 신디(beepbox npm, MIT)는 처음 틀 때만 불러온다(번들 분리).
// ============================================================================

const BEEP_JSON = '/bgm/beepbox.json'
const LS_KEY = 'ultor-bgm-beepbox'
/** lib/bgm 과 같은 이벤트 — 곡이 바뀌면 재생기·관리 창이 다시 고른다 */
const EVENT = 'ultor-bgm-store'

type BeepFile = { songs: Record<string, string>; gain: Record<string, number> }
let published: BeepFile = { songs: {}, gain: {} }
let local: Record<string, string> = {}
let ready: Promise<void> | null = null

export const beepEditorUrl = (song: string) => `https://www.beepbox.co/#${song}`

export function initBeep(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  ready ??= (async () => {
    try {
      local = JSON.parse(localStorage.getItem(LS_KEY) || '{}') as Record<string, string>
    } catch {
      local = {}
    }
    try {
      const res = await fetch(BEEP_JSON, { cache: 'no-cache' })
      if (res.ok) {
        const j = (await res.json()) as Partial<BeepFile>
        published = { songs: j.songs ?? {}, gain: j.gain ?? {} }
      }
    } catch {
      /* 배포 목록이 없으면 이 브라우저 것만 */
    }
  })()
  return ready
}

export interface BeepPick {
  song: string
  gain: number
  /** 'override' = 이 브라우저에서 고친 곡 · 'static' = 배포본 */
  from: 'override' | 'static'
}
export function beepFor(slotId: string, from?: 'override' | 'static'): BeepPick | null {
  const gain = published.gain[slotId] ?? 1
  if (from !== 'static' && local[slotId]) return { song: local[slotId], gain, from: 'override' }
  if (from !== 'override' && published.songs[slotId]) return { song: published.songs[slotId], gain, from: 'static' }
  return null
}
export const hasPublishedBeep = (slotId: string) => !!published.songs[slotId]

function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(local))
  } catch {
    /* 저장소를 못 쓰면 이번 세션만 */
  }
  window.dispatchEvent(new CustomEvent(EVENT))
}
/** 고친 곡 넣기(null = 배포본으로 되돌리기) */
export function setBeepEdit(slotId: string, song: string | null) {
  if (song) local = { ...local, [slotId]: song }
  else {
    const { [slotId]: _drop, ...rest } = local
    void _drop
    local = rest
  }
  save()
}

/** 붙여넣은 빕박스 주소·곡 문자열 → 곡 문자열(빕박스가 읽을 수 있을 때만) */
export async function parseBeepInput(text: string): Promise<string | null> {
  const t = text.trim()
  const raw = t.includes('#') ? t.slice(t.indexOf('#') + 1) : t
  let s = raw
  try {
    s = decodeURIComponent(raw)
  } catch {
    /* 그대로 */
  }
  if (!s) return null
  try {
    const { Song } = await import('beepbox')
    const song = new Song(s)
    if (!song.channels?.length || song.barCount < 1) return null
    return song.toBase64String()
  } catch {
    return null
  }
}

/** 배포용 파일 — 배포본 + 이 브라우저에서 고친 곡 */
export function exportBeepJson(): string {
  return JSON.stringify({ songs: { ...published.songs, ...local }, gain: published.gain }, null, 1) + '\n'
}

// ── 재생 ─────────────────────────────────────────────────────────────────────

/** bgm-player 가 오디오 요소와 똑같이 다루는 빕박스 재생기 */
export class BeepTrack {
  private synth: import('beepbox').Synth | null = null
  private loading: Promise<void> | null = null
  private vol = 0
  private wantPlay = false
  private started = false
  private startBar = 0
  ended = false

  constructor(
    private song: string,
    private gain: number,
    private once: boolean,
  ) {}

  private load(): Promise<void> {
    this.loading ??= import('beepbox').then(({ Synth, Song }) => {
      const s = new Synth(new Song(this.song))
      s.loopRepeatCount = this.once ? 0 : -1
      s.volume = this.vol * this.gain
      if (this.startBar > 0) s.playhead = this.startBar % Math.max(1, s.song?.barCount ?? 1)
      this.synth = s
    })
    return this.loading
  }

  get volume() {
    return this.vol
  }
  set volume(v: number) {
    this.vol = v
    if (this.synth) this.synth.volume = v * this.gain
  }
  get paused() {
    return !this.synth?.playing
  }

  async play(): Promise<void> {
    this.wantPlay = true
    await this.load()
    if (!this.wantPlay || !this.synth || this.ended) return
    this.synth.play()
    this.started = true
    // 한 번만 나오는 곡 — 끝나면 신디가 스스로 멈춘다
    if (this.once) {
      const watch = () => {
        if (!this.synth || !this.wantPlay) return
        if (!this.synth.playing) this.ended = true
        else setTimeout(watch, 250)
      }
      setTimeout(watch, 250)
    }
    // 브라우저가 아직 소리를 막고 있으면(사용자 입력 전) 오디오 요소처럼 실패로 알린다
    const ctx = (this.synth as unknown as { audioCtx?: AudioContext }).audioCtx
    if (ctx && ctx.state !== 'running') {
      // resume 은 비동기 — 끝나기를(최대 0.8초) 기다린 뒤에 판단한다
      await Promise.race([ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 800))])
      if ((ctx.state as string) !== 'running') {
        this.synth.pause()
        this.wantPlay = false
        throw new Error('autoplay blocked')
      }
    }
  }
  pause() {
    this.wantPlay = false
    this.synth?.pause()
  }
  /** 이어 틀 자리(마디) */
  get position(): number {
    return this.synth?.playhead ?? this.startBar
  }
  set position(bar: number) {
    this.startBar = bar
    if (this.synth) this.synth.playhead = bar % Math.max(1, this.synth.song?.barCount ?? 1)
  }
  get hasStarted() {
    return this.started
  }
  dispose() {
    this.wantPlay = false
    const s = this.synth
    if (!s) return
    s.pause()
    // 오디오 컨텍스트를 닫는다(브라우저마다 동시에 열 수 있는 수가 정해져 있다)
    ;(s as unknown as { deactivateAudio?: () => void }).deactivateAudio?.()
    this.synth = null
  }
}
