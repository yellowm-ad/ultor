// 전투 도트 이펙트 시트 생성(2026-10-14) — PixelLab 시트(fire/ice/earth_burst.png)와 같은 규격·화풍으로 직접 찍는다.
//   규격: 80×80 칸 × 9프레임 가로 1줄(720×80) · 4~5단 제한 팔레트 · 짙은 외곽선 1칸 · 하얀 중심 · 칸 단위(안티에일리어싱 없음)
//   dark_burst    어둠 — 파편이 안쪽으로 빨려 들어가 공허가 닫혔다가, 가운데가 검은 보라 폭발로 터진다
//   light_burst   빛 — 네 갈래 긴 빛살 + 짧은 빛살의 성광, 퍼지는 고리와 반짝이
//   wind_burst    바람 — 회전하며 퍼지는 초승달 칼바람 세 줄기와 흩날리는 먼지
//   neutral_burst 무속성 — 무채색 충격 별 + 퍼지는 고리
// 실행: node scripts/gen-vfx-sheets.mjs  → public/images/battle/vfx/*.png
import sharp from 'sharp'
import path from 'node:path'

const OUT = path.resolve('public/images/battle/vfx')
const S = 80
const F = 9
const C = 40
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255]
const hash = (x, y, s = 0) => {
  let n = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0
  n = ((n ^ (n >>> 13)) * 1274126177) >>> 0
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const bay = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16

/** 프레임 하나: tone(x,y) → 0(없음) 또는 1..n(팔레트 단계, 클수록 밝음). 바깥 1칸에 외곽선(팔레트 0) */
function frame(pal, tone) {
  const T = new Uint8Array(S * S)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) T[y * S + x] = tone(x, y)
  const px = new Uint8ClampedArray(S * S * 4)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const i = y * S + x
      let c = null
      if (T[i]) c = pal[Math.min(pal.length - 1, T[i])]
      else {
        // 외곽선 — 상하좌우에 칠한 칸이 있으면
        const near = (x > 0 && T[i - 1]) || (x < S - 1 && T[i + 1]) || (y > 0 && T[i - S]) || (y < S - 1 && T[i + S])
        if (near) c = pal[0]
      }
      if (c) px.set(c, i * 4)
    }
  return px
}

async function sheet(name, pal, tones) {
  const buf = Buffer.alloc(S * F * S * 4)
  tones.forEach((tone, f) => {
    const px = frame(pal, tone)
    for (let y = 0; y < S; y++) px.subarray(y * S * 4, (y + 1) * S * 4).forEach((v, k) => (buf[(y * S * F + f * S) * 4 + k] = v))
  })
  await sharp(buf, { raw: { width: S * F, height: S, channels: 4 } }).png().toFile(path.join(OUT, name))
  console.log('wrote', name)
}

const polar = (x, y) => {
  const dx = x + 0.5 - C
  const dy = y + 0.5 - C
  return { r: Math.hypot(dx, dy), a: Math.atan2(dy, dx), dx, dy }
}
/** 별꼴 경계 — 빛살 n 개, 뾰족함 spike, 칸 흔들림 jag */
const starR = (a, base, n, spike, seed, jag = 0.12, sharp = 3) => {
  const s = Math.abs(Math.sin((a * n) / 2 + seed))
  const k = Math.floor(((a + Math.PI) / (Math.PI * 2)) * n * 3)
  return base * (1 + spike * Math.pow(s, sharp) + (hash(k, seed * 7 | 0, 3) - 0.5) * jag * 2)
}
/** 안쪽에서 바깥으로 밝기 단계 — core(0~1) 이 작을수록 하얀 중심이 작다 */
const radialTone = (t, levels, core, x, y) => {
  // t = r / R (0 중심 ~ 1 가장자리). 경계를 디더링으로 섞는다
  const v = 1 - t + (bay(x, y) - 0.5) * 0.12
  if (v > 1 - core * 0.35) return levels
  if (v > 1 - core * 0.7) return levels - 1
  if (v > 0.32) return Math.max(1, levels - 2)
  return 1
}

// 크기·밝기 곡선(9프레임) — 확 커졌다가 식으며 흩어진다
const SIZE = [0.42, 0.78, 1.0, 1.0, 0.9, 0.74, 0.56, 0.4, 0.26]
const CORE = [1, 1, 0.95, 0.75, 0.55, 0.38, 0.22, 0.1, 0]

// ── 어둠 ───────────────────────────────────────────────────────────────────
{
  const pal = ['#14061f', '#3a1260', '#6a2ea8', '#a868f0', '#e6ccff', '#ffffff'].map(hex)
  const tones = Array.from({ length: F }, (_, f) => (x, y) => {
    const { r, a } = polar(x, y)
    if (f <= 2) {
      // 빨려 드는 파편 + 닫히는 공허 고리
      const ring = 30 - f * 9
      if (Math.abs(r - ring) < 1.6 && hash(Math.floor((a + 4) * 9), f, 11) > 0.45) return 3
      const k = Math.floor((a + Math.PI) * 4)
      const pr = 34 - f * 10 + hash(k, 1, 5) * 8
      if (Math.abs(r - pr) < 1.2 && Math.abs(((a * 8) % 1) - 0.5) < 0.12) return 4
      if (r < 5 + f * 2) return r < 2 + f ? 1 : 2
      return 0
    }
    const g = f - 3
    const R = starR(a, 30 * SIZE[g + 2], 9, 0.55, 1.3 + g * 0.2, 0.18)
    if (r > R) {
      // 흩어지는 보라 불티
      return g >= 2 && r < R + 10 && hash(x, y, f) > 0.985 ? 3 : 0
    }
    const t = r / R
    // 공허 — 가운데가 가장 어둡고 테두리가 밝다(빛과 반대)
    if (t < 0.38 - g * 0.03) return 1
    if (t < 0.55) return 2
    if (t < 0.82) return bay(x, y) < CORE[g + 2] + 0.2 ? 4 : 3
    return CORE[g + 2] > 0.4 ? 5 : 3
  })
  await sheet('dark_burst.png', pal, tones)
}

// ── 빛 ─────────────────────────────────────────────────────────────────────
{
  const pal = ['#7a4a08', '#d69a22', '#ffd860', '#fff3b8', '#ffffff'].map(hex)
  const tones = Array.from({ length: F }, (_, f) => (x, y) => {
    const { r, a, dx, dy } = polar(x, y)
    const sz = SIZE[f]
    // 네 갈래 긴 빛살(상하좌우) + 대각 짧은 빛살 — 가늘고 곧게
    const ax = Math.abs(dx)
    const ay = Math.abs(dy)
    const longLen = 38 * sz
    const shortLen = 22 * sz
    const wL = Math.max(1, 3.2 * sz * (1 - Math.min(ax, ay) / 40)) // 끝으로 갈수록 가늘게
    const onLong = (ay < wL * (1 - ax / (longLen + 1)) && ax < longLen) || (ax < wL * (1 - ay / (longLen + 1)) && ay < longLen)
    const d1 = Math.abs(dx - dy) / Math.SQRT2
    const d2 = Math.abs(dx + dy) / Math.SQRT2
    const onShort = r < shortLen && (d1 < 1.3 * sz * (1 - r / shortLen) + 0.4 || d2 < 1.3 * sz * (1 - r / shortLen) + 0.4)
    const core = 10 * sz
    if (r < core) return radialTone(r / core, 4, CORE[f] + 0.2, x, y)
    // 퍼지는 고리(가운데 프레임)
    const ringR = 12 + f * 4
    if (f >= 2 && f <= 6 && Math.abs(r - ringR) < 1 && hash(Math.floor((a + 4) * 10), f, 2) > 0.3) return f < 5 ? 3 : 2
    if (onLong) return r < longLen * 0.45 ? 4 : r < longLen * 0.75 ? 3 : 2
    if (onShort) return r < shortLen * 0.5 ? 3 : 2
    // 반짝이 — 작은 십자
    if (f >= 3) {
      for (let k = 0; k < 6; k++) {
        const sa = hash(k, 9, 1) * Math.PI * 2
        const sr = 18 + hash(k, 3, 1) * 16 + f
        const sx = C + Math.cos(sa) * sr
        const sy = C + Math.sin(sa) * sr
        const ex = Math.abs(x + 0.5 - sx)
        const ey = Math.abs(y + 0.5 - sy)
        const on = (f + k) % 3 !== 0
        if (on && ((ex < 0.6 && ey < 2.6) || (ey < 0.6 && ex < 2.6))) return ex < 0.6 && ey < 0.6 ? 4 : 3
      }
    }
    return 0
  })
  await sheet('light_burst.png', pal, tones)
}

// ── 바람 ───────────────────────────────────────────────────────────────────
{
  const pal = ['#0b3d33', '#1f8f70', '#4fcaa0', '#a8f0d4', '#ffffff'].map(hex)
  const tones = Array.from({ length: F }, (_, f) => (x, y) => {
    const { r, a } = polar(x, y)
    const rot = f * 0.55
    const R = 10 + f * 3.4
    const width = Math.max(1.2, 4.6 - f * 0.38)
    // 초승달 세 줄기 — 머리(진행 방향)가 굵고 밝고, 꼬리로 갈수록 가늘다
    for (let k = 0; k < 3; k++) {
      const start = rot + (k * Math.PI * 2) / 3
      let da = (a - start) % (Math.PI * 2)
      if (da < 0) da += Math.PI * 2
      const len = 2.1 - f * 0.12
      if (da > len) continue
      const u = 1 - da / len // 1 = 머리
      const rr = R + (1 - u) * 6 // 꼬리는 안쪽으로 감긴다
      const w = width * (0.35 + 0.65 * u)
      if (Math.abs(r - rr) < w) {
        if (f >= 7 && bay(x, y) > 0.55) return 0
        return u > 0.82 && f < 6 ? 4 : u > 0.5 ? 3 : 2
      }
    }
    // 가운데 소용돌이 눈(초반)
    if (f <= 2 && r < 6 - f) return 4 - f
    // 흩날리는 먼지
    if (r > R - 6 && r < R + 12 && hash(x, y, f + 20) > 0.988) return f < 6 ? 3 : 2
    return 0
  })
  await sheet('wind_burst.png', pal, tones)
}

// ── 무속성 ─────────────────────────────────────────────────────────────────
{
  const pal = ['#2c3036', '#6c737d', '#aab0b9', '#dfe3e8', '#ffffff'].map(hex)
  const tones = Array.from({ length: F }, (_, f) => (x, y) => {
    const { r, a } = polar(x, y)
    const R = starR(a, 26 * SIZE[f], 10, 0.75, 0.4 + f * 0.15, 0.14, 4)
    const ringR = 20 + f * 3.6
    if (f >= 2 && f <= 7 && Math.abs(r - ringR) < (f < 5 ? 1.2 : 0.8) && hash(Math.floor((a + 4) * 12), f, 4) > 0.2) return f < 5 ? 3 : 2
    if (r > R) return 0
    return radialTone(r / R, 4, CORE[f], x, y)
  })
  await sheet('neutral_burst.png', pal, tones)
}
