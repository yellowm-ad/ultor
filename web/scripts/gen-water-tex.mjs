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

// ── 용암·얼음 수면 + 현무암 둑(2026-10-07, 화산·설원 자연 지면) ────────────────────────────
//  lava.png       = 흐르는 용암 바탕(노랑 심 ↔ 주황 ↔ 암적색 띠가 굽이치는 결)
//  lava-crust.png = 식어 떠다니는 검은 껍질 조각(투명 배경) — 바탕보다 느리게 흘러 흐름이 보인다
//  lava-glint.png = 노란 열기 줄(투명 배경)
//  ice.png / ice-glint.png = 얼어붙은 호수 + 반짝임
//  wall-basalt.png = 용암 웅덩이·강의 둑(256×40, 아래로 갈수록 용암빛에 달아오름)
function raw(fn, w = W, h = H) {
  const buf = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = fn(x, y)
      if (!c) continue
      const o = (y * w + x) * 4
      buf[o] = c[0]
      buf[o + 1] = c[1]
      buf[o + 2] = c[2]
      buf[o + 3] = c[3] ?? 255
    }
  return sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png()
}

const LAVA = [[122, 22, 10], [168, 40, 12], [210, 70, 16], [240, 116, 26], [252, 168, 48], [255, 220, 110]]
{
  const n1 = periodicNoise(71, 4, 2)
  const n2 = periodicNoise(73, 16, 8)
  const n3 = periodicNoise(79, 32, 16)
  await raw((x, y) => {
    const warp = n1(x, y) * 3
    // 흐름 방향(오른쪽 아래)으로 길게 늘어진 띠
    const band = Math.sin(((x + y * 2) / W) * TAU * 3 + Math.sin((y / H) * TAU * 2 + warp) * 1.4 + warp) * 0.5 + 0.5
    let t = band * 0.42 + n2(x, y) * 0.36 + n3(x, y) * 0.22
    t += (BAYER[(y % 4) * 4 + (x % 4)] - 0.5) * 0.16
    return LAVA[Math.max(0, Math.min(LAVA.length - 1, Math.floor((t - 0.12) * 1.35 * LAVA.length)))]
  }).toFile(OUT + 'lava.png')
}
{
  // 작고 불규칙한 껍질 조각 — 가운데는 검게 식고 테두리만 붉게
  const n = periodicNoise(83, 32, 16)
  const n2 = periodicNoise(85, 64, 32)
  const m = periodicNoise(89, 8, 4)
  await raw((x, y) => {
    const v = n(x, y) * 0.7 + n2(x, y) * 0.3
    if (m(x, y) < 0.5 || v < 0.64) return null
    if (v < 0.665) return [176, 52, 16, 210]
    return v > 0.7 && BAYER[(y % 4) * 4 + (x % 4)] < 0.2 ? [86, 46, 36, 255] : [40, 20, 18, 240]
  }).toFile(OUT + 'lava-crust.png')
}
{
  const n = periodicNoise(97, 16, 8)
  const m = periodicNoise(101, 4, 2)
  await raw((x, y) => {
    const ridge = Math.sin(((x + y * 2) / W) * TAU * 7 + n(x, y) * 7)
    if (ridge < 0.95 || m(x, y) < 0.35 || n(x, y) < 0.4) return null
    return ridge > 0.98 ? [255, 250, 200, 235] : [255, 214, 90, 180]
  }).toFile(OUT + 'lava-glint.png')
}
const ICE = [[108, 168, 198], [126, 186, 212], [146, 202, 224], [168, 216, 234], [196, 230, 242]]
{
  const n2 = periodicNoise(103, 16, 8)
  const n3 = periodicNoise(107, 32, 16)
  const r = (() => {
    let s = 109
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  })()
  // 얼음 금 — 아이소 대각선으로 뻗는 흰 선
  const crack = new Uint8Array(W * H)
  for (let i = 0; i < 16; i++) {
    let x = Math.floor(r() * W)
    let y = Math.floor(r() * H)
    const dir = r() < 0.5 ? 1 : -1
    const len = 10 + Math.floor(r() * 26)
    for (let k = 0; k < len; k++) {
      crack[(((y % H) + H) % H) * W + (((x % W) + W) % W)] = 1
      x += r() < 0.8 ? dir * 2 : 0
      y += r() < 0.55 ? 1 : 0
      if (r() < 0.12) y -= 1
    }
  }
  await raw((x, y) => {
    if (crack[y * W + x]) return [236, 248, 255]
    if (crack[((y + H - 1) % H) * W + x]) return [92, 150, 182]
    let t = n2(x, y) * 0.6 + n3(x, y) * 0.4 + (BAYER[(y % 4) * 4 + (x % 4)] - 0.5) * 0.14
    return ICE[Math.max(0, Math.min(ICE.length - 1, Math.floor((t - 0.15) * 1.5 * ICE.length)))]
  }).toFile(OUT + 'ice.png')
}
await glint(113, 0.18, [230, 246, 255]).toFile(OUT + 'ice-glint.png')
{
  const n = periodicNoise(127, 32, 4)
  const BAS = [[26, 20, 22], [36, 28, 28], [48, 38, 36], [62, 50, 46], [78, 64, 58]]
  await raw(
    (x, y) => {
      // 아래 6줄은 용암빛에 달아오른 바위
      if (y >= 35) return y >= 38 ? [232, 98, 26] : [150, 48, 20]
      const ledge = Math.floor(n(x, y) * 4) // 층층이 갈라진 바위 띠
      if ((y + ledge * 3) % 9 === 0) return [20, 15, 17]
      if ((y + ledge * 3) % 9 === 1) return [92, 76, 68]
      let t = n(x, y) * 0.8 + (BAYER[(y % 4) * 4 + (x % 4)] - 0.5) * 0.3 - y * 0.008
      return BAS[Math.max(0, Math.min(BAS.length - 1, Math.floor(t * BAS.length)))]
    },
    W,
    40,
  ).toFile(OUT + 'wall-basalt.png')
}

// ── 날씨(화면 층, 256×256 타일) — 눈송이 두 겹, 불티, 빗줄기 ──────────────────────────────
{
  const WD = 'public/images/map/weather/'
  await import('node:fs').then((fs) => fs.mkdirSync(WD, { recursive: true }))
  const scatter = (seed, count, draw) => {
    const buf = Buffer.alloc(256 * 256 * 4)
    let s = seed
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
    const put = (x, y, c) => {
      const o = ((((y % 256) + 256) % 256) * 256 + (((x % 256) + 256) % 256)) * 4
      buf[o] = c[0]
      buf[o + 1] = c[1]
      buf[o + 2] = c[2]
      buf[o + 3] = c[3]
    }
    for (let i = 0; i < count; i++) draw(Math.floor(r() * 256), Math.floor(r() * 256), put, r)
    return sharp(buf, { raw: { width: 256, height: 256, channels: 4 } }).png()
  }
  // 작은 눈송이(1~2px) — 먼 눈
  await scatter(131, 46, (x, y, put, r) => {
    const big = r() < 0.35
    put(x, y, [255, 255, 255, 220])
    if (big) {
      put(x + 1, y, [240, 246, 255, 170])
      put(x, y + 1, [240, 246, 255, 170])
      put(x + 1, y + 1, [220, 232, 250, 120])
    }
  }).toFile(WD + 'snow-a.png')
  // 큰 눈송이(십자형) — 가까운 눈
  await scatter(137, 14, (x, y, put) => {
    put(x, y, [255, 255, 255, 240])
    put(x + 1, y, [255, 255, 255, 200])
    put(x - 1, y, [255, 255, 255, 200])
    put(x, y + 1, [255, 255, 255, 200])
    put(x, y - 1, [255, 255, 255, 200])
  }).toFile(WD + 'snow-b.png')
  // 불티 — 주황 점(가운데 노랑)
  await scatter(139, 16, (x, y, put, r) => {
    put(x, y, [255, 220, 120, 235])
    if (r() < 0.5) put(x, y + 1, [240, 110, 30, 170])
  }).toFile(WD + 'ember.png')
  // 빗줄기 — 옅고 짧은 사선
  await scatter(149, 34, (x, y, put) => {
    for (let k = 0; k < 6; k++) put(x - Math.floor(k / 2), y + k, [200, 214, 236, 80 + k * 14])
  }).toFile(WD + 'rain.png')
}
console.log('water textures ->', OUT)
