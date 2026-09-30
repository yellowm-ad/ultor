// 마법학교 중앙 홀 바닥 — 참고 이미지 4·5(국회도서관 로비) 원형 모자이크를 "셀 좌표계" 도트로 생성.
// iso-structures 의 윗면(top img) 으로 matrix(32,16,-32,16) 투영되어 바닥 격자에 정확히 눕는다.
//   public/images/map/academy/mosaic.png   — 지름 D 셀 × PX px/셀, 원 밖 투명
//   public/images/map/academy/tex_marble.png — 회랑 바닥·계단 디딤판 정사각 대리석(1셀 반복)
//   public/images/map/academy/tex_carpet.png — 계단 중앙 붉은 카펫(1셀 반복)
//   public/images/map/academy/tex_riser.png  — 계단 챌판(면 텍스처)
// node scripts/gen-academy-floor.mjs
import sharp from 'sharp'
import path from 'node:path'

const OUT = path.resolve('public/images/map/academy')
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const h2 = (x, y, s = 0) => {
  let n = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0
  n = ((n ^ (n >>> 13)) * 1274126177) >>> 0
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}
async function write(name, W, H, fn) {
  const buf = Buffer.alloc(W * H * 4)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = fn(x, y)
      if (!c) continue
      const i = (y * W + x) * 4
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = c[3] ?? 255
    }
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(OUT, name))
  console.log('wrote', name, W + 'x' + H)
}

// ── 원형 모자이크 ──
const D = 22 // 지름(셀)
const PX = 16 // 셀당 px
const S = D * PX
const C = {
  cream: hex('#e6d9bd'), cream2: hex('#d8c8a6'), sand: hex('#c9ae82'),
  red: hex('#8e3b2e'), red2: hex('#6e2a22'), dark: hex('#2e3140'), dark2: hex('#454a5c'),
  gold: hex('#c9a24a'), gold2: hex('#e8c66a'), blue: hex('#3f64b0'), white: hex('#f4efe2'),
}
const jitter = (c, x, y, k = 10) => {
  const n = (h2(x, y, 7) - 0.5) * k
  return [c[0] + n, c[1] + n, c[2] + n].map((v) => Math.max(0, Math.min(255, Math.round(v))))
}
await write('mosaic.png', S, S, (px, py) => {
  const x = (px + 0.5) / PX - D / 2
  const y = (py + 0.5) / PX - D / 2
  const r = Math.hypot(x, y)
  const a = (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2)
  const R = D / 2
  if (r > R) return null
  const t = (a / (Math.PI * 2))
  let c
  if (r > R - 0.35) c = C.dark
  else if (r > R - 0.55) c = C.gold
  else if (r > R - 1.6) {
    // 바깥 띠 — 검정/크림 교차 사각 타일(참고 5 테두리)
    const k = Math.floor(t * 48)
    c = k % 2 ? C.dark2 : C.cream
  } else if (r > R - 1.8) c = C.gold
  else if (r > R * 0.52) {
    // 방사형 광선 32개 — 굵은 적색 / 가는 짙은색 교차, 사이 크림
    const seg = t * 32
    const f = seg - Math.floor(seg)
    const k = Math.floor(seg)
    const w = k % 2 ? 0.16 : 0.3
    if (Math.abs(f - 0.5) < w * (1 - (r - R * 0.52) / (R * 0.5) * 0.5)) c = k % 2 ? C.dark : C.red
    else c = ((r * 2) | 0) % 2 ? C.cream : C.cream2
  } else if (r > R * 0.5) c = C.gold
  else if (r > R * 0.34) {
    // 꽃잎 16장 — 적색 마름모
    const seg = t * 16
    const f = seg - Math.floor(seg)
    const rr = (r - R * 0.34) / (R * 0.16)
    c = Math.abs(f - 0.5) < 0.5 * (1 - Math.abs(rr - 0.5) * 2) ? C.red2 : C.sand
  } else if (r > R * 0.32) c = C.dark
  else if (r > R * 0.2) {
    const seg = t * 24
    c = Math.floor(seg) % 2 ? C.cream2 : C.white
  } else if (r > R * 0.18) c = C.gold
  else c = r < 0.6 ? C.blue : C.sand
  return jitter(c, px, py, 12)
})

// ── 정사각 텍스처 (1셀 = 16px) ──
await write('tex_marble.png', 32, 32, (x, y) => {
  let c = h2(x, y, 3) < 0.12 ? hex('#d2c3a2') : h2(x, y, 5) > 0.93 ? hex('#efe4c9') : hex('#e2d4b4')
  if (x % 16 === 0 || y % 16 === 0) c = hex('#b39f79')
  if ((x + y * 3) % 23 === 0 && h2(x, y, 9) < 0.5) c = hex('#c9b996')
  return c
})
await write('tex_carpet.png', 16, 16, (x, y) => {
  let c = h2(x, y, 11) < 0.2 ? hex('#7a1f25') : hex('#8f2a2e')
  if ((x + y) % 8 === 0 && h2(x, y, 13) < 0.6) c = hex('#a8383a')
  return c
})
await write('tex_riser.png', 32, 16, (x, y) => {
  let c = y < 2 ? hex('#f2e8d0') : y > 13 ? hex('#8d7a58') : h2(x, y, 17) < 0.1 ? hex('#c9b996') : hex('#d6c7a6')
  if (x % 32 === 0) c = hex('#a8946e')
  return c
})
