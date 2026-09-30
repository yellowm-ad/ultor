// 마법학교 본관 홀·수업관 전용 평면 타일 (64x32 다이아몬드) — gen-town-tiles.mjs 와 같은 슬랩 생성기
// 기존 ash/obsidian/ice 계열은 두꺼운 블록이라 평면 타일과 높이가 안 맞아 틈이 생김(천공 신전과 같은 문제).
//   ruin-stone / ruin-road / ruin-moss / ruin-mist
//   aurora-stone / aurora-road / aurora-snow / aurora-mist
//   demon-stone / demon-road / demon-ash / demon-lava
import sharp from 'sharp'
import path from 'node:path'

const dir = path.resolve('public/images/map/tiles')
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
const clamp01 = (v) => Math.max(0, Math.min(1, v))

const h2 = (x, y, s = 0) => {
  let n = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0
  n = ((n ^ (n >>> 13)) * 1274126177) >>> 0
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}
const smooth = (t) => t * t * (3 - 2 * t)
const vnoise = (x, y, cell, s) => {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell)
  const fx = smooth(x / cell - gx), fy = smooth(y / cell - gy)
  const a = h2(gx, gy, s), b = h2(gx + 1, gy, s), c = h2(gx, gy + 1, s), d = h2(gx + 1, gy + 1, s)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

const mask = await sharp(path.join(dir, 'plaza.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const W = mask.info.width, H = mask.info.height
const inside = (x, y) => mask.data[(y * W + x) * 4 + 3] > 10
const src = async (n) => (await sharp(path.join(dir, n)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })).data
const pathData = await src('path.png')
const grassData = await src('grass.png')
const lum = (buf, x, y) => {
  const i = (y * W + x) * 4
  return (0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2]) / 255
}

async function write(name, fn) {
  const out = Buffer.alloc(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue
      const [r, g, b] = fn(x, y)
      const i = (y * W + x) * 4
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255
    }
  }
  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(dir, name))
  console.log('wrote', name)
}

const uv = (x, y) => {
  const px = (x + 0.5 - 32) / 32, py = (y + 0.5 - 16) / 16
  return [(px + py + 2) / 4, (py - px + 2) / 4]
}

/** 2x2 슬랩 바닥 타일 공통 생성기 */
function slab(p) {
  const base = hex(p.base), dark = hex(p.dark), light = hex(p.light), seam = hex(p.seam), edge = hex(p.edge), hi = hex(p.hi)
  return (x, y) => {
    const [u, v] = uv(x, y)
    const n = h2(x, y, p.seed)
    let c = n < 0.14 ? dark : n > 0.9 ? light : base
    const su = Math.abs(u - 0.5) * 32, sv = Math.abs(v - 0.5) * 32
    if (su < 0.55 || sv < 0.55) c = seam
    if (u > 0.965 || v > 0.965) c = edge
    else if (u < 0.035 || v < 0.035) c = hi
    if (p.speck && h2(x, y, p.seed + 7) < p.speck.p) c = hex(p.speck.c)
    if (p.speck2 && h2(x, y, p.seed + 13) < p.speck2.p) c = hex(p.speck2.c)
    return c
  }
}

// ── 마법학교 본관 홀(참고: 마법학교 실내.png — 밝은 베이지 석판) ──
await write('academy-marble.png', slab({ base: '#d9c9a6', dark: '#c9b791', light: '#e6d8b8', seam: '#a8946e', edge: '#94805c', hi: '#f1e6cc', seed: 51, speck: { p: 0.02, c: '#bfae8a' }, speck2: { p: 0.004, c: '#e9c86a' } }))
// 화염 수업관 — 그을린 적갈색 석판 + 잉걸 불티
await write('academy-fire.png', slab({ base: '#6b3a2c', dark: '#5a2f24', light: '#7c4636', seam: '#34180f', edge: '#2a120b', hi: '#8e5442', seed: 61, speck: { p: 0.012, c: '#ff8a2a' }, speck2: { p: 0.02, c: '#4a261c' } }))
// 빙결 수업관 — 옅은 하늘빛 대리석 + 서리
await write('academy-ice.png', slab({ base: '#bcd6ea', dark: '#a8c6de', light: '#d4e7f5', seam: '#7ea3c2', edge: '#6a90b0', hi: '#f0f8ff', seed: 71, speck: { p: 0.025, c: '#ffffff' }, speck2: { p: 0.006, c: '#7fe0ff' } }))
// 대지 수업관(온실) — 이끼 낀 녹갈색 판석
await write('academy-earth.png', slab({ base: '#6f7a4c', dark: '#5e6840', light: '#808c5a', seam: '#3c4428', edge: '#30371f', hi: '#96a36c', seed: 81, speck: { p: 0.04, c: '#4f7a36' }, speck2: { p: 0.008, c: '#d8c060' } }))
// 대강당 — 남색 카펫(금실 무늬)
await write('academy-carpet.png', (x, y) => {
  const [u, v] = uv(x, y)
  const n = h2(x, y, 91)
  let c = hex(n < 0.2 ? '#243766' : n > 0.85 ? '#324a82' : '#2b407a')
  const gu = (u * 8) % 1, gv = (v * 8) % 1
  if ((gu < 0.08 || gv < 0.08) && h2(x, y, 93) < 0.55) c = hex('#b89445')
  return c
})
