// 자연 지면 텍스처(이음매 없음) — 칸 타일 대신 한 장으로 이어 그리는 야생맵 지면(components/game/iso-terrain.tsx)용.
// 결과: public/images/map/terrain/{grass,grass-dark,dirt,sand,cave,mine,swamp,mud}.png (256×128, 가로·세로 끝이 정확히 이어짐)
// 팔레트는 기존 칸 타일(public/images/map/tiles/*)에서 뽑아 톤을 맞추고, 흙길은 주황기를 빼 숲에 어울리게 낮췄다.
// gen-water-tex.mjs 와 같은 방식: 주기 함수 노이즈 + 4×4 베이어 디더링 + 주기 격자 위 잔무늬(풀잎·자갈·금).
import sharp from 'sharp'

const OUT = 'public/images/map/terrain/'
const W = 256
const H = 128

function periodicNoise(seed, gx, gy) {
  let s = seed
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  const g = Array.from({ length: gx * gy }, rnd)
  const at = (i, j) => g[(((j % gy) + gy) % gy) * gx + (((i % gx) + gx) % gx)]
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
const rng = (seed) => {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

function canvas() {
  const buf = Buffer.alloc(W * H * 4)
  const set = (x, y, c) => {
    const o = ((((y % H) + H) % H) * W + (((x % W) + W) % W)) * 4
    buf[o] = c[0]
    buf[o + 1] = c[1]
    buf[o + 2] = c[2]
    buf[o + 3] = 255
  }
  return { buf, set, png: () => sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png() }
}

/** 바탕 — 노이즈 3겹 + 디더링으로 팔레트 단계 고르기. stretch>1 이면 가로로 길게 눕는 결 */
function base(cv, pal, seed, { stretch = 1, dither = 0.2 } = {}) {
  const n1 = periodicNoise(seed, 8 / stretch > 1 ? Math.round(8 / stretch) : 2, 4)
  const n2 = periodicNoise(seed + 7, 16, 8)
  const n3 = periodicNoise(seed + 13, 32, 16)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let t = n1(x, y) * 0.42 + n2(x, y) * 0.36 + n3(x, y) * 0.22
      t += (BAYER[(y % 4) * 4 + (x % 4)] - 0.5) * dither
      const k = Math.max(0, Math.min(pal.length - 1, Math.floor((t - 0.18) * 1.6 * pal.length)))
      cv.set(x, y, pal[k])
    }
}

/** 풀잎 다발 — 짧은 세로 획(밝은 끝 + 어두운 밑동). 주기 격자에 흔들어 배치 */
function blades(cv, seed, count, light, mid, dark) {
  const r = rng(seed)
  for (let i = 0; i < count; i++) {
    const x = Math.floor(r() * W)
    const y = Math.floor(r() * H)
    const n = 2 + Math.floor(r() * 3)
    for (let k = 0; k < n; k++) {
      const bx = x + k * 2 - n + Math.round((r() - 0.5) * 2)
      const len = 2 + Math.floor(r() * 2)
      cv.set(bx, y + 1, dark)
      for (let j = 0; j < len; j++) cv.set(bx + (j === len - 1 && r() < 0.5 ? (k % 2 ? 1 : -1) : 0), y - j, j === len - 1 ? light : mid)
    }
  }
}

/** 자갈 — 밝은 윗면 + 어두운 아랫그늘 */
function pebbles(cv, seed, count, light, dark, shadow) {
  const r = rng(seed)
  for (let i = 0; i < count; i++) {
    const x = Math.floor(r() * W)
    const y = Math.floor(r() * H)
    const w = 1 + Math.floor(r() * 3)
    for (let k = 0; k < w; k++) {
      cv.set(x + k, y, light)
      cv.set(x + k, y + 1, dark)
    }
    cv.set(x + w, y + 1, shadow)
    cv.set(x, y + 2, shadow)
  }
}

/** 점 — 어둡거나 밝은 낱알 */
function specks(cv, seed, count, cols) {
  const r = rng(seed)
  for (let i = 0; i < count; i++) cv.set(Math.floor(r() * W), Math.floor(r() * H), cols[Math.floor(r() * cols.length)])
}

/** 금(균열) — 아이소 대각선 쪽으로 기우는 짧은 랜덤 워크 */
function cracks(cv, seed, count, dark, light) {
  const r = rng(seed)
  for (let i = 0; i < count; i++) {
    let x = Math.floor(r() * W)
    let y = Math.floor(r() * H)
    const dir = r() < 0.5 ? 1 : -1
    const len = 6 + Math.floor(r() * 12)
    for (let k = 0; k < len; k++) {
      cv.set(x, y, dark)
      cv.set(x, y + 1, light)
      x += r() < 0.75 ? dir * 2 : 0
      y += r() < 0.6 ? 1 : 0
      if (r() < 0.2) y -= 1
    }
  }
}

/** 모래 물결 — 가로로 흔들리는 밝은 마루 + 바로 아래 어두운 골 */
function ripples(cv, seed, crest, trough) {
  const n = periodicNoise(seed, 8, 4)
  // 물결이 드문드문 끊기도록 큰 얼룩 마스크 + 잘게 끊는 마스크
  const m = periodicNoise(seed + 5, 8, 4)
  const m2 = periodicNoise(seed + 9, 32, 16)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (m(x, y) < 0.5 || m2(x, y) < 0.45) continue
      const v = Math.sin(((y + n(x, y) * 14) / H) * Math.PI * 2 * 9)
      if (v > 0.95) cv.set(x, y, crest)
      else if (v < -0.97 && (x + y) % 3) cv.set(x, y, trough)
    }
}

const GRASS = [[44, 92, 30], [52, 102, 32], [60, 112, 38], [68, 122, 42], [78, 132, 46], [88, 140, 52]]
const GRASS_DARK = [[26, 70, 40], [30, 82, 46], [36, 94, 52], [42, 106, 56], [50, 116, 60], [58, 126, 66]]
const DIRT = [[96, 70, 46], [112, 82, 54], [128, 96, 64], [142, 108, 72], [156, 122, 84], [170, 136, 96]]
const SAND = [[206, 168, 104], [216, 180, 114], [226, 190, 122], [234, 198, 130], [242, 208, 142]]
const CAVE = [[24, 22, 40], [30, 30, 52], [38, 38, 62], [46, 46, 72], [56, 56, 82]]
const MINE = [[40, 22, 46], [52, 32, 58], [64, 44, 70], [80, 62, 84], [96, 78, 98]]
const SWAMP = [[30, 38, 30], [38, 48, 34], [46, 58, 38], [56, 68, 42], [66, 78, 46]]
const MUD = [[54, 40, 30], [64, 48, 36], [74, 56, 42], [86, 66, 48], [98, 76, 56]]

async function make(name, fn) {
  const cv = canvas()
  fn(cv)
  await cv.png().toFile(OUT + name + '.png')
}

await import('node:fs').then((fs) => fs.mkdirSync(OUT, { recursive: true }))

await make('grass', (cv) => {
  base(cv, GRASS, 101)
  blades(cv, 3, 150, [132, 184, 72], [96, 150, 56], [40, 84, 28])
  specks(cv, 5, 40, [[240, 232, 170], [214, 236, 150]])
})
await make('grass-dark', (cv) => {
  base(cv, GRASS_DARK, 202)
  blades(cv, 7, 130, [92, 160, 84], [66, 134, 70], [22, 60, 36])
  specks(cv, 9, 24, [[118, 176, 96]])
})
await make('dirt', (cv) => {
  base(cv, DIRT, 303, { stretch: 2 })
  pebbles(cv, 11, 46, [188, 158, 122], [128, 100, 72], [74, 54, 36])
  specks(cv, 13, 160, [[84, 60, 40], [182, 150, 110]])
})
await make('sand', (cv) => {
  base(cv, SAND, 404, { stretch: 2, dither: 0.16 })
  ripples(cv, 15, [246, 216, 156], [208, 170, 108])
  specks(cv, 17, 50, [[250, 238, 214], [180, 140, 90]])
})
await make('cave', (cv) => {
  base(cv, CAVE, 505)
  cracks(cv, 19, 26, [14, 12, 24], [64, 64, 92])
  pebbles(cv, 21, 30, [78, 78, 104], [44, 44, 66], [16, 14, 26])
})
await make('mine', (cv) => {
  base(cv, MINE, 606)
  cracks(cv, 23, 22, [26, 12, 30], [110, 92, 112])
  pebbles(cv, 25, 30, [116, 98, 118], [62, 44, 68], [24, 12, 28])
})
await make('swamp', (cv) => {
  base(cv, SWAMP, 707)
  blades(cv, 27, 70, [96, 120, 60], [72, 96, 50], [24, 30, 22])
  specks(cv, 29, 80, [[24, 28, 22], [84, 90, 58]])
})
await make('mud', (cv) => {
  base(cv, MUD, 808, { stretch: 2 })
  pebbles(cv, 31, 20, [120, 98, 76], [70, 54, 40], [40, 30, 22])
})
console.log('terrain textures ->', OUT)
