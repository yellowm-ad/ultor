// 빕박스(BeepBox) 배경음 생성기(2026-11-10) — 브금 칸마다 오리지널 곡을 지어 public/bgm/beepbox.json 에 적는다.
//   · 분위기: 8~90년대 16비트 JRPG(하프 아르페지오 · 현악 패드 · 플루트/오보에 리드 · 금관 전투 · 넉넉한 잔향).
//     특정 게임의 멜로디를 옮기지 않는다 — 곡마다 정한 화성 진행 위에 시드 고정 난수로 선율을 새로 짓는다.
//   · 결과: { "칸 id": "빕박스 곡 문자열" } — beepbox.co/#<문자열> 로 열어 고칠 수 있다(관리자 「브금 관리」).
//   · 같은 시드면 같은 곡. 마음에 안 드는 곡은 SONGS 의 seed 만 바꿔 다시 돌리면 된다.
// usage: node scripts/gen-bgm-beepbox.mjs            (전부)
//        node scripts/gen-bgm-beepbox.mjs town:ACADEMY  (그 칸만 다시 — 나머지는 파일 그대로)
import fs from 'node:fs'
import path from 'node:path'
import { Song, Synth } from 'beepbox'

const OUT = path.join(process.cwd(), 'public', 'bgm', 'beepbox.json')

// ── 음계·화음 ────────────────────────────────────────────────────────────────
const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
}
const KEYS = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }
const KEY_NAME = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

function rng(seed) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
}
const pickW = (r, items) => {
  const tot = items.reduce((a, [, w]) => a + w, 0)
  let x = r() * tot
  for (const [v, w] of items) if ((x -= w) <= 0) return v
  return items[items.length - 1][0]
}

/**
 * 화음 표기: '1' '4' '6' … (음계 도수 3화음), 접미사
 *   '^' 장3화음으로(단조의 V), 'm' 단3화음으로, '7' 7음 추가, 's' sus4, 'b' 반음 내린 근음(♭VI·♭VII 차용)
 */
function chordPcs(sym, tonic, mode) {
  const sc = MODES[mode]
  const m = /^(b?)(\d)([\^ms7]*)$/.exec(sym)
  if (!m) throw new Error('bad chord ' + sym)
  const d = Number(m[2]) - 1
  const deg = (k) => sc[(d + k) % 7] + 12 * Math.floor((d + k) / 7)
  let root = deg(0)
  let third = deg(2)
  let fifth = deg(4)
  let seventh = deg(6)
  if (m[1] === 'b') {
    root -= 1
    third -= 1
    fifth -= 1
    seventh -= 1
  }
  const fl = m[3]
  if (fl.includes('^')) third = root + 4
  if (fl.includes('m')) third = root + 3
  if (fl.includes('^') || fl.includes('m')) fifth = root + 7
  if (fl.includes('s')) third = root + 5
  const tones = [root, third, fifth]
  if (fl.includes('7')) tones.push(fl.includes('^') ? root + 10 : seventh)
  return { root: (tonic + root) % 12, pcs: tones.map((t) => (tonic + t) % 12) }
}
const scalePcs = (tonic, mode) => MODES[mode].map((i) => (tonic + i) % 12)
const inRange = (pcs, lo, hi) => {
  const out = []
  for (let p = lo; p <= hi; p++) if (pcs.includes(((p % 12) + 12) % 12)) out.push(p)
  return out
}

// ── 악기(빕박스 JSON) — 16비트 RPG 음색 ──────────────────────────────────────
const env = (target, envelope) => ({ target, envelope })
const INST = {
  // 하프(뜯는 현) — 아르페지오
  harp: (o = {}) => ({ type: 'Picked String', volume: o.vol ?? 70, eqFilter: [], effects: ['panning', 'reverb'], pan: o.pan ?? -20, reverb: o.rev ?? 55, fadeInSeconds: 0, fadeOutTicks: 48, harmonics: [100, 86, 57, 43, 29, 14, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], unison: 'none', stringSustain: 55, envelopes: [] }),
  // 피치카토 현
  pizz: (o = {}) => ({ type: 'Picked String', volume: o.vol ?? 70, eqFilter: [], effects: ['panning', 'reverb'], pan: o.pan ?? 25, reverb: o.rev ?? 40, fadeInSeconds: 0, fadeOutTicks: 12, harmonics: [100, 71, 43, 43, 29, 14, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], unison: 'none', stringSustain: 15, envelopes: [] }),
  // 플루트 — 숨소리 섞인 부드러운 리드
  flute: (o = {}) => ({ type: 'harmonics', volume: o.vol ?? 75, eqFilter: [], effects: ['vibrato', 'panning', 'reverb'], vibrato: 'delayed', pan: o.pan ?? 0, reverb: o.rev ?? 50, fadeInSeconds: 0.0125, fadeOutTicks: 12, harmonics: [100, 43, 29, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], unison: 'none', envelopes: [] }),
  // 오보에 — 콧소리 리드(잔잔한 마을·회상)
  oboe: (o = {}) => ({ type: 'harmonics', volume: o.vol ?? 70, eqFilter: [], effects: ['vibrato', 'panning', 'reverb'], vibrato: 'delayed', pan: o.pan ?? 10, reverb: o.rev ?? 45, fadeInSeconds: 0.0125, fadeOutTicks: 12, harmonics: [57, 100, 86, 71, 57, 43, 29, 14, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], unison: 'none', envelopes: [] }),
  // 클라리넷 — 홀수 배음(수업·장난스러운 곡)
  clarinet: (o = {}) => ({ type: 'harmonics', volume: o.vol ?? 70, eqFilter: [], effects: ['vibrato', 'panning', 'reverb'], vibrato: 'light', pan: o.pan ?? -10, reverb: o.rev ?? 35, fadeInSeconds: 0, fadeOutTicks: 6, harmonics: [100, 0, 57, 0, 43, 0, 29, 0, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], unison: 'none', envelopes: [] }),
  // 현악 패드 — 천천히 차오르는 화음
  strings: (o = {}) => ({ type: 'harmonics', volume: o.vol ?? 55, eqFilter: [], effects: ['chord type', 'reverb'], chord: 'simultaneous', reverb: o.rev ?? 35, fadeInSeconds: o.fadeIn ?? 0.15, fadeOutTicks: 24, harmonics: [100, 86, 71, 57, 43, 29, 29, 14, 14, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], unison: 'none', envelopes: [] }),
  // 오르간 — 성·신전
  organ: (o = {}) => ({ type: 'harmonics', volume: o.vol ?? 55, eqFilter: [], effects: ['chord type', 'reverb'], chord: 'simultaneous', reverb: o.rev ?? 70, fadeInSeconds: 0.025, fadeOutTicks: 24, harmonics: [100, 100, 0, 71, 0, 0, 0, 57, 0, 0, 0, 0, 0, 0, 0, 43, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], unison: 'none', envelopes: [] }),
  // 금관 — 전투 리드(톱니파 + 부풀기)
  brass: (o = {}) => ({ type: 'chip', volume: o.vol ?? 60, eqFilter: [{ type: 'low-pass', cutoffHz: 2828, linearGain: 0.7071 }], effects: ['vibrato', 'panning', 'reverb'], vibrato: 'light', pan: o.pan ?? 0, reverb: o.rev ?? 30, fadeInSeconds: 0.0125, fadeOutTicks: 6, wave: 'sawtooth', unison: 'honky tonk', envelopes: [env('noteVolume', 'swell 1')] }),
  // 레트로 펄스 리드(미니게임·칩 느낌)
  pulse: (o = {}) => ({ type: 'chip', volume: o.vol ?? 55, eqFilter: [], effects: ['vibrato', 'reverb'], vibrato: 'light', reverb: o.rev ?? 25, fadeInSeconds: 0, fadeOutTicks: 6, wave: '1/4 pulse', unison: 'none', envelopes: [] }),
  // 종 · 오르골
  bell: (o = {}) => ({ type: 'harmonics', volume: o.vol ?? 55, eqFilter: [], effects: ['echo', 'panning', 'reverb'], echoSustain: 40, echoDelayBeats: 0.75, pan: o.pan ?? 15, reverb: o.rev ?? 60, fadeInSeconds: 0, fadeOutTicks: 48, harmonics: [100, 0, 0, 57, 0, 0, 0, 0, 43, 0, 0, 0, 0, 0, 29, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], unison: 'shimmer', envelopes: [env('noteVolume', 'decay 2')] }),
  // 첼레스타 — 반짝이는 마법 음색(학교·타이틀 반주)
  celesta: (o = {}) => ({ type: 'harmonics', volume: o.vol ?? 50, eqFilter: [], effects: ['echo', 'panning', 'reverb'], echoSustain: 30, echoDelayBeats: 0.5, pan: o.pan ?? 25, reverb: o.rev ?? 35, fadeInSeconds: 0, fadeOutTicks: 24, harmonics: [100, 29, 0, 43, 0, 0, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], unison: 'shimmer', envelopes: [env('noteVolume', 'decay 1')] }),
  // 일렉 피아노(로즈 풍) — K팝식 7·9도 코드 반주. 배음이 적어 잡음이 없다
  epiano: (o = {}) => ({ type: 'harmonics', volume: o.vol ?? 45, eqFilter: [{ type: 'low-pass', cutoffHz: 2828, linearGain: 0.7071 }], effects: ['chord type', 'reverb'], chord: 'simultaneous', reverb: o.rev ?? 25, fadeInSeconds: 0, fadeOutTicks: 24, harmonics: [100, 29, 0, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], unison: 'none', envelopes: [env('noteVolume', 'decay 3')] }),
  // 펑크 베이스 — 뜯는 현으로 짧게 끊어 친다(울림 없이 통통). 저역을 깎아 '쿵' 하지 않게
  funkBass: (o = {}) => ({ type: 'Picked String', volume: o.vol ?? 55, eqFilter: [{ type: 'high-pass', cutoffHz: 88, linearGain: 0.7071 }, { type: 'low-pass', cutoffHz: 1414, linearGain: 1 }], effects: [], fadeInSeconds: 0, fadeOutTicks: -3, harmonics: [100, 71, 43, 29, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], unison: 'none', stringSustain: 14, envelopes: [] }),
  // 부드러운 서브 베이스 — 낮게 깔리고 튀지 않는다
  bassSub: (o = {}) => ({ type: 'harmonics', volume: o.vol ?? 50, eqFilter: [{ type: 'low-pass', cutoffHz: 354, linearGain: 0.7071 }], effects: [], fadeInSeconds: 0.0125, fadeOutTicks: 24, harmonics: [100, 29, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], unison: 'none', envelopes: [] }),
  // 웅장한 금관(톱니 대신 배음 몇 개 — 거칠지 않게)
  horn: (o = {}) => ({ type: 'harmonics', volume: o.vol ?? 60, eqFilter: [{ type: 'low-pass', cutoffHz: 2000, linearGain: 0.7071 }], effects: ['vibrato', 'reverb'], vibrato: 'delayed', reverb: o.rev ?? 40, fadeInSeconds: 0.025, fadeOutTicks: 24, harmonics: [100, 71, 57, 43, 29, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], unison: 'none', envelopes: [env('noteVolume', 'swell 1')] }),
  // 보컬로이드 풍 기계음 — 모음 '아' 같은 배음 + 음 사이 미끄러짐(슬라이드) + 늦게 걸리는 떨림. 가이드 멜로디용
  voca: (o = {}) => ({ type: 'harmonics', volume: o.vol ?? 50, eqFilter: [{ type: 'low-pass', cutoffHz: 4000, linearGain: 0.7071 }], effects: ['transition type', 'note filter', 'vibrato', 'panning', 'reverb'], transition: 'slide', noteFilter: [{ type: 'peak', cutoffHz: 1414, linearGain: 2 }], vibrato: 'delayed', pan: 0, reverb: o.rev ?? 30, fadeInSeconds: 0.0125, fadeOutTicks: 12, harmonics: [71, 100, 86, 57, 43, 57, 43, 29, 14, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], unison: 'none', envelopes: [] }),
  // 펠트 피아노 — 잔잔한 곡(마인크래프트 OST 풍): 부드럽게 울리고 길게 사라진다
  piano: (o = {}) => ({ type: 'harmonics', volume: o.vol ?? 55, eqFilter: [{ type: 'low-pass', cutoffHz: 2000, linearGain: 0.7071 }], effects: ['panning', 'echo', 'reverb'], pan: o.pan ?? 0, echoSustain: 15, echoDelayBeats: 0.75, reverb: o.rev ?? 55, fadeInSeconds: 0, fadeOutTicks: 96, harmonics: [100, 43, 14, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], unison: 'none', envelopes: [env('noteVolume', 'decay 1')] }),
  // 칩 리드 — 전투(언더테일 풍): 사각파 + 가벼운 떨림
  chipLead: (o = {}) => ({ type: 'chip', volume: o.vol ?? 50, eqFilter: [{ type: 'low-pass', cutoffHz: 4000, linearGain: 0.7071 }], effects: ['vibrato', 'panning', 'reverb'], vibrato: 'light', pan: o.pan ?? 0, reverb: o.rev ?? 15, fadeInSeconds: 0, fadeOutTicks: -3, wave: 'square', unison: 'none', envelopes: [] }),
  // 칩 더블링 — 리드 한 옥타브 아래(펄스 1/4)
  chipLow: (o = {}) => ({ type: 'chip', volume: o.vol ?? 38, eqFilter: [{ type: 'low-pass', cutoffHz: 2828, linearGain: 0.7071 }], effects: ['panning'], pan: o.pan ?? -20, fadeInSeconds: 0, fadeOutTicks: -3, wave: '1/4 pulse', unison: 'none', envelopes: [] }),
  // 삼각파 아르페지오 — 1/8 펄스보다 훨씬 깨끗하다
  arpTri: (o = {}) => ({ type: 'chip', volume: o.vol ?? 36, eqFilter: [], effects: ['chord type', 'panning'], chord: 'arpeggio', pan: 20, fadeInSeconds: 0, fadeOutTicks: -3, wave: 'triangle', unison: 'none', envelopes: [] }),
  // 칩 베이스 — 삼각파 8분음(쿵 하지 않게 작게)
  chipBass: (o = {}) => ({ type: 'chip', volume: o.vol ?? 40, eqFilter: [{ type: 'high-pass', cutoffHz: 62, linearGain: 0.7071 }], effects: [], fadeInSeconds: 0, fadeOutTicks: -3, wave: 'triangle', unison: 'none', envelopes: [] }),
  // 아르페지오 칩(전투 화음 빠른 분산)
  arpchip: (o = {}) => ({ type: 'chip', volume: o.vol ?? 40, eqFilter: [], effects: ['chord type', 'reverb'], chord: 'arpeggio', reverb: o.rev ?? 25, fadeInSeconds: 0, fadeOutTicks: -3, wave: '1/8 pulse', unison: 'none', envelopes: [] }),
  // 베이스들
  bassPluck: (o = {}) => ({ type: 'Picked String', volume: o.vol ?? 80, eqFilter: [], effects: ['reverb'], reverb: 15, fadeInSeconds: 0, fadeOutTicks: 12, harmonics: [100, 57, 29, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], unison: 'none', stringSustain: 40, envelopes: [] }),
  bassSoft: (o = {}) => ({ type: 'chip', volume: o.vol ?? 75, eqFilter: [], effects: ['reverb'], reverb: 15, fadeInSeconds: 0, fadeOutTicks: 12, wave: 'triangle', unison: 'none', envelopes: [] }),
  bassDrive: (o = {}) => ({ type: 'chip', volume: o.vol ?? 60, eqFilter: [{ type: 'low-pass', cutoffHz: 1414, linearGain: 1 }], effects: ['reverb'], reverb: 10, fadeInSeconds: 0, fadeOutTicks: -3, wave: 'double saw', unison: 'none', envelopes: [env('noteVolume', 'punch')] }),
  // 타악(노이즈 채널)
  kick: () => ({ type: 'noise', volume: 80, eqFilter: [{ type: 'low-pass', cutoffHz: 707, linearGain: 1 }], effects: ['reverb'], reverb: 15, fadeInSeconds: 0, fadeOutTicks: -3, wave: 'retro', envelopes: [] }),
  timpani: () => ({ type: 'noise', volume: 75, eqFilter: [{ type: 'low-pass', cutoffHz: 500, linearGain: 1.4 }], effects: ['reverb'], reverb: 45, fadeInSeconds: 0, fadeOutTicks: 24, wave: 'hollow', envelopes: [] }),
  snare: () => ({ type: 'noise', volume: 60, eqFilter: [{ type: 'low-pass', cutoffHz: 5657, linearGain: 0.7071 }], effects: ['reverb'], reverb: 20, fadeInSeconds: 0, fadeOutTicks: -3, wave: 'white', envelopes: [] }),
  chipSnare: () => ({ type: 'noise', volume: 40, eqFilter: [{ type: 'high-pass', cutoffHz: 707, linearGain: 0.7071 }], effects: [], fadeInSeconds: 0, fadeOutTicks: -3, wave: 'white', envelopes: [] }),
  // 클랩 — 저지 클럽 2·4박(가운데만 남긴 노이즈라 쉬익 소리가 덜하다)
  clap: () => ({ type: 'noise', volume: 55, eqFilter: [{ type: 'high-pass', cutoffHz: 1000, linearGain: 0.7071 }, { type: 'low-pass', cutoffHz: 4000, linearGain: 0.7071 }], effects: ['reverb'], reverb: 20, fadeInSeconds: 0, fadeOutTicks: -3, wave: 'white', envelopes: [] }),
  hat: () => ({ type: 'noise', volume: 20, eqFilter: [{ type: 'high-pass', cutoffHz: 5657, linearGain: 0.7071 }, { type: 'low-pass', cutoffHz: 9000, linearGain: 0.7071 }], effects: [], fadeInSeconds: 0, fadeOutTicks: -12, wave: 'white', envelopes: [] }),
}

// ── 리듬 틀(한 마디 = 걸음 수, 음수 = 쉼) ────────────────────────────────────
const RHY = {
  4: {
    calm: [[[8, 4, 4], 3], [[4, 4, 8], 3], [[6, 2, 8], 3], [[12, 4], 2], [[4, 2, 2, 8], 2], [[16], 1]],
    flow: [[[4, 2, 2, 4, 4], 3], [[6, 2, 4, 4], 3], [[2, 2, 4, 4, 4], 2], [[4, 4, 8], 2], [[3, 3, 2, 8], 2], [[8, 4, 4], 2]],
    bouncy: [[[2, 2, 2, 2, 4, 4], 3], [[3, 1, 2, 2, 4, 4], 3], [[4, -2, 2, 4, 4], 2], [[2, 2, 4, 2, 2, 4], 2], [[6, 2, 4, 4], 2]],
    drive: [[[2, 2, 2, 2, 2, 2, 4], 3], [[3, 3, 2, 4, 4], 3], [[6, 2, 2, 2, 4], 3], [[4, 2, 2, 4, 2, 2], 2], [[1, 1, 2, 4, 4, 4], 2]],
  },
  3: {
    calm: [[[8, 4], 3], [[4, 4, 4], 2], [[12], 1], [[6, 2, 4], 2]],
    flow: [[[4, 2, 2, 4], 3], [[6, 2, 4], 3], [[4, 4, 4], 2], [[2, 2, 4, 4], 2], [[8, 4], 2]],
    bouncy: [[[4, 2, 2, 4], 3], [[2, 2, 2, 2, 4], 2], [[4, 4, 4], 2]],
    drive: [[[2, 2, 2, 2, 4], 3], [[4, 2, 2, 4], 3]],
  },
}
const CADENCE = { 4: [[[4, 4, 8], 2], [[8, 8], 2], [[16], 1], [[6, 2, 8], 2]], 3: [[[12], 2], [[8, 4], 1], [[4, 8], 1]] }

// ── 선율 짓기 ────────────────────────────────────────────────────────────────
/** 한 마디의 음표들(시작 걸음 · 길이 · 음높이 MIDI) */
function melodyBar(r, { rhythm, chord, scale, lo, hi, prev, dir, cadenceTo, bpb }) {
  const out = []
  let t = 0
  let p = prev
  const strong = (s) => s % (bpb === 3 ? 4 : 8) === 0
  rhythm.forEach((len, i) => {
    const L = Math.abs(len)
    if (len < 0) {
      t += L
      return
    }
    const last = i === rhythm.length - 1
    const ct = inRange(chord.pcs, lo, hi)
    const st = inRange(scale, lo, hi)
    let cand = strong(t) || L >= 4 ? ct : st
    if (last && cadenceTo != null) cand = inRange([cadenceTo], lo, hi)
    // 가까운 음 선호 · 정해진 방향 선호 · 같은 음 연타는 덜
    const scored = cand.map((c) => {
      const d = c - p
      let w = Math.max(0.05, 6 - Math.abs(d)) ** 2
      if (Math.sign(d) === dir) w *= 1.8
      if (d === 0) w *= 0.35
      if (Math.abs(d) > 7) w *= 0.15
      return [c, w]
    })
    p = pickW(r, scored)
    out.push({ s: t, l: L, p: [p] })
    t += L
  })
  return { notes: out, last: p }
}

/** 동기(2마디 리듬+음정)를 새 화음 위로 옮긴다 — 음정 모양은 지키고 센박은 화음음에 맞춘다 */
function sequenceBars(motif, chords, scale, lo, hi, start, bpb) {
  const out = []
  let p = start
  let orig = null
  motif.forEach((bar, bi) => {
    const ns = []
    for (const n of bar) {
      const want = orig == null ? p : p + (n.p[0] - orig)
      orig = n.p[0]
      const strong = n.s % (bpb === 3 ? 4 : 8) === 0 || n.l >= 4
      const pool = inRange(strong ? chords[bi].pcs : scale, lo, hi)
      p = pool.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a), pool[0])
      ns.push({ s: n.s, l: n.l, p: [p] })
    }
    out.push(ns)
  })
  return { bars: out, last: p }
}

/** 한 섹션(보통 8마디) 선율 — a(2) a'(2, 다음 화음으로 옮김) a(2) 종지(2) */
function sectionMelody(r, sec, ctx) {
  const { scale, lo, hi, feel, bpb, tonicPc } = ctx
  const chords = sec.chords
  const n = chords.length
  const bars = []
  let prev = sec.startAt ?? Math.round((lo + hi) / 2)
  const rhy = RHY[bpb][feel]
  const r1 = pickW(r, rhy)
  const r2 = pickW(r, rhy)
  const motif = []
  let dir = r() < 0.5 ? 1 : -1
  for (let i = 0; i < 2 && i < n; i++) {
    const m = melodyBar(r, { rhythm: i === 0 ? r1 : r2, chord: chords[i], scale, lo, hi, prev, dir, bpb })
    motif.push(m.notes)
    prev = m.last
    dir = -dir
  }
  bars.push(...motif)
  for (let b = 2; b < n; b += 2) {
    const isEnd = b + 2 >= n
    const half = b === n / 2
    if (isEnd) {
      // 종지 — 앞마디는 동기 리듬, 끝마디는 긴 음으로 으뜸음(섹션 끝이 딸림이면 그 화음음)
      const m1 = melodyBar(r, { rhythm: r1, chord: chords[b], scale, lo, hi, prev, dir: -1, bpb })
      bars.push(m1.notes)
      prev = m1.last
      if (b + 1 < n) {
        const target = sec.endOn === 'dominant' ? chords[b + 1].pcs[0] : tonicPc
        const m2 = melodyBar(r, { rhythm: pickW(r, CADENCE[bpb]), chord: chords[b + 1], scale, lo, hi, prev, dir: -1, cadenceTo: target, bpb })
        bars.push(m2.notes)
        prev = m2.last
      }
    } else if (half) {
      // 반복 — 처음 동기를 다시(화음이 다르면 맞춰 옮김)
      const s = sequenceBars(motif, [chords[b], chords[b + 1] ?? chords[b]], scale, lo, hi, motif[0][0]?.p[0] ?? prev, bpb)
      bars.push(...s.bars.slice(0, Math.min(2, n - b)))
      prev = s.last
    } else {
      // 옮겨 짓기 — 동기 모양을 다음 화음 위로
      const s = sequenceBars(motif, [chords[b], chords[b + 1] ?? chords[b]], scale, lo, hi, prev + (r() < 0.5 ? 2 : -2), bpb)
      bars.push(...s.bars.slice(0, Math.min(2, n - b)))
      prev = s.last
    }
  }
  return bars
}

// ── 화음 성부(2026-11-10 3차) — 메인 멜로디 아래 3도·6도 ─────────────────────────
/** 멜로디 한 마디 → 아래 화음 성부. gap = [최소, 최대] 반음 아래. 센박·긴 음은 화음 구성음, 나머지는 음계음 */
function harmonyBar(bar, chord, scale, gap, minLen = 2) {
  const out = []
  for (const n of bar) {
    if (n.l < minLen) continue
    const top = n.p[0]
    const strong = n.s % 8 === 0 || n.l >= 4
    const pool = strong ? chord.pcs : scale
    let best = null
    for (let q = top - gap[1]; q <= top - gap[0]; q++) if (pool.includes(((q % 12) + 12) % 12)) best = best == null || Math.abs(top - q - (gap[0] + gap[1]) / 2) < Math.abs(top - best - (gap[0] + gap[1]) / 2) ? q : best
    if (best != null) out.push({ s: n.s, l: n.l, p: [best], vol: n.vol })
  }
  return out
}
/** 완급 — 프레이즈(4마디) 안에서 올라갔다 내려오고, 긴 음은 살짝 부풀린다 */
function shape(bar, barInPhrase, k = 1) {
  const curve = [0.7, 0.85, 1, 0.8][barInPhrase % 4]
  return bar.map((n) => {
    const v = Math.round(Math.min(100, 100 * curve * k))
    return { ...n, vol: n.l >= 6 ? [Math.round(v * 0.8), v] : [v, Math.round(v * 0.75)] }
  })
}

// ── 반주 ─────────────────────────────────────────────────────────────────────
/** K팝식 확장 — 근음을 빼고 3·5·7·9도(음계 안의 7도·9도). 근음은 베이스가 깐다 */
function extend(chord, scale) {
  const r = chord.root
  const inSc = (pc) => scale.includes(((pc % 12) + 12) % 12)
  const seventh = inSc(r + 11) ? r + 11 : r + 10
  const ninth = inSc(r + 2) ? r + 2 : r + 1
  const pcs = [chord.pcs[1], chord.pcs[2], seventh % 12, ninth % 12].filter((x, i, a) => a.indexOf(x) === i)
  return { root: pcs[0], pcs }
}

/** 화음 자리바꿈 — 앞 화음과 가장 가깝게(lo~hi 안에서 3~4음) */
function voicing(chord, prevV, lo, hi) {
  const opts = []
  for (let base = lo; base <= hi - 7; base++) {
    if (!chord.pcs.includes(((base % 12) + 12) % 12)) continue
    const v = [base]
    for (const pc of chord.pcs) {
      if (pc === ((base % 12) + 12) % 12) continue
      let q = base + 1
      while (((q % 12) + 12) % 12 !== pc) q++
      v.push(q)
    }
    v.sort((a, b) => a - b)
    if (v[v.length - 1] <= hi) opts.push(v)
  }
  if (!prevV) return opts[Math.floor(opts.length / 2)]
  const dist = (v) => v.reduce((a, x, i) => a + Math.abs(x - (prevV[i] ?? prevV[prevV.length - 1])), 0)
  return opts.reduce((a, b) => (dist(b) < dist(a) ? b : a), opts[0])
}

function accompBar(kind, chord, v, bpb, barIndex = 0) {
  const S = bpb * 4
  const notes = []
  if (kind === 'pad') notes.push({ s: 0, l: S, p: v, vol: [70, 85] })
  else if (kind === 'padHalf') {
    notes.push({ s: 0, l: S / 2, p: v, vol: [70, 80] })
    notes.push({ s: S / 2, l: S / 2, p: v, vol: [65, 75] })
  } else if (kind === 'harp') {
    // 위로 올라갔다 내려오는 분산화음 — 16분음표
    const up = [...v, v[0] + 12, v[1] + 12]
    const seq = [...up, ...up.slice(1, -1).reverse()]
    for (let s = 0; s < S; s += 2) notes.push({ s, l: 2, p: [seq[(s / 2) % seq.length]], vol: [s % 8 === 0 ? 85 : 65, 40] })
  } else if (kind === 'harp16') {
    const up = [v[0] - 12, ...v, v[0] + 12, v[1] + 12, v[2] + 12]
    for (let s = 0; s < S; s++) notes.push({ s, l: 1, p: [up[s % up.length]], vol: [s % 4 === 0 ? 80 : 55, 30] })
  } else if (kind === 'broken') {
    const pat = [0, 2, 1, 2]
    for (let s = 0; s < S; s += 2) notes.push({ s, l: 2, p: [v[pat[(s / 2) % 4] % v.length]], vol: [s % 4 === 0 ? 75 : 55, 40] })
  } else if (kind === 'waltz') {
    for (let s = 4; s < S; s += 4) notes.push({ s, l: 3, p: v, vol: [60, 40] })
  } else if (kind === 'stab') {
    for (let s = 2; s < S; s += 4) notes.push({ s, l: 1, p: v, vol: [80, 60] })
  } else if (kind === 'arp') notes.push({ s: 0, l: S, p: v, vol: [70, 70] })
  else if (kind === 'kchords') {
    // 일렉 피아노 코드 세 번(한 박 반 · 한 박 · 두 박) — 당김음으로 통통 튀되 꽉 채우지 않는다
    for (const [st, l, vol] of [[0, 6, 80], [6, 4, 60], [10, 6, 70]]) if (st < S) notes.push({ s: st, l: Math.min(l, S - st), p: v, vol: [vol, 30] })
  } else if (kind === 'sparse') {
    // 마인크래프트 풍 — 화음 음을 마디마다 다른 자리에 띄엄띄엄(패턴은 화음 근음으로 정해 반복이 자연스럽다)
    const P = [
      [[0, 8, 0], [8, 8, 2]],
      [[0, 4, 1], [4, 4, 2], [8, 8, 3]],
      [[0, 12, 2], [12, 4, 1]],
      [[2, 6, 3], [8, 4, 1], [12, 4, 2]],
      [[0, 16, 1]],
      [[0, 6, 2], [6, 10, 0]],
    ]
    const pat = P[(chord.root * 5 + v.length + barIndex) % P.length]
    for (const [st, l, k] of pat) if (st < S) notes.push({ s: st, l: Math.min(l, S - st), p: [v[k % v.length] + (k === 3 ? 12 : 0)], vol: [st === 0 ? 75 : 55, 25] })
  } else if (kind === 'swell') {
    // 웅장한 곡 — 마디 내내 차오르는 화음
    notes.push({ s: 0, l: S, p: v, vol: [55, 100] })
  } else if (kind === 'chime') {
    notes.push({ s: 0, l: 4, p: [v[v.length - 1] + 12], vol: [70, 0] })
    notes.push({ s: S / 2, l: 4, p: [v[1] + 12], vol: [55, 0] })
  }
  return notes
}

function bassBar(kind, chord, next, bpb, lo = 33) {
  const S = bpb * 4
  let root = lo
  while (((root % 12) + 12) % 12 !== chord.root) root++
  const fifth = root + 7
  const n = []
  if (kind === 'whole') n.push({ s: 0, l: S, p: [root], vol: [90, 60] })
  else if (kind === 'half') {
    n.push({ s: 0, l: S / 2, p: [root], vol: [90, 60] })
    n.push({ s: S / 2, l: S / 2, p: [bpb === 3 ? root : fifth], vol: [80, 55] })
  } else if (kind === 'walk') {
    let nr = lo
    while (((nr % 12) + 12) % 12 !== next.root) nr++
    const app = nr > root ? nr - 1 : nr + 1
    const steps = [root, root + (chord.pcs.includes((chord.root + 4) % 12) ? 4 : 3), fifth, app]
    for (let b = 0; b < bpb; b++) n.push({ s: b * 4, l: 3, p: [steps[b]], vol: [85, 50] })
  } else if (kind === 'drive') {
    for (let s = 0; s < S; s += 2) n.push({ s, l: 2, p: [s % 8 === 6 ? root + 12 : root], vol: [s % 4 === 0 ? 95 : 75, 50] })
  } else if (kind === 'gallop') {
    for (let s = 0; s < S; s += 4) {
      n.push({ s, l: 2, p: [root], vol: [95, 60] })
      n.push({ s: s + 2, l: 1, p: [root], vol: [70, 50] })
      n.push({ s: s + 3, l: 1, p: [s % 8 === 4 ? fifth : root + 12], vol: [70, 50] })
    }
  } else if (kind === 'waltz') n.push({ s: 0, l: 4, p: [root], vol: [90, 50] })
  else if (kind === 'lefthand') {
    // 피아노 왼손 — 근음 한 번(두 마디 화음이면 둘째 마디는 5도)
    n.push({ s: 0, l: S, p: [root + 12], vol: [60, 20] })
  } else if (kind === 'chip16') {
    // 16분음 — 강세(근음) · 고스트(작게) · 5도 · 옥타브가 굴러가듯(볼륨은 작게 유지)
    const seq = [root, root, root + 12, root, fifth, root, root + 12, root, root, root, root + 12, fifth, root, root + 12, fifth, root + 12]
    for (let st = 0; st < S; st++) n.push({ s: st, l: 1, p: [seq[st % 16]], vol: [st % 4 === 0 ? 85 : st % 2 === 0 ? 60 : 40, 30] })
  } else if (kind === 'chip8') {
    // 칩 베이스 8분 — 근음·옥타브 번갈아(작게)
    for (let st = 0; st < S; st += 2) n.push({ s: st, l: 2, p: [st % 4 === 2 ? root + 12 : root], vol: [st % 8 === 0 ? 85 : 65, 50] })
  } else if (kind === 'funk') {
    // 16분 당김음 — 근음 · 고스트 · 옥타브 팝 · 5도, 마지막 16분은 다음 코드로 반음 접근(오리지널 패턴)
    let nr = lo
    while (((nr % 12) + 12) % 12 !== next.root) nr++
    if (nr - root > 6) nr -= 12
    const app = nr === root ? root + 7 : nr > root ? nr - 1 : nr + 1
    const pat = [[0, 2, root, 90], [3, 1, root, 45], [4, 1, root + 12, 80], [6, 2, root, 75], [8, 1, fifth, 70], [10, 1, root + 12, 80], [11, 1, root, 45], [12, 2, root, 85], [14, 1, fifth, 60], [15, 1, app, 70]]
    for (const [st, l, p, v] of pat) if (st < S) n.push({ s: st, l, p: [p], vol: [v, Math.round(v * 0.6)] })
  } else if (kind === 'kpop') {
    // 서브 베이스 — 근음을 길게, 3박 앞에서 한 번 당겨 받친다(옥타브 점프 없음)
    n.push({ s: 0, l: Math.min(10, S), p: [root], vol: [85, 70] })
    if (S > 10) n.push({ s: 10, l: S - 10, p: [root], vol: [75, 55] })
  }
  else if (kind === 'pulse') {
    for (let s = 0; s < S; s += 4) n.push({ s, l: 3, p: [s % 8 === 0 ? root : fifth], vol: [85, 45] })
  }
  return n
}

const DRUMS = {
  // 각 [kick, snare, hat] — 걸음 목록(4/4 기준 16걸음)
  none: null,
  soft: { k: [0], s: [], h: [8], t: [] },
  march: { k: [0, 8], s: [4, 10, 12, 14], h: [], t: [] },
  groove: { k: [0, 6, 8], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14], t: [] },
  battle: { k: [0, 3, 8, 10], s: [4, 12], h: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], t: [] },
  boss: { k: [0, 2, 6, 8, 10, 14], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14], t: [0] },
  tribal: { k: [0, 3, 6, 10], s: [12], h: [], t: [0, 8, 11, 14] },
  timp: { k: [], s: [], h: [], t: [0] },
  waltz: { k: [0], s: [], h: [4, 8], t: [] },
  // 저지 클럽 바운스 — 킥 x..x..x.x...x.x. · 클랩 2·4 · 오프비트 하이햇
  jersey: { k: [], s: [4, 12], h: [2, 6, 10, 14], t: [], clap: true },
  // 잔잔한 마을용 — 킥을 덜고 클랩은 4박만
  jerseyLite: { k: [], s: [12], h: [2, 10], t: [], clap: true },
  // 긴장 고조 — 느리고 큰 북: 팀파니가 1·3박, 킥은 1박, 마디 끝에 스네어 롤
  epic: { k: [], s: [], h: [], t: [] },
  // 배경용(2026-11-10 4차) — 거슬리지 않게 아주 작게
  airy: { k: [], s: [], h: [2, 6, 10, 14], t: [] },
  // 칩 전투 — 2·4박 스네어 + 8분 하이햇(킥 없음)
  chip: { k: [], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14], t: [] },
  chipBoss: { k: [], s: [4, 10, 12], h: [0, 2, 4, 6, 8, 10, 12, 14], t: [] },
  pulseSoft: { k: [], s: [4, 12], h: [2, 6, 10, 14], t: [] },
}

// ── 곡 조립 ──────────────────────────────────────────────────────────────────
const pin = (t, v) => ({ tick: t, pitchBend: 0, volume: v })
function toPattern(notes) {
  return {
    notes: notes
      .filter((n) => n.l > 0)
      .map((n) => ({ pitches: n.p, points: [pin(n.s, n.vol?.[0] ?? 100), pin(n.s + n.l, n.vol?.[1] ?? (n.l >= 4 ? 80 : 100))] })),
  }
}
/** 마디마다 패턴 — 같은 내용은 한 패턴으로 */
function channel(type, instrument, bars, keyBase) {
  const patterns = []
  const seen = new Map()
  const sequence = bars.map((notes) => {
    if (!notes || !notes.length) return 0
    const pat = toPattern(type === 'drum' ? notes : notes.map((n) => ({ ...n, p: n.p.map((x) => x - keyBase) })))
    const k = JSON.stringify(pat)
    if (!seen.has(k)) {
      patterns.push(pat)
      seen.set(k, patterns.length)
    }
    return seen.get(k)
  })
  if (!patterns.length) patterns.push({ notes: [] })
  return { type, instruments: [instrument], patterns, sequence, octaveScrollBar: 3 }
}

/**
 * 곡 사양 → 빕박스 JSON
 * spec: { key, mode, bpm, bpb, sections: [{ chords: ['1','6',...], endOn? }], form: 'AB'|'AAB'|..., lead, leadRange, accomp, pad?, bass, drums, feel, seed }
 */
function buildSong(spec) {
  const r = rng(spec.seed)
  const tonic = KEYS[spec.key]
  const bpb = spec.bpb ?? 4
  const S = bpb * 4
  const scale = scalePcs(tonic, spec.mode)
  const [lo, hi] = spec.leadRange ?? [65, 86]
  // ── 구성(2026-11-10): 되풀이해도 어색하지 않게 약 2분 40초짜리 한 바퀴 ──
  //   주제 A → 전개 B → A 변주(새 선율·다른 반주) → 브리지 C → 간주(리드 쉼) → B 변주(높게) → A 절정(한 옥타브 위) → B(딸림으로 끝나 처음으로)
  const sections = { ...spec.sections }
  if (!sections.C && sections.A) {
    const a = sections.A.chords
    sections.C = { chords: [...a.slice(a.length / 2), ...a.slice(0, a.length / 2)], lift: 2 }
  }
  const chordsOf = {}
  for (const [name, sec] of Object.entries(sections)) chordsOf[name] = sec.chords.map((c) => chordPcs(c, tonic, spec.mode))
  const ALT_ACC = { harp: 'broken', broken: 'harp', harp16: 'harp', arp: 'stab', stab: 'arp', waltz: 'harp', pad: 'padHalf', padHalf: 'pad', chime: 'chime' }
  const LIGHT = { battle: 'groove', boss: 'battle', groove: 'soft', march: 'soft', tribal: 'timp', soft: 'none', waltz: 'none', timp: 'none', none: 'none' }
  const T = [
    ['A', 0, 0],
    ['B', 0, 0],
    ['A', 1, 1],
    ['C', 0, 0],
    ['A', -1, 1], // 간주 — 리드 쉼
    ['B', 1, 1],
    ['A', 2, 0, 12], // 절정 — 새 선율을 한 옥타브 위에서
    ['B', 0, 0],
  ].filter(([n]) => sections[n])
  const barSec = (bpb * 60) / spec.bpm
  const secBars = (n) => chordsOf[n].length
  const want = Math.min(128, Math.round((spec.seconds ?? 165) / barSec))
  const plan = []
  let total = 0
  for (let k = 0; plan.length < 64; k++) {
    const [n, take, alt, oct] = T[k % T.length]
    const round = Math.floor(k / T.length)
    if (total + secBars(n) > 128) break
    plan.push({ n, take: take < 0 ? -1 : take + round * 3, alt: (alt + round) % 2, oct: oct ?? 0 })
    total += secBars(n)
    // 목표 길이를 넘었고 지금이 B(딸림으로 끝남)면 여기서 한 바퀴를 맺는다
    if (total >= want && (spec.endAny || n === (sections.B ? 'B' : 'A'))) break
    if (total >= want + 24) break
  }
  const melCache = new Map()
  const melodyFor = (n, take, oct) => {
    const key = `${n}:${take}:${oct}`
    if (melCache.has(key)) return melCache.get(key)
    const sec = sections[n]
    const rr = take === 0 ? rng(spec.seed + n.charCodeAt(0) * 31) : rng(spec.seed + 7919 * take + n.charCodeAt(0) * 131)
    let lift = (sec.lift ?? 0) + oct
    if (hi + lift > 98) lift = Math.max(0, 98 - hi)
    const SOFTER = { drive: 'flow', bouncy: 'flow', flow: 'calm', calm: 'calm' }
    const feel = sec.feel ?? (n === 'B' && !oct ? SOFTER[spec.feel] ?? spec.feel : spec.feel)
    const m = sectionMelody(rr, { chords: chordsOf[n], endOn: sec.endOn, startAt: sec.startAt != null ? sec.startAt + lift : undefined }, { scale, lo: lo + lift, hi: hi + lift, feel, bpb, tonicPc: tonic })
    melCache.set(key, m)
    return m
  }
  void r
  const lead = []
  const harm1 = []
  const harm2 = []
  const acc = []
  const pad = []
  const bass = []
  const kick = []
  const snare = []
  const hat = []
  const timp = []
  let v = null
  let pv = null
  plan.forEach((it, pi) => {
    const sec = sections[it.n]
    const chords = chordsOf[it.n]
    const nextFirst = chordsOf[plan[(pi + 1) % plan.length].n][0]
    const mel = spec.lead && it.take >= 0 && (!spec.sparseLead || it.take > 0 || it.oct) ? melodyFor(it.n, it.take, it.oct) : null
    const accKind0 = sec.accomp ?? spec.accomp
    const accKind = accKind0 && (it.alt || it.take < 0) ? (ALT_ACC[accKind0] ?? accKind0) : accKind0
    const drums0 = sec.drums ?? spec.drums
    const drums = it.take < 0 ? (LIGHT[drums0] ?? drums0) : it.oct ? drums0 : it.alt ? (LIGHT[drums0] ?? drums0) : drums0
    const bassKind = sec.bass ?? spec.bass
    chords.forEach((ch, i) => {
      const next = chords[i + 1] ?? nextFirst
      // 완급: 처음 주제는 조금 여리게, 절정(옥타브 위)은 세게
      const k = it.oct ? 1.1 : it.take === 0 && pi === 0 ? 0.8 : 0.95
      const mb = mel ? shape(mel[i] ?? [], i, k) : []
      lead.push(mb)
      // 화음 2단 — 첫 주제는 3도만, 그 뒤로는 3도 + 6도
      harm1.push(spec.octaveDouble && mel ? mb.map((n) => ({ ...n, p: [n.p[0] - 12] })) : spec.harmony && mel ? harmonyBar(mb, ch, scale, [3, 4]) : [])
      harm2.push(spec.thirdVoice && mel ? harmonyBar(mb, ch, scale, [3, 4], 1) : spec.harmony && mel && !(it.take === 0 && pi === 0) ? harmonyBar(mb, ch, scale, [8, 9], 4) : [])
      v = spec.ext ? voicing(extend(ch, scale), v, spec.accRange?.[0] ?? 57, spec.accRange?.[1] ?? 79) : voicing(ch, v, spec.accRange?.[0] ?? 55, spec.accRange?.[1] ?? 74)
      acc.push(accKind ? accompBar(accKind, ch, v, bpb, acc.length) : [])
      if (spec.pad) {
        pv = voicing(ch, pv, 52, 70)
        pad.push(accompBar(spec.pad, ch, pv, bpb))
      }
      bass.push(bassKind ? bassBar(bassKind, ch, next, bpb, spec.bassLo ?? 33) : [])
      const D = DRUMS[drums]
      const lastOfSec = i === chords.length - 1
      const at = (list) => (list ?? []).map((s) => Math.round((s * S) / 16)).filter((s, k, a) => s < S && a.indexOf(s) === k)
      if (D) {
        const fill = lastOfSec && drums !== 'soft' && drums !== 'waltz' && drums !== 'timp' && drums !== 'jerseyLite'
        kick.push(at(D.k).map((s) => ({ s, l: 2, p: [1], vol: [100, 0] })))
        const dv = spec.drumVol ?? 1
        const sn = at(D.s).map((s) => ({ s, l: 2, p: [7], vol: [Math.round(90 * dv), 0] }))
        if (fill) for (let s = S - 4; s < S; s++) if (!sn.some((x) => x.s === s)) sn.push({ s, l: 1, p: [7], vol: [50 + (s - S + 4) * 12, 0] })
        snare.push(sn.sort((a, b) => a.s - b.s).filter((x, k, a) => k === 0 || x.s >= a[k - 1].s + a[k - 1].l))
        hat.push(at(D.h).map((s) => ({ s, l: 1, p: [11], vol: [Math.round((s % 4 === 0 ? 80 : 50) * dv), 0] })))
        timp.push(at(D.t).map((s) => ({ s, l: 4, p: [s === 0 ? 2 : 4], vol: [100, 0] })))
      } else {
        kick.push([])
        snare.push([])
        hat.push([])
        timp.push([])
      }
    })
  })
  const keyBase = 12 + tonic
  const chans = []
  if (spec.lead) chans.push(channel('pitch', INST[spec.lead]({ vol: spec.leadVol }), lead, keyBase))
  if (spec.octaveDouble && harm1.some((b) => b.length)) chans.push(channel('pitch', INST.chipLead({ vol: 20, pan: -15 }), harm1, keyBase))
  else if (spec.harmony && harm1.some((b) => b.length)) chans.push(channel('pitch', INST[spec.harmony[0]]({ vol: spec.harmVol ?? 40, pan: -25 }), harm1, keyBase))
  if (spec.thirdVoice && harm2.some((b) => b.length)) chans.push(channel('pitch', INST.voca({ vol: 20 }), harm2, keyBase))
  else if (spec.harmony && harm2.some((b) => b.length)) chans.push(channel('pitch', INST[spec.harmony[1]]({ vol: (spec.harmVol ?? 40) - 5, pan: 25 }), harm2, keyBase))
  if (spec.accomp) chans.push(channel('pitch', INST[spec.accInst ?? 'harp']({ vol: spec.accVol }), acc, keyBase))
  if (spec.pad) chans.push(channel('pitch', INST[spec.padInst ?? 'strings']({ vol: spec.padVol }), pad, keyBase))
  if (spec.bass) chans.push(channel('pitch', INST[spec.bassInst ?? 'bassPluck']({ vol: spec.bassVol }), bass, keyBase))
  if (kick.some((b) => b.length)) chans.push(channel('drum', INST.kick(), kick))
  if (snare.some((b) => b.length)) chans.push(channel('drum', spec.chipDrums ? INST.chipSnare() : spec.clap ? INST.clap() : INST.snare(), snare))
  if (hat.some((b) => b.length)) chans.push(channel('drum', INST.hat(), hat))
  if (timp.some((b) => b.length)) chans.push(channel('drum', INST.timpani(), timp))
  return jsonSong({ key: tonic, bpm: spec.bpm, bpb, bars: lead.length, chans, loop: !spec.once })
}

function jsonSong({ key, bpm, bpb, bars, chans, loop }) {
  return {
    format: 'BeepBox',
    version: 9,
    scale: 'expert',
    key: KEY_NAME[key],
    introBars: 0,
    loopBars: bars,
    beatsPerBar: bpb,
    ticksPerBeat: 4,
    beatsPerMinute: bpm,
    layeredInstruments: false,
    patternInstruments: false,
    channels: chans,
    ...(loop ? {} : {}),
  }
}

// ── 짧은 효과곡(손으로 적음) ─────────────────────────────────────────────────
/** notes: [시작 걸음, 길이, MIDI…] */
function jingle({ key, bpm, bpb = 4, bars, parts }) {
  const tonic = KEYS[key]
  const keyBase = 12 + tonic
  const S = bpb * 4
  const chans = parts.map(({ inst, notes, drum, o }) => {
    const per = Array.from({ length: bars }, () => [])
    for (const [s, l, ...p] of notes) {
      const b = Math.floor(s / S)
      per[b].push({ s: s - b * S, l: Math.min(l, S - (s - b * S)), p, vol: drum ? [100, 0] : [90, l >= 8 ? 50 : 80] })
    }
    return channel(drum ? 'drum' : 'pitch', INST[inst](o), per, keyBase)
  })
  return jsonSong({ key: tonic, bpm, bpb, bars, chans })
}

// ── 곡 목록(칸 id → 사양) ─────────────────────────────────────────────────────
// 진행은 8~90년대 RPG 에서 흔한 관용 진행(I–vi–IV–V, i–♭VI–♭VII–i, 하강 베이스 등) — 선율은 생성.
const SONGS = {
  // 타이틀 — 하프 분산화음 위 플루트, 현악 패드(서정·장엄)
  title: { key: 'D', mode: 'lydian', bpm: 72, lead: 'flute', leadVol: 65, accomp: 'harp16', accInst: 'celesta', accVol: 45, pad: 'pad', bass: 'whole', bassInst: 'bassSoft', drums: 'timp', feel: 'calm', form: 'AB', leadRange: [66, 86], seed: 7,
    sections: { A: { chords: ['1', '2^', '7m', '3m', '1', '2^', '6m', '5'] }, B: { chords: ['6m', '3m', '2^', '1', '6m', '2^', '5s', '5'], lift: 2, endOn: 'dominant' } } },
  // 마을 기본 — 오보에 + 피치카토, 걷는 베이스
  'town-default': { key: 'A', mode: 'dorian', bpm: 88, lead: 'oboe', leadVol: 60, accomp: 'harp', accInst: 'harp', pad: 'pad', padVol: 42, bass: 'half', bassInst: 'bassSoft', drums: 'none', feel: 'calm', form: 'AB', seed: 21,
    sections: { A: { chords: ['1', '4^', '1', '4^', 'b3', '4^', 'b7', '5m'] }, B: { chords: ['b6', 'b7', '1', '4^', 'b6', 'b7', '4^', '5m'], endOn: 'dominant' } } },
  'field-default': { key: 'E', mode: 'minor', bpm: 120, lead: 'flute', accomp: 'harp', accInst: 'harp', pad: 'padHalf', padVol: 40, bass: 'pulse', drums: 'march', feel: 'flow', form: 'AB', seed: 33,
    sections: { A: { chords: ['1', 'b6', 'b7', '1', '1', 'b6', '4', '5^'] }, B: { chords: ['b6', 'b7', '1', '1', '4', 'b6', 'b7', '5^'], lift: 2, endOn: 'dominant' } } },
  'battle-default': { key: 'A', mode: 'harmonic', bpm: 160, lead: 'brass', accomp: 'arp', accInst: 'arpchip', pad: 'stab', padInst: 'strings', padVol: 40, bass: 'drive', bassInst: 'bassDrive', drums: 'battle', feel: 'drive', form: 'AB', leadRange: [64, 84], seed: 41,
    sections: { A: { chords: ['1', '1', 'b6', 'b7', '1', '1', '4', '5^'] }, B: { chords: ['4', '4', '1', '1', 'b6', 'b7', '5^', '5^'], lift: 3, endOn: 'dominant' } } },
  'story-default': { seconds: 150, key: 'F', mode: 'major', bpm: 68, lead: 'oboe', leadVol: 52, accomp: 'harp', accInst: 'harp', pad: 'pad', padVol: 45, bass: 'whole', bassInst: 'bassSoft', drums: 'none', feel: 'calm', form: 'A', seed: 52,
    sections: { A: { chords: ['1', '3m', '4', '2^', '6', '2', '4m', '1'] } } },

  // ── 마을 · 거점 ──
  // 마법학교 — 리디안의 몽환적인 #4, 첼레스타 분산화음 + 플루트, 드럼 없이 은은하게
  'town:ACADEMY': { key: 'F', mode: 'lydian', bpm: 88, lead: 'flute', leadVol: 62, accomp: 'broken', accInst: 'celesta', accVol: 48, pad: 'pad', padVol: 42, bass: 'half', bassInst: 'bassSoft', drums: 'none', feel: 'flow', form: 'AB', seed: 101,
    sections: { A: { chords: ['1', '2^', '1', '2^', '6m', '3m', '2^', '5'] }, B: { chords: ['7m', '3m', '6m', '2^', '7m', '3m', '5s', '5'], lift: 2, endOn: 'dominant' } } },
  'town:COAST': { key: 'A', mode: 'mixolydian', bpm: 96, bpb: 3, lead: 'flute', accomp: 'waltz', accInst: 'harp', pad: 'pad', padVol: 35, bass: 'waltz', bassInst: 'bassPluck', drums: 'waltz', feel: 'flow', form: 'AB', seed: 113,
    sections: { A: { chords: ['1', 'b7', '4', '1', '1', 'b7', '4', '5'] }, B: { chords: ['4', '4', '1', '1', '2m', 'b7', '4', '5'], lift: 2, endOn: 'dominant' } } },
  'town:STORMHAVEN': { key: 'F', mode: 'lydian', bpm: 74, lead: 'bell', accomp: 'harp', accInst: 'harp', pad: 'pad', padVol: 50, bass: 'whole', bassInst: 'bassSoft', drums: 'none', feel: 'calm', form: 'AB', leadRange: [69, 89], seed: 127,
    sections: { A: { chords: ['1', '2^', '1', '2^', '3m', '6m', '2^', '5'] }, B: { chords: ['4', '5', '6m', '3m', '4', '2^', '5s', '5'] } } },
  'town:RUINS': { key: 'D', mode: 'minor', bpm: 78, lead: 'oboe', accomp: 'harp', accInst: 'harp', pad: 'pad', padVol: 42, bass: 'whole', drums: 'none', feel: 'calm', form: 'AB', seed: 139,
    sections: { A: { chords: ['1', 'b7', 'b6', '5^', '1', 'b7', 'b6', '5^'] }, B: { chords: ['4', '1', 'b6', 'b3', '4', '1', '2', '5^'], endOn: 'dominant' } } },
  'town:SNOWFIELD': { key: 'E', mode: 'major', bpm: 92, bpb: 3, lead: 'bell', accomp: 'waltz', accInst: 'harp', pad: 'pad', padVol: 40, bass: 'waltz', bassInst: 'bassSoft', drums: 'none', feel: 'flow', form: 'AB', leadRange: [71, 91], seed: 151,
    sections: { A: { chords: ['1', '3', '6', '4', '1', '3', '2', '5'] }, B: { chords: ['4', '1', '4', '1', '6', '2', '5', '5'], endOn: 'dominant' } } },
  'town:VOLCANO': { key: 'E', mode: 'phrygian', bpm: 92, lead: 'oboe', accomp: 'broken', accInst: 'pizz', pad: 'pad', padInst: 'organ', padVol: 35, bass: 'pulse', drums: 'tribal', feel: 'flow', form: 'AB', seed: 163,
    sections: { A: { chords: ['1', 'b2', '1', 'b2', '1', 'b7', 'b6', 'b2'] }, B: { chords: ['4', 'b7', '1', '1', 'b6', 'b7', 'b2', 'b2'] } } },
  'town:MORS': { key: 'C', mode: 'harmonic', bpm: 66, lead: 'oboe', leadVol: 60, accomp: 'pad', accInst: 'organ', bass: 'whole', drums: 'timp', feel: 'calm', form: 'AB', seed: 177,
    sections: { A: { chords: ['1', 'b6', '4', '5^', '1', 'b6', '2', '5^'] }, B: { chords: ['4', '1', 'b6', '5^', '4', 'b6', '5^7', '5^'], endOn: 'dominant' } } },

  // ── 야생 ──
  'field:ERDIA': { key: 'G', mode: 'major', bpm: 124, lead: 'flute', accomp: 'harp', accInst: 'harp', pad: 'padHalf', padVol: 38, bass: 'pulse', drums: 'march', feel: 'flow', form: 'AB', seed: 211,
    sections: { A: { chords: ['1', '5', '6', '4', '1', '5', '4', '5'] }, B: { chords: ['6', '3', '4', '1', '6', '3', '2', '5'], lift: 2, endOn: 'dominant' } } },
  'field:COAST': { key: 'D', mode: 'mixolydian', bpm: 128, lead: 'flute', accomp: 'broken', accInst: 'harp', pad: 'padHalf', padVol: 38, bass: 'gallop', drums: 'groove', feel: 'bouncy', form: 'AB', seed: 223,
    sections: { A: { chords: ['1', 'b7', '4', '1', '1', 'b7', '4', '5'] }, B: { chords: ['4', 'b7', '1', '1', '4', 'b7', '5', '5'], lift: 2, endOn: 'dominant' } } },
  'field:STORMHAVEN': { key: 'B', mode: 'minor', bpm: 134, lead: 'flute', accomp: 'harp16', accInst: 'harp', pad: 'pad', padVol: 40, bass: 'drive', bassInst: 'bassSoft', drums: 'groove', feel: 'drive', form: 'AB', seed: 239,
    sections: { A: { chords: ['1', 'b6', 'b3', 'b7', '1', 'b6', '4', '5^'] }, B: { chords: ['b6', 'b7', 'b3', 'b6', '4', '5^', '1', '5^'], lift: 2, endOn: 'dominant' } } },
  'field:RUINS': { key: 'F#', mode: 'dorian', bpm: 106, lead: 'oboe', accomp: 'broken', accInst: 'pizz', pad: 'pad', padVol: 40, bass: 'pulse', drums: 'soft', feel: 'flow', form: 'AB', seed: 251,
    sections: { A: { chords: ['1', '4', '1', '4', 'b7', '4', 'b3', '5'] }, B: { chords: ['b3', 'b7', '4', '1', 'b3', 'b7', '4', '5'], endOn: 'dominant' } } },
  'field:SNOWFIELD': { key: 'D', mode: 'minor', bpm: 112, lead: 'bell', accomp: 'harp', accInst: 'harp', pad: 'pad', padVol: 45, bass: 'half', bassInst: 'bassSoft', drums: 'soft', feel: 'flow', form: 'AB', leadRange: [69, 89], seed: 263,
    sections: { A: { chords: ['1', 'b7', 'b6', 'b7', '1', 'b7', 'b6', '5^'] }, B: { chords: ['b6', 'b3', 'b7', '4', 'b6', 'b3', '4', '5^'], endOn: 'dominant' } } },
  'field:VOLCANO': { key: 'E', mode: 'phrygian', bpm: 138, lead: 'brass', accomp: 'stab', accInst: 'strings', pad: null, bass: 'gallop', bassInst: 'bassDrive', drums: 'tribal', feel: 'drive', form: 'AB', seed: 277,
    sections: { A: { chords: ['1', '1', 'b2', '1', '1', '1', 'b7', 'b2'] }, B: { chords: ['4', '4', 'b6', 'b7', '4', 'b6', 'b2', 'b2'], lift: 2 } } },
  'field:MORS': { key: 'C#', mode: 'harmonic', bpm: 112, lead: 'oboe', accomp: 'harp', accInst: 'harp', pad: 'pad', padInst: 'organ', padVol: 38, bass: 'pulse', drums: 'timp', feel: 'flow', form: 'AB', seed: 289,
    sections: { A: { chords: ['1', '1', 'b6', '5^', '1', '4', 'b6', '5^'] }, B: { chords: ['4', 'b6', '4', '5^', '1', 'b6', '2', '5^'], endOn: 'dominant' } } },

  // ── 전투 ──
  'battle:ERDIA': { key: 'E', mode: 'harmonic', bpm: 158, lead: 'brass', accomp: 'arp', accInst: 'arpchip', pad: 'stab', padInst: 'strings', padVol: 40, bass: 'drive', bassInst: 'bassDrive', drums: 'battle', feel: 'drive', form: 'AB', seed: 311,
    sections: { A: { chords: ['1', 'b6', 'b7', '1', '1', 'b6', '4', '5^'] }, B: { chords: ['4', 'b7', 'b3', 'b6', '4', '5^', '1', '5^'], lift: 2, endOn: 'dominant' } } },
  'battle:COAST': { key: 'G', mode: 'dorian', bpm: 162, lead: 'brass', accomp: 'arp', accInst: 'arpchip', pad: 'stab', padInst: 'strings', padVol: 40, bass: 'gallop', bassInst: 'bassDrive', drums: 'battle', feel: 'drive', form: 'AB', seed: 323,
    sections: { A: { chords: ['1', '1', '4', '4', '1', 'b7', '4', '5^'] }, B: { chords: ['b3', 'b7', '4', '1', 'b3', 'b7', '5^', '5^'], lift: 2, endOn: 'dominant' } } },
  'battle:STORMHAVEN': { key: 'B', mode: 'harmonic', bpm: 168, lead: 'brass', accomp: 'arp', accInst: 'arpchip', pad: 'stab', padInst: 'strings', padVol: 40, bass: 'drive', bassInst: 'bassDrive', drums: 'battle', feel: 'drive', form: 'AB', seed: 337,
    sections: { A: { chords: ['1', 'b6', '1', 'b6', '4', '1', '2', '5^'] }, B: { chords: ['b6', 'b7', '1', '1', 'b6', 'b7', '5^', '5^'], lift: 2, endOn: 'dominant' } } },
  'battle:RUINS': { key: 'D', mode: 'harmonic', bpm: 154, lead: 'brass', accomp: 'arp', accInst: 'arpchip', pad: 'stab', padInst: 'strings', padVol: 40, bass: 'drive', bassInst: 'bassDrive', drums: 'battle', feel: 'drive', form: 'AB', seed: 349,
    sections: { A: { chords: ['1', 'b7', 'b6', '5^', '1', 'b7', 'b6', '5^'] }, B: { chords: ['4', '4', '1', '1', 'b6', '4', '5^', '5^'], lift: 2, endOn: 'dominant' } } },
  'battle:SNOWFIELD': { key: 'C', mode: 'minor', bpm: 160, lead: 'brass', accomp: 'arp', accInst: 'arpchip', pad: 'stab', padInst: 'strings', padVol: 40, bass: 'drive', bassInst: 'bassDrive', drums: 'battle', feel: 'drive', form: 'AB', seed: 361,
    sections: { A: { chords: ['1', 'b3', 'b7', '4', '1', 'b3', 'b6', '5^'] }, B: { chords: ['b6', 'b7', '1', '1', 'b6', 'b7', '5^', '5^'], lift: 2, endOn: 'dominant' } } },
  'battle:VOLCANO': { key: 'E', mode: 'phrygian', bpm: 166, lead: 'brass', accomp: 'arp', accInst: 'arpchip', pad: 'stab', padInst: 'strings', padVol: 40, bass: 'gallop', bassInst: 'bassDrive', drums: 'boss', feel: 'drive', form: 'AB', seed: 373,
    sections: { A: { chords: ['1', 'b2', '1', 'b2', '1', 'b7', 'b6', 'b2'] }, B: { chords: ['4', 'b2', '4', 'b2', 'b6', 'b7', '1', 'b2'], lift: 2 } } },
  'battle:MORS': { key: 'C#', mode: 'harmonic', bpm: 160, lead: 'brass', accomp: 'arp', accInst: 'arpchip', pad: 'pad', padInst: 'organ', padVol: 35, bass: 'drive', bassInst: 'bassDrive', drums: 'battle', feel: 'drive', form: 'AB', seed: 389,
    sections: { A: { chords: ['1', 'b6', '4', '5^', '1', 'b6', '2', '5^'] }, B: { chords: ['4', '1', 'b6', '5^', '4', 'b6', '5^7', '5^'], lift: 2, endOn: 'dominant' } } },
  'battle-boss': { key: 'F', mode: 'harmonic', bpm: 172, lead: 'brass', leadVol: 65, accomp: 'arp', accInst: 'arpchip', pad: 'stab', padInst: 'strings', padVol: 45, bass: 'gallop', bassInst: 'bassDrive', drums: 'boss', feel: 'drive', form: 'AAB', seed: 401,
    sections: { A: { chords: ['1', '1', 'b6', 'b6', '4', '4', '5^', '5^'] }, B: { chords: ['b6', 'b7', '1', '1', 'b6', 'b7', '5^7', '5^'], lift: 3, endOn: 'dominant' } } },
  'battle-final': { key: 'C', mode: 'harmonic', bpm: 156, lead: 'brass', leadVol: 65, accomp: 'arp', accInst: 'arpchip', pad: 'pad', padInst: 'organ', padVol: 45, bass: 'gallop', bassInst: 'bassDrive', drums: 'boss', feel: 'drive', form: 'ABAC', seed: 419,
    sections: {
      A: { chords: ['1', 'b6', '4', '5^', '1', 'b6', '2', '5^'] },
      B: { chords: ['4', '4', '1', '1', 'b6', 'b6', '5^', '5^'], lift: 3, endOn: 'dominant' },
      C: { chords: ['b6', 'b7', '1', '1', 'b6', 'b7', '5^7', '5^'], lift: 5, endOn: 'dominant', drums: 'battle' },
    } },

  // ── 기타 ──
  // 수업 — 도리안의 호기심, 클라리넷 + 피치카토, 아주 가벼운 박
  class: { key: 'G', mode: 'dorian', bpm: 100, lead: 'clarinet', leadVol: 60, accomp: 'broken', accInst: 'pizz', pad: 'pad', padInst: 'strings', padVol: 32, bass: 'walk', bassInst: 'bassSoft', drums: 'soft', feel: 'bouncy', form: 'AB', seed: 503,
    sections: { A: { chords: ['1', '4^', '1', '4^', 'b7', '4^', 'b3', '5m'] }, B: { chords: ['b3', '4^', 'b7', '1', 'b3', '4^', '2m', '5m'], endOn: 'dominant' } } },
  minigame: { key: 'C', mode: 'major', bpm: 140, lead: 'pulse', accomp: 'broken', accInst: 'pizz', bass: 'pulse', bassInst: 'bassSoft', drums: 'groove', feel: 'bouncy', form: 'AB', seed: 521,
    sections: { A: { chords: ['1', '4', '5', '1', '1', '4', '2', '5'] }, B: { chords: ['6', '4', '1', '5', '6', '4', '2', '5'], lift: 2, endOn: 'dominant' } } },
}

// 승리 · 패배 · 수업 종료 — 짧은 오리지널 효과곡(되풀이 없음)
const JINGLES = {
  'battle-win': jingle({ key: 'C', bpm: 132, bars: 4, parts: [
    { inst: 'brass', notes: [[0, 2, 67], [2, 2, 72], [4, 2, 76], [6, 2, 72], [8, 4, 79], [12, 4, 76], [16, 2, 77], [18, 2, 76], [20, 2, 74], [22, 2, 72], [24, 4, 74], [28, 4, 79], [32, 12, 84], [48, 16, 84]] },
    { inst: 'strings', o: { vol: 45 }, notes: [[0, 16, 60, 64, 67], [16, 16, 62, 65, 69], [32, 32, 60, 64, 67, 72]] },
    { inst: 'harp', notes: [[32, 2, 60], [34, 2, 64], [36, 2, 67], [38, 2, 72], [40, 2, 76], [42, 2, 79], [44, 4, 84]] },
    { inst: 'bassPluck', notes: [[0, 8, 36], [8, 8, 43], [16, 8, 41], [24, 8, 43], [32, 32, 36]] },
    { inst: 'timpani', drum: true, notes: [[0, 4, 2], [24, 2, 2], [26, 2, 2], [28, 2, 2], [30, 2, 2], [32, 8, 2]] },
  ] }),
  'battle-lose': jingle({ key: 'A', bpm: 70, bars: 4, parts: [
    { inst: 'oboe', notes: [[0, 6, 76], [6, 2, 74], [8, 8, 72], [16, 6, 71], [22, 2, 69], [24, 8, 68], [32, 16, 69], [48, 16, 69]] },
    { inst: 'strings', o: { vol: 45 }, notes: [[0, 16, 57, 60, 64], [16, 16, 52, 56, 59], [32, 32, 53, 57, 60]] },
    { inst: 'bassSoft', notes: [[0, 16, 45], [16, 16, 40], [32, 32, 41]] },
  ] }),
  'class-end': jingle({ key: 'G', bpm: 96, bars: 2, parts: [
    { inst: 'bell', notes: [[0, 4, 79], [4, 4, 83], [8, 4, 81], [12, 4, 74], [16, 4, 79], [20, 4, 81], [24, 8, 83]] },
    { inst: 'harp', notes: [[0, 2, 55], [2, 2, 59], [4, 2, 62], [6, 2, 67], [16, 2, 55], [18, 2, 60], [20, 2, 64], [22, 2, 67], [24, 8, 71]] },
  ] }),
}

// ── 편곡(2026-11-10 2차) — 사용자 피드백: 베이스 덜 튀게 · 서브 멜로디 잡음 제거 · K팝 화음 · 저지 클럽 · 클라이맥스는 느리고 웅장하게 ──
const ROYAL = ['4', '5', '3', '6', '4', '5', '1', '5'] // 4–5–3–6 진행(K팝·J팝에서 흔한 관용 진행)
/** 지역 테마 색 — 리드 · 화음 2단 · 반주 악기 · 빠르기 보정 */
const THEME = {
  title: { lead: 'flute', harmony: ['celesta', 'strings'], accInst: 'epiano', bpm: 118 },
  'town:ACADEMY': { lead: 'flute', harmony: ['celesta', 'strings'], accInst: 'epiano', bpm: 120 },
  'town-default': { lead: 'oboe', harmony: ['flute', 'strings'], accInst: 'epiano' },
  'town:COAST': { lead: 'flute', harmony: ['harp', 'strings'], accInst: 'epiano', bpm: 128 },
  'town:STORMHAVEN': { lead: 'bell', harmony: ['flute', 'strings'], accInst: 'epiano', bpm: 118 },
  'town:RUINS': { lead: 'oboe', harmony: ['clarinet', 'strings'], accInst: 'epiano', bpm: 112 },
  'town:SNOWFIELD': { lead: 'bell', harmony: ['celesta', 'strings'], accInst: 'epiano', bpm: 122 },
  'town:VOLCANO': { lead: 'horn', harmony: ['clarinet', 'strings'], accInst: 'epiano', bpm: 126 },
  'town:MORS': { lead: 'oboe', harmony: ['clarinet', 'organ'], accInst: 'organ', bpm: 108 },
  'field:SNOWFIELD': { lead: 'bell', harmony: ['flute', 'strings'] },
  'field:STORMHAVEN': { lead: 'flute', harmony: ['bell', 'strings'] },
  'field:RUINS': { lead: 'oboe', harmony: ['clarinet', 'strings'] },
  'field:MORS': { lead: 'oboe', harmony: ['clarinet', 'organ'], accInst: 'organ' },
  'field:VOLCANO': { lead: 'horn', harmony: ['clarinet', 'strings'] },
  class: { lead: 'clarinet', harmony: ['flute', 'strings'] },
  minigame: { lead: 'pulse', harmony: ['flute', 'strings'] },
}
function arrange(id, spec) {
  // 2026-11-10 5차 — 잔잔한 곡은 마인크래프트 OST 풍(펠트 피아노 · 넓은 여백), 전투·보스는 언더테일 풍(칩튠 · 빠르고 신나게).
  //   어느 쪽도 원곡 멜로디를 옮기지 않는다 — 분위기만.
  const o = { ...spec, sections: { ...spec.sections } }
  if (spec.once) return o
  const isBattle = id.startsWith('battle')
  if (isBattle) {
    const boss = id === 'battle-boss' || id === 'battle-final'
    return {
      ...o,
      bpm: id === 'battle-final' ? 174 : id === 'battle-boss' ? 168 : 152,
      bpb: 4,
      lead: 'voca',
      leadVol: 40,
      octaveDouble: true,
      thirdVoice: true,
      harmony: null,
      sparseLead: false,
      accomp: 'arp',
      accInst: 'arpTri',
      accVol: 36,
      pad: 'pad',
      padInst: boss ? 'organ' : 'strings',
      padVol: 20,
      drumVol: 0.6,
      bass: 'chip16',
      bassInst: 'chipBass',
      bassVol: 40,
      drums: boss ? 'chipBoss' : 'chip',
      chipDrums: true,
      feel: 'drive',
      ext: false,
      mode: spec.mode === 'phrygian' ? 'harmonic' : spec.mode === 'major' || spec.mode === 'lydian' || spec.mode === 'mixolydian' ? 'minor' : spec.mode,
    }
  }
  if (id === 'minigame') {
    return { ...o, bpm: 132, bpb: 4, lead: 'chipLead', leadVol: 45, octaveDouble: false, harmony: null, accomp: 'arp', accInst: 'arpTri', accVol: 32, pad: null, bass: 'chip8', bassInst: 'chipBass', bassVol: 34, drums: 'chip', chipDrums: true, feel: 'bouncy', ext: false }
  }
  // 잔잔한 곡 — 화음 하나를 두 마디씩, 피아노로 띄엄띄엄
  for (const k of Object.keys(o.sections)) o.sections[k] = { ...o.sections[k], chords: o.sections[k].chords.flatMap((c) => [c, c]), feel: 'calm' }
  const th = THEME[id] ?? {}
  const bpm = id === 'story-default' ? 66 : id.startsWith('field') ? 80 : 72
  return {
    ...o,
    bpm,
    bpb: 4,
    seconds: 200,
    endAny: true,
    lead: 'voca',
    leadVol: 20,
    leadRange: [72, 91],
    sparseLead: true,
    harmony: null,
    accomp: 'sparse',
    accInst: 'piano',
    accVol: 48,
    accRange: [55, 76],
    pad: th.accInst === 'organ' ? 'pad' : 'pad',
    padInst: th.accInst === 'organ' ? 'organ' : 'strings',
    padVol: 18,
    bass: 'lefthand',
    bassInst: 'piano',
    bassVol: 36,
    drums: 'none',
    feel: 'calm',
    ext: true,
    mode: spec.mode === 'phrygian' || spec.mode === 'harmonic' ? 'minor' : spec.mode,
  }
}

// ── 실행 ─────────────────────────────────────────────────────────────────────
const only = process.argv.slice(2)
// 파일 모양: { songs: { 칸: 곡 문자열 }, gain: { 칸: 음량 보정 } } — 곡마다 소리 크기가 달라 게임에서 맞춰 튼다
const prev = fs.existsSync(OUT) && only.length ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
const out = prev.songs ?? {}
const gain = prev.gain ?? {}
const TARGET_RMS = 0.09
const stats = []
for (const [id, spec] of Object.entries(SONGS)) {
  if (only.length && !only.includes(id)) continue
  out[id] = encode(buildSong(arrange(id, spec)), id, false)
}
for (const [id, json] of Object.entries(JINGLES)) {
  if (only.length && !only.includes(id)) continue
  out[id] = encode(json, id, true)
}

function encode(json, id, once) {
  const song = new Song()
  song.fromJsonObject(json)
  const str = song.toBase64String()
  // 검사: 다시 읽어 몇 초 합성해 보고 소리 크기·찢어짐을 본다
  const synth = new Synth(new Song(str))
  synth.samplesPerSecond = 44100
  synth.loopRepeatCount = once ? 0 : -1
  const secs = Math.min(20, (song.barCount * synth.getSamplesPerBar()) / 44100)
  const N = Math.floor(secs * 44100)
  const L = new Float32Array(N)
  const R = new Float32Array(N)
  for (let i = 0; i < N; i += 4096) {
    const n = Math.min(4096, N - i)
    const l = new Float32Array(n)
    const r = new Float32Array(n)
    synth.synthesize(l, r, n, true)
    L.set(l, i)
    R.set(r, i)
  }
  let peak = 0
  let sum = 0
  for (let i = 0; i < N; i++) {
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
    sum += L[i] * L[i]
  }
  const rms = Math.sqrt(sum / N)
  gain[id] = Math.round(Math.max(0.5, Math.min(3.5, TARGET_RMS / Math.max(rms, 1e-4))) * 100) / 100
  const bars = song.barCount
  const len = (bars * synth.getSamplesPerBar()) / 44100
  stats.push(`${id.padEnd(18)} ${String(bars).padStart(3)}마디 ${len.toFixed(1).padStart(5)}초 · peak ${peak.toFixed(2)} rms ${rms.toFixed(3)} · ${str.length}자`)
  return str
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify({ songs: out, gain }, null, 1) + '\n')
console.log(stats.join('\n'))
console.log(`→ ${OUT} (${Object.keys(out).length}곡)`)
