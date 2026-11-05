// 분수 물결 도트 애니메이션(2026-11-05) — PixelLab 없이 분수 그림에서 물(용암) 픽셀을 골라 흐르는 반짝임 프레임을 만든다.
//   · 물 픽셀 = 푸른·청록 계열(용암 분수는 주황·노랑 계열) · 프레임 FRAMES 장을 가로로 이어 public/images/map/fountain-fx/<이름>.png
//   · 무늬: 대각선으로 흘러가는 물빛 줄(수반) + 위에서 아래로 떨어지는 물줄기 하이라이트 + 몇 점 반짝임 — 전부 1px 도트
//   · 게임: components/game/raster-prop 이 같은 크기·앵커로 겹쳐 프레임을 넘긴다(lib/fountain-fx-data)
// usage: node --experimental-transform-types --import ./scripts/_ts-loader.mjs scripts/gen-fountain-fx.mjs
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { MAPS } from '@/lib/maps'
import { HALL_SPR } from '@/lib/academy-hall'

const PUB = path.join(process.cwd(), 'public')
const OUT = path.join(PUB, 'images/map/fountain-fx')
const FRAMES = 8
fs.mkdirSync(OUT, { recursive: true })

const srcs = new Set()
for (const m of Object.values(MAPS)) for (const p of m.props ?? []) if (p.sprite && (p.kind === 'fountain' || /fountain|octo/i.test(p.sprite))) srcs.add(p.sprite.split('?')[0])
srcs.add(HALL_SPR.fountain.s)
// 흐르면 안 되는 것 — 폐허의 마법 기둥(보랏빛), 얼어붙은 분수(설원)
const SKIP = /ruin_landmark|aurora_landmark|iso_ice_fountain/
for (const s of [...srcs]) if (SKIP.test(s)) srcs.delete(s)

const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const table = {}
for (const src of srcs) {
  const f = path.join(PUB, src)
  if (!fs.existsSync(f)) continue
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const W = info.width
  const H = info.height
  const lava = /lava|demon|dem_|magma|ember/i.test(src)
  const isWater = (r, g, b) => {
    if (lava) return r > 170 && r > b + 70 && g > 60 && r >= g
    const mx = Math.max(r, g, b)
    return b > r + 28 && b + 8 >= g && mx > 70
  }
  const mask = new Uint8Array(W * H)
  let n = 0
  for (let i = 0; i < W * H; i++) {
    const a = data[i * 4 + 3]
    if (a < 120) continue
    if (isWater(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) {
      mask[i] = 1
      n++
    }
  }
  if (n < 40) continue
  // 물줄기(세로로 길쭉한 물) vs 수반(가로로 넓은 물) — 위아래 이웃이 물인 비율로 가른다
  const vert = new Uint8Array(W * H)
  for (let y = 2; y < H - 2; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x
      if (!mask[i]) continue
      const v = mask[i - W] + mask[i + W] + mask[i - 2 * W] + mask[i + 2 * W]
      const h = mask[i - 1] + mask[i + 1]
      vert[i] = v >= 4 && h <= 1 ? 1 : 0
    }
  const sheet = Buffer.alloc(W * FRAMES * H * 4)
  for (let t = 0; t < FRAMES; t++) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        if (!mask[i]) continue
        const r = data[i * 4]
        const g = data[i * 4 + 1]
        const b = data[i * 4 + 2]
        let k = 0
        if (vert[i]) {
          // 떨어지는 물줄기 — 6px 간격 하이라이트가 프레임마다 아래로
          if ((((y - t * 3 + Math.floor(hash(x, 7) * 6)) % 6) + 6) % 6 < 2) k = 0.6
        } else {
          // 수반 — 대각 물빛 줄이 흘러간다 + 가장자리 물결
          const ph = (((x + 2 * y - t * 2) % 16) + 16) % 16
          if (ph < 1) k = 0.55
          else if (ph < 2) k = 0.25
          const edge = !mask[i - W] || !mask[i + W] || !mask[i - 1] || !mask[i + 1]
          if (edge && (((x + t) % 4) + 4) % 4 === 0) k = Math.max(k, 0.35)
        }
        // 드문 반짝임
        if (hash(x * 13 + t, y * 7) > 0.985) k = 0.85
        if (!k) continue
        const hi = lava ? [255, 236, 150] : [235, 252, 255]
        const o = (y * W * FRAMES + t * W + x) * 4
        sheet[o] = Math.round(r + (hi[0] - r) * k)
        sheet[o + 1] = Math.round(g + (hi[1] - g) * k)
        sheet[o + 2] = Math.round(b + (hi[2] - b) * k)
        sheet[o + 3] = 255
      }
  }
  const name = path.basename(src, '.png')
  await sharp(sheet, { raw: { width: W * FRAMES, height: H, channels: 4 } }).png().toFile(path.join(OUT, `${name}.png`))
  table[src] = { fx: `/images/map/fountain-fx/${name}.png`, w: W, h: H, frames: FRAMES }
  console.log(name, `${W}x${H}`, `물 ${n}px`, lava ? '(용암)' : '')
}

fs.writeFileSync(
  path.join(process.cwd(), 'lib', 'fountain-fx-data.ts'),
  `// 자동 생성 — scripts/gen-fountain-fx.mjs (분수 그림 → 물결 도트 프레임 시트)\nexport const FOUNTAIN_FX: Record<string, { fx: string; w: number; h: number; frames: number }> = ${JSON.stringify(table, null, 1)}\n`,
)
console.log(`${Object.keys(table).length}개 분수 → lib/fountain-fx-data.ts`)
