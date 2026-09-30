// 랜드마크 실내 바닥용 정사각 텍스처(셀 좌표계, 16px = 1셀) — 수로(ch_*)와 신랑 러너(run_*)
// iso-structures 윗면 패턴으로 투영된다. node scripts/gen-landmark-tex.mjs
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('public/images/map/landmark')
fs.mkdirSync(OUT, { recursive: true })
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const h2 = (x, y, s = 0) => {
  let n = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0
  n = ((n ^ (n >>> 13)) * 1274126177) >>> 0
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}
async function write(name, fn, W = 16, H = 16) {
  const buf = Buffer.alloc(W * H * 4)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = fn(x, y)
      const i = (y * W + x) * 4
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255
    }
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(OUT, name))
  console.log('wrote', name)
}
// 물결(대각 줄무늬 + 반짝임) — 수로
const waves = (base, mid, hi, s) => (x, y) => {
  const w = (x + y * 2 + Math.round(h2(x >> 2, y >> 2, s) * 3)) % 8
  if (h2(x, y, s + 1) > 0.965) return hex(hi)
  return hex(w < 2 ? mid : base)
}
await write('ch_water.png', waves('#1f6f86', '#3aa6b8', '#c9f4ff', 1))
await write('ch_lava.png', (x, y) => {
  const n = h2(x >> 1, y >> 1, 7) * 0.6 + h2(x, y, 8) * 0.4
  return hex(n > 0.78 ? '#ffe06a' : n > 0.55 ? '#ff9a24' : n > 0.3 ? '#e2481a' : '#7a1c0a')
})
await write('ch_cloud.png', (x, y) => {
  const n = h2(x >> 2, y >> 2, 11) * 0.7 + h2(x, y, 12) * 0.3
  return hex(n > 0.7 ? '#ffffff' : n > 0.45 ? '#e6f1fb' : '#c8dcef')
})
await write('ch_moss.png', (x, y) => {
  const n = h2(x, y, 21)
  return hex(n > 0.85 ? '#7fae4c' : n > 0.5 ? '#4f7a36' : n > 0.2 ? '#3c5f2a' : '#2b4520')
})
await write('ch_ice.png', waves('#9fd3ea', '#c7ebf7', '#ffffff', 31))
// 러너 — 가장자리 테두리 + 안쪽 무늬
const runner = (base, alt, border, s) => (x, y) => {
  if (x === 0 || x === 15) return hex(border)
  const d = (x + y) % 8 === 0 || (x - y + 16) % 8 === 0
  return hex(d && h2(x, y, s) < 0.7 ? alt : base)
}
await write('run_atlantis.png', runner('#1c5d6b', '#3fb0b0', '#c9a24a', 1))
await write('run_demon.png', runner('#5c1414', '#8e2a1c', '#2a0d0a', 2))
await write('run_sky.png', runner('#f3ecd8', '#e2c874', '#c9a24a', 3))
await write('run_ruin.png', (x, y) => {
  const n = h2(x, y, 41)
  if (x % 8 === 0 || y % 8 === 0) return hex('#3f3b33')
  return hex(n > 0.8 ? '#5f7a3c' : n > 0.4 ? '#77705f' : '#6a6456')
})
await write('run_aurora.png', runner('#d8eef8', '#8fd6d9', '#b48fe0', 5))
