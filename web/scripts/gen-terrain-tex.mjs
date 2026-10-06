// 자연 지면 텍스처(이음매 없음) — 칸 타일 대신 한 장으로 이어 그리는 야생맵 지면(components/game/iso-terrain.tsx)용.
// 결과: public/images/map/terrain/{grass,grass-dark,dirt,sand,cave,mine,swamp,mud}.png (256×128, 가로·세로 끝이 정확히 이어짐)
//   + 2026-10-07 나머지 지역: ash·basalt·cinder(화산) / snow·snow-shade·snow-path·frost-stone(설원) / cloud·cloud-dark·marble·sky-road(스톰헤이븐) / ruin-grass·flagstone·grave-soil(폐허·묘지)
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
const CAVE = [[36, 32, 42], [45, 40, 52], [55, 49, 62], [65, 58, 72], [77, 69, 84]] // 남색 대신 따뜻한 회보라 돌
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
  cracks(cv, 19, 26, [22, 18, 26], [88, 80, 96])
  pebbles(cv, 21, 30, [98, 90, 106], [58, 52, 66], [24, 20, 28])
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
// ── 나머지 지역(2026-10-07) — 화산·설원·스톰헤이븐·폐허·묘지 ───────────────────────────────

/** 주기 보로노이 — 돌판(포석·현무암 판·대리석)용. 가장 가까운/두 번째 점 거리와 판 번호 */
function worley(seed, gx, gy) {
  const r = rng(seed)
  const pts = []
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) pts.push({ x: ((i + 0.15 + r() * 0.7) * W) / gx, y: ((j + 0.15 + r() * 0.7) * H) / gy, v: r() })
  return (x, y) => {
    let d1 = 1e9
    let d2 = 1e9
    let id = 0
    for (const p of pts) {
      let dx = Math.abs(x - p.x)
      let dy = Math.abs(y - p.y)
      if (dx > W / 2) dx = W - dx
      if (dy > H / 2) dy = H - dy
      // 아이소 지면이라 세로를 두 배로 쳐서 판이 납작한 마름모꼴로 눕게
      const d = Math.hypot(dx, dy * 2)
      if (d < d1) {
        d2 = d1
        d1 = d
        id = p.v
      } else if (d < d2) d2 = d
    }
    return { d1, d2, v: id }
  }
}

/** 돌판 — 판마다 팔레트 단계를 달리하고, 줄눈은 어둡게·윗변은 밝게. gap = 줄눈 두께 */
function slabs(cv, pal, seed, { gx = 8, gy = 4, mortar, light, gap = 1.6, jitter = 0.22, holes = 0, hole = null } = {}) {
  const wl = worley(seed, gx, gy)
  const n = periodicNoise(seed + 3, 32, 16)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = wl(x, y)
      const edge = a.d2 - a.d1
      if (edge < gap) {
        cv.set(x, y, mortar)
        continue
      }
      if (holes && a.v < holes && hole) {
        cv.set(x, y, hole[Math.min(hole.length - 1, Math.floor(n(x, y) * hole.length * 1.4))])
        continue
      }
      // 줄눈 바로 아래(위쪽 판의 아랫변)는 밝게 — 위에서 빛이 오는 도트 관례
      const up = wl(x, y - 2)
      if (up.v !== a.v && edge < gap + 2.2) {
        cv.set(x, y, light)
        continue
      }
      let t = a.v * 0.55 + n(x, y) * 0.45 + (BAYER[(y % 4) * 4 + (x % 4)] - 0.5) * jitter
      const k = Math.max(0, Math.min(pal.length - 1, Math.floor(t * pal.length)))
      cv.set(x, y, pal[k])
    }
}

/** 눈 바람결 — 드문드문 끊기는 완만한 능선(밝은 마루 한 줄 + 바로 아래 옅은 푸른 그늘) */
function drifts(cv, seed, crest, shadow, amount = 0.5) {
  const n = periodicNoise(seed, 8, 4)
  const m = periodicNoise(seed + 5, 8, 4)
  const m2 = periodicNoise(seed + 9, 32, 16)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (m(x, y) < 1 - amount || m2(x, y) < 0.5) continue
      const v = Math.sin(((y + n(x, y) * 22 + x * 0.12) / H) * Math.PI * 2 * 5)
      if (v > 0.985) cv.set(x, y, crest)
      else if (v < -0.975 && (x + y) % 2) cv.set(x, y, shadow)
    }
}

/** 몽실몽실한 구름 바닥 — 큰 노이즈 덩어리의 윗면은 밝게·아랫면은 그늘(디더로 번지게) */
function puffs(cv, seed, light, shade) {
  const n = periodicNoise(seed, 8, 4)
  const n2 = periodicNoise(seed + 1, 16, 8)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const f = (yy) => n(x, yy) * 0.7 + n2(x, yy) * 0.3
      const g = f(y + 4) - f(y - 4)
      const b = BAYER[(y % 4) * 4 + (x % 4)]
      if (g < -0.06 && b < Math.min(0.5, (-g - 0.06) * 6)) cv.set(x, y, light)
      else if (g > 0.06 && b < Math.min(0.4, (g - 0.06) * 5)) cv.set(x, y, shade)
    }
}

/** 빛나는 균열 — 가운데 밝은 심(용암빛) + 둘레 어두운 그을림 */
function glowCracks(cv, seed, count, core, rim) {
  const r = rng(seed)
  for (let i = 0; i < count; i++) {
    let x = Math.floor(r() * W)
    let y = Math.floor(r() * H)
    const dir = r() < 0.5 ? 1 : -1
    const len = 5 + Math.floor(r() * 9)
    for (let k = 0; k < len; k++) {
      cv.set(x, y + 1, rim)
      cv.set(x, y, k > 1 && k < len - 2 ? core : rim)
      x += r() < 0.75 ? dir * 2 : 0
      y += r() < 0.55 ? 1 : 0
      if (r() < 0.15) y -= 1
    }
  }
}

const ASH = [[52, 45, 44], [61, 53, 51], [71, 62, 58], [82, 71, 66], [94, 82, 75]]
const BASALT = [[30, 25, 27], [38, 31, 32], [46, 38, 38], [55, 46, 44], [66, 55, 51]]
const CINDER = [[74, 44, 34], [88, 54, 40], [102, 64, 46], [116, 76, 54], [130, 88, 62]]
const SNOW = [[194, 204, 226], [206, 215, 234], [217, 225, 241], [227, 233, 246], [236, 241, 250]]
const SNOW_SHADE = [[184, 196, 222], [196, 207, 230], [208, 218, 238], [220, 228, 244], [232, 238, 250]]
const SNOW_PATH = [[168, 172, 190], [180, 184, 202], [192, 196, 212], [204, 207, 221], [215, 218, 230]]
const FROST = [[64, 80, 104], [76, 94, 118], [90, 108, 132], [106, 124, 146], [122, 140, 160]]
const CLOUD = [[150, 154, 178], [164, 168, 190], [178, 182, 202], [192, 195, 213], [206, 208, 224]]
const CLOUD_DARK = [[94, 98, 120], [106, 110, 132], [119, 123, 144], [133, 137, 157], [148, 152, 170]]
const MARBLE = [[160, 158, 170], [172, 170, 181], [184, 182, 192], [195, 193, 202], [205, 204, 212]]
const SKY_ROAD = [[146, 136, 118], [160, 150, 130], [174, 164, 142], [188, 178, 156], [200, 191, 170]]
const RUIN_GRASS = [[66, 76, 44], [76, 86, 48], [88, 96, 54], [100, 106, 60], [112, 116, 66]]
const FLAG = [[100, 96, 88], [114, 110, 100], [128, 124, 112], [142, 138, 124], [154, 150, 136]]
const GRAVE = [[42, 38, 44], [50, 46, 52], [58, 53, 58], [67, 61, 65], [77, 70, 73]]

await make('ash', (cv) => {
  base(cv, ASH, 901, { stretch: 2 })
  specks(cv, 33, 220, [[44, 38, 38], [130, 120, 110], [60, 52, 50]])
  pebbles(cv, 35, 26, [128, 118, 108], [72, 64, 60], [40, 34, 34])
})
await make('basalt', (cv) => {
  slabs(cv, BASALT, 902, { gx: 7, gy: 3, mortar: [18, 14, 16], light: [80, 66, 60], gap: 1.4 })
  glowCracks(cv, 37, 9, [255, 150, 60], [120, 42, 22])
  specks(cv, 39, 60, [[22, 18, 20], [90, 74, 66]])
})
await make('cinder', (cv) => {
  base(cv, CINDER, 903, { stretch: 2 })
  pebbles(cv, 41, 70, [150, 104, 76], [80, 46, 34], [44, 26, 22])
  specks(cv, 43, 160, [[56, 30, 24], [168, 110, 70], [200, 96, 40]])
})
await make('snow', (cv) => {
  base(cv, SNOW, 904, { stretch: 2, dither: 0.14 })
  drifts(cv, 45, [252, 253, 255], [186, 198, 226], 0.55)
  specks(cv, 47, 70, [[255, 255, 255], [196, 214, 240]])
})
await make('snow-shade', (cv) => {
  base(cv, SNOW_SHADE, 905, { stretch: 2, dither: 0.14 })
  drifts(cv, 49, [244, 248, 254], [172, 184, 214], 0.7)
  specks(cv, 51, 50, [[250, 252, 255], [180, 196, 228]])
})
await make('snow-path', (cv) => {
  base(cv, SNOW_PATH, 906, { stretch: 2 })
  pebbles(cv, 53, 34, [196, 182, 160], [122, 106, 90], [96, 92, 104])
  specks(cv, 55, 120, [[226, 230, 240], [120, 116, 124], [146, 128, 108]])
})
await make('frost-stone', (cv) => {
  slabs(cv, FROST, 907, { gx: 8, gy: 4, mortar: [40, 50, 70], light: [150, 172, 196], gap: 1.3 })
  specks(cv, 57, 90, [[200, 226, 246], [52, 66, 88]])
})
await make('cloud', (cv) => {
  base(cv, CLOUD, 908, { dither: 0.06 })
  puffs(cv, 59, [222, 224, 236], [128, 132, 160])
})
await make('cloud-dark', (cv) => {
  base(cv, CLOUD_DARK, 909, { dither: 0.06 })
  puffs(cv, 61, [166, 170, 188], [76, 80, 102])
})
await make('marble', (cv) => {
  slabs(cv, MARBLE, 910, { gx: 7, gy: 4, mortar: [116, 112, 132], light: [222, 220, 230], gap: 1.2, jitter: 0.14 })
  cracks(cv, 63, 10, [138, 134, 150], [212, 210, 220])
  specks(cv, 65, 30, [[206, 180, 120]])
})
await make('sky-road', (cv) => {
  slabs(cv, SKY_ROAD, 911, { gx: 12, gy: 6, mortar: [96, 88, 78], light: [214, 206, 186], gap: 1.2 })
  specks(cv, 67, 60, [[120, 110, 96], [222, 214, 196]])
})
await make('ruin-grass', (cv) => {
  base(cv, RUIN_GRASS, 912)
  blades(cv, 69, 110, [136, 140, 80], [104, 112, 62], [46, 54, 32])
  pebbles(cv, 71, 18, [150, 146, 136], [96, 92, 86], [50, 48, 44])
})
await make('flagstone', (cv) => {
  slabs(cv, FLAG, 913, { gx: 9, gy: 4, mortar: [62, 70, 44], light: [176, 170, 154], gap: 1.6, holes: 0.12, hole: [[78, 62, 46], [92, 74, 54], [70, 80, 46]] })
  cracks(cv, 73, 14, [72, 68, 62], [160, 156, 142])
  specks(cv, 75, 40, [[82, 96, 52], [96, 110, 58]])
})
await make('grave-soil', (cv) => {
  base(cv, GRAVE, 914)
  blades(cv, 77, 70, [104, 112, 92], [78, 86, 72], [32, 30, 36])
  specks(cv, 79, 90, [[30, 26, 32], [96, 90, 96]])
})
console.log('terrain textures ->', OUT)
