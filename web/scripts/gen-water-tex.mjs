// 물 표면 텍스처(이음매 없음) — 주기 함수만 써서 가로/세로 끝이 정확히 이어진다.
// 결과: public/images/map/water/{sea,canal}.png (바탕), {sea,canal}-glint{,2}.png (흰 물결 마루, 투명 배경)
// 팔레트는 「물 타일 개선안.png」에서 뽑았다. 4단계 + 4×4 베이어 디더링으로 도트 느낌.
import sharp from 'sharp'

const OUT = 'public/images/map/water/'
const W = 256
const H = 128
const TAU = Math.PI * 2

/** 주기(W,H)를 갖는 값 노이즈 — 격자 값을 감싸서 보간 */
function periodicNoise(seed, gx, gy) {
  let s = seed
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  const g = Array.from({ length: gx * gy }, rnd)
  const at = (i, j) => g[((j % gy) + gy) % gy * gx + (((i % gx) + gx) % gx)]
  const sm = (t) => t * t * (3 - 2 * t)
  return (x, y) => {
    const fx = (x / W) * gx
    const fy = (y / H) * gy
    const i = Math.floor(fx)
    const j = Math.floor(fy)
    const u = sm(fx - i)
    const v = sm(fy - j)
    const a = at(i, j) * (1 - u) + at(i + 1, j) * u
    const b = at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u
    return a * (1 - v) + b * v
  }
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)

function surface(pal, seed) {
  const n1 = periodicNoise(seed, 8, 4)
  const n2 = periodicNoise(seed + 7, 16, 8)
  const n3 = periodicNoise(seed + 13, 32, 16)
  const buf = Buffer.alloc(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // 가로로 길게 눕는 물결(가로 주파수 낮고 세로 높음) + 노이즈로 흔들기
      const warp = n1(x, y) * 2.2
      const wave = Math.sin((y / H) * TAU * 8 + Math.sin((x / W) * TAU * 2 + warp) * 1.6 + warp) * 0.5 + 0.5
      let t = wave * 0.28 + n2(x, y) * 0.45 + n3(x, y) * 0.27
      t += (BAYER[(y % 4) * 4 + (x % 4)] - 0.5) * 0.18
      const k = Math.max(0, Math.min(pal.length - 1, Math.floor(t * pal.length)))
      const c = pal[k]
      const o = (y * W + x) * 4
      buf[o] = c[0]
      buf[o + 1] = c[1]
      buf[o + 2] = c[2]
      buf[o + 3] = 255
    }
  }
  return sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png()
}

/** 흰 물결 마루 — 짧은 가로 획. 노이즈 능선이 문턱을 넘는 곳만 */
function glint(seed, density, color) {
  const n = periodicNoise(seed, 16, 8)
  const m = periodicNoise(seed + 3, 4, 2)
  const buf = Buffer.alloc(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ridge = Math.sin((y / H) * TAU * 16 + n(x, y) * 6) // 가로줄
      const patch = m(x, y) // 큰 덩어리로 드문드문
      if (ridge > 0.955 && n(x, y) > 1 - density && patch > 0.3) {
        const o = (y * W + x) * 4
        const bright = ridge > 0.975
        buf[o] = bright ? 255 : color[0]
        buf[o + 1] = bright ? 255 : color[1]
        buf[o + 2] = bright ? 255 : color[2]
        buf[o + 3] = bright ? 235 : 170
      }
    }
  }
  return sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png()
}

const SEA = [[13, 78, 122], [18, 98, 142], [26, 120, 160], [44, 146, 182]]
const CANAL = [[22, 138, 156], [30, 160, 172], [44, 180, 186], [78, 204, 204]]

await surface(SEA, 21).toFile(OUT + 'sea.png')
await surface(CANAL, 5).toFile(OUT + 'canal.png')
await glint(31, 0.32, [170, 226, 240]).toFile(OUT + 'sea-glint.png')
await glint(47, 0.3, [170, 226, 240]).toFile(OUT + 'sea-glint2.png')
await glint(9, 0.5, [200, 245, 240]).toFile(OUT + 'canal-glint.png')
await glint(17, 0.45, [200, 245, 240]).toFile(OUT + 'canal-glint2.png')
console.log('water textures ->', OUT)
