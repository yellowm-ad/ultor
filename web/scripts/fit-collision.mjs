// 길막 맞춤(2026-11-05) — 소품 충돌 사각형이 그림 밖으로 튀어나오지 않게, 그림(PNG)의 불투명 바닥에 맞춰 줄인다.
//   소품마다: 충돌 사각형(바닥 마름모)의 둘레를 화면 좌표로 투영해 그림 픽셀의 알파를 본다.
//   둘레 점의 SAMPLE_OK 이상이 그림 안에 들어올 때까지 중심 기준으로 줄인 배율을 lib/collide-fit.ts 에 적는다.
//   (lib/maps buildBlockers · propBlocker 가 이 표로 사각형을 줄인다. 이미 맞는 소품은 표에 안 들어간다)
// usage: node --experimental-transform-types --import ./scripts/_ts-loader.mjs scripts/fit-collision.mjs
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { MAPS, SOLID_KINDS } from '@/lib/maps'
import { collideKey } from '@/lib/collide-fit'

const PUB = path.join(process.cwd(), 'public')
const SAMPLE_OK = 0.85
const MIN_SCALE = 0.4
const imgs = new Map()
async function load(src) {
  if (imgs.has(src)) return imgs.get(src)
  const f = path.join(PUB, src.split('?')[0])
  let v = null
  if (fs.existsSync(f)) {
    const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    v = { data, w: info.width, h: info.height }
  }
  imgs.set(src, v)
  return v
}

const SOLID = SOLID_KINDS

const out = {}
let seen = 0
let fixed = 0
for (const m of Object.values(MAPS)) {
  for (const p of m.props ?? []) {
    if (!p.sprite || !p.px || p.rotateDeg || p.skewYDeg || p.kind === 'wall') continue
    if (!(p.solid || SOLID.has(p.kind)) || p.solid === false) continue
    const fp = p.collide ?? p.size
    if (!fp) continue
    const key = collideKey(p)
    if (key in out) continue
    const img = await load(p.sprite)
    if (!img) continue
    seen++
    const mirror = (p.facing === 'left' && p.kind !== 'wall') || !!p.mirrorX
    let w = fp.w
    let d = fp.d
    if (mirror) [w, d] = [d, w]
    const off = p.collideOffset ? (mirror ? { x: p.collideOffset.y, y: p.collideOffset.x } : p.collideOffset) : { x: 0, y: 0 }
    // 사각형 중심(셀 기준 앵커에서의 오프셋)
    const c = p.radial ? { x: off.x, y: off.y } : { x: off.x + w / 2, y: off.y + d / 2 }
    const ax = p.anchor?.x ?? p.px.w / 2
    const ay = p.anchor?.y ?? p.px.h
    const kx = img.w / p.px.w
    const ky = img.h / p.px.h
    const alphaAt = (cx, cy) => {
      const sx = (cx - cy) * 32
      const sy = (cx + cy) * 16
      const lx = mirror ? ax - sx : ax + sx
      const ly = ay + sy
      // 2px 여유(도트 가장자리)
      let best = 0
      for (let oy = -2; oy <= 2; oy++)
        for (let ox = -2; ox <= 2; ox++) {
          const px = Math.floor((lx + ox) * kx)
          const py = Math.floor((ly + oy) * ky)
          if (px < 0 || py < 0 || px >= img.w || py >= img.h) continue
          best = Math.max(best, img.data[(py * img.w + px) * 4 + 3])
        }
      return best
    }
    const okAt = (s, t = 0) => {
      const hw = (w * s) / 2
      const hd = (d * s) / 2
      const cxs = c.x - t
      const cys = c.y - t
      let ok = 0
      let n = 0
      const N = 10
      for (let i = 0; i <= N; i++) {
        const u = i / N
        for (const [x, y] of [
          [cxs - hw + 2 * hw * u, cys - hd],
          [cxs - hw + 2 * hw * u, cys + hd],
          [cxs - hw, cys - hd + 2 * hd * u],
          [cxs + hw, cys - hd + 2 * hd * u],
        ]) {
          n++
          if (alphaAt(x, y) > 40) ok++
        }
      }
      return ok / n
    }
    // 중심부터 그림 밖이면(아치·문처럼 가운데가 빈 그림) 손대지 않는다
    if (alphaAt(c.x, c.y) <= 40) continue
    if (okAt(1) >= SAMPLE_OK) continue
    // 크게 줄이기 전에 '뒤로(화면 위로) 조금 옮기기'를 함께 찾는다 — 기준점이 다리보다 아래로 잡힌 가구가 많다
    const tMax = Math.min(w, d) * 0.45 + 1e-9
    let best = null
    for (let s = 1; s >= MIN_SCALE - 1e-9 && !best; s = Math.round((s - 0.05) * 100) / 100) {
      for (let t = 0; t <= tMax; t = Math.round((t + 0.05) * 100) / 100) {
        if (okAt(s, t) >= SAMPLE_OK) {
          best = { s, t }
          break
        }
      }
    }
    if (!best) {
      let bt = 0
      let bv = -1
      for (let t = 0; t <= tMax; t = Math.round((t + 0.05) * 100) / 100) {
        const v = okAt(MIN_SCALE, t)
        if (v > bv) {
          bv = v
          bt = t
        }
      }
      best = { s: MIN_SCALE, t: bt }
    }
    out[key] = best.t ? [best.s, best.t] : best.s
    fixed++
  }
}

const file = path.join(process.cwd(), 'lib', 'collide-fit-data.ts')
const lines = Object.entries(out)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
fs.writeFileSync(
  file,
  `// 자동 생성 — scripts/fit-collision.mjs (소품 충돌 사각형 → 그림 바닥에 맞춘 배율). 손으로 고치지 말고 스크립트를 다시 돌린다.\nexport const COLLIDE_FIT: Record<string, number | [number, number]> = {\n${lines.join('\n')}\n}\n`,
)
console.log(`소품 ${seen}종 검사 · ${fixed}종 줄임 → lib/collide-fit-data.ts`)
