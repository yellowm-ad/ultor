// 농사 도트 그림 생성기(2026-11-05) — PixelLab 없이 코드로 찍는 16×16(나무 16×24) 픽셀 아트 → SVG.
//   · public/images/farm/<crop>-<0..3>.svg   작물 성장 4단계(새싹 · 자람 · 거의 다 · 수확)
//   · public/images/items/life/<itemId>.svg   씨앗·수확물 아이콘
// usage: node --experimental-transform-types --import ./scripts/_ts-loader.mjs scripts/gen-farm-art.mjs
import fs from 'node:fs'
import path from 'node:path'
import { CROPS } from '@/lib/farming'

const PUB = path.join(process.cwd(), 'public')
fs.mkdirSync(path.join(PUB, 'images/farm'), { recursive: true })

// ── 색 도우미 ──
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const toHex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
const shade = (h, k) => toHex(hex(h).map((v) => (k < 0 ? v * (1 + k) : v + (255 - v) * k)))
const OUT = '#2a1e14'
const G = { d: '#2f6b2a', m: '#4a9a3a', l: '#7cc65a', y: '#b8e07a' }

class Canvas {
  constructor(w = 16, h = 16) { this.w = w; this.h = h; this.px = new Map() }
  set(x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px.set(`${x},${y}`, c) }
  rect(x, y, w, h, c) { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) this.set(x + i, y + j, c) }
  disc(cx, cy, r, c, c2) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) this.set(cx + x, cy + y, c2 && x + y < -r * 0.4 ? c2 : c)
  }
  /** 바깥 테두리(투명 이웃) 자동 */
  outline() {
    const add = []
    for (const k of this.px.keys()) {
      const [x, y] = k.split(',').map(Number)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!this.px.has(`${x + dx},${y + dy}`)) add.push([x + dx, y + dy])
    }
    for (const [x, y] of add) this.set(x, y, OUT)
    return this
  }
  svg() {
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w * 2}" height="${this.h * 2}" shape-rendering="crispEdges">`
    for (const [k, c] of this.px) { const [x, y] = k.split(','); s += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>` }
    return s + '</svg>'
  }
}

// ── 그리기 부품 ──
const blade = (cv, x, y0, h, c, lean = 0) => { for (let i = 0; i < h; i++) cv.set(x + Math.round((i / h) * lean), y0 - i, c) }
const leafPair = (cv, x, y, c) => { cv.set(x - 1, y, c); cv.set(x + 1, y, c); cv.set(x - 2, y - 1, c); cv.set(x + 2, y - 1, c) }
const sprout = (cv, x, y) => { cv.set(x, y, G.m); cv.set(x, y - 1, G.l); cv.set(x - 1, y - 2, G.l); cv.set(x + 1, y - 2, G.m) }

function drawStage(c, stage) {
  const tree = c.art === 'tree'
  const cv = new Canvas(16, tree ? 24 : 16)
  const B = cv.h - 2 // 땅 높이
  const col = c.color
  switch (c.art) {
    case 'grain': {
      const xs = [4, 7, 10, 12]
      const h = [2, 5, 8, 9][stage]
      xs.forEach((x, i) => {
        if (stage === 0 && i % 2) return
        blade(cv, x, B, h, stage === 3 ? '#c9a240' : i % 2 ? G.l : G.m, i % 2 ? 1 : -1)
        if (stage >= 2) { const top = B - h + 1; cv.rect(x - (i % 2 ? 0 : 1), top - 2, 2, 3, stage === 3 ? col : G.y) }
      })
      break
    }
    case 'root': {
      const leaves = [1, 2, 3, 3][stage]
      for (let i = 0; i < leaves + 1; i++) blade(cv, 6 + i * 2 - (i > 1 ? 1 : 0), B - 1, 2 + stage + (i % 2), i % 2 ? G.l : G.m, i - 1)
      if (stage >= 2) leafPair(cv, 8, B - 2 - stage, G.m)
      if (stage === 3) { cv.rect(6, B - 1, 5, 2, col); cv.rect(7, B - 2, 3, 1, shade(col, 0.25)) }
      break
    }
    case 'vine': {
      if (stage === 0) { sprout(cv, 8, B); break }
      cv.rect(3, B, 10, 1, G.d)
      for (let x = 3; x < 13; x += 3) { cv.set(x, B - 1, G.m); cv.set(x + 1, B - 2, G.l) }
      if (stage >= 2) { const r = stage === 3 ? 4 : 2; cv.disc(9, B - r, r, col, shade(col, 0.3)); if (c.id === 'melon') for (let x = 9 - r + 1; x < 9 + r; x += 2) cv.rect(x, B - 2 * r + 1, 1, 2 * r - 1, shade(col, -0.35)); if (stage === 3) cv.set(9, B - 2 * r - 1, '#5a3a1a') }
      break
    }
    case 'cane': {
      const seg = [1, 2, 4, 6][stage]
      for (const x of [6, 9]) for (let i = 0; i < seg; i++) { cv.rect(x, B - i * 2 - 1, 2, 2, i % 2 ? G.l : col); cv.set(x + 2, B - i * 2 - 1, G.m) }
      break
    }
    case 'bush': {
      if (stage === 0) { sprout(cv, 8, B); break }
      const r = [0, 3, 5, 5][stage]
      cv.disc(8, B - r, r, G.m, G.l)
      if (stage === 3) for (const [x, y] of [[5, B - 4], [9, B - 7], [11, B - 3], [7, B - 2], [10, B - 9], [4, B - 7]]) { cv.set(x, y, col); cv.set(x, y - 1, shade(col, 0.4)) }
      break
    }
    case 'flower': {
      if (stage === 0) { sprout(cv, 8, B); break }
      blade(cv, 8, B, 3 + stage * 2, G.m)
      leafPair(cv, 8, B - 2, G.l)
      const top = B - 2 - stage * 2
      if (stage === 2) cv.rect(7, top - 1, 2, 2, G.y)
      if (stage === 3) { cv.disc(8, top - 1, 2, col, shade(col, 0.5)); cv.set(8, top - 1, '#ffe27a') }
      break
    }
    case 'shroom': {
      const sizes = [[1], [1, 2], [2, 3], [3, 3, 2]][stage]
      const xs = [8, 5, 11]
      sizes.forEach((r, i) => {
        const x = xs[i]
        cv.rect(x, B - r, 1, r + 1, '#efe4cc')
        cv.disc(x, B - r - 1, r, col, shade(col, 0.35))
        cv.rect(x - r, B - r - 1, 2 * r + 1, 1, shade(col, -0.3))
      })
      break
    }
    case 'herb': {
      if (stage === 0) { sprout(cv, 8, B); break }
      const n = stage + 2
      for (let i = 0; i < n; i++) { const x = 8 + (i - (n - 1) / 2) * 2; blade(cv, Math.round(x), B, 3 + stage + (i % 2), i % 2 ? G.l : G.m, i - n / 2); cv.set(Math.round(x) - 1, B - 2 - stage, G.y) }
      if (stage === 3) for (let i = 0; i < 3; i++) cv.set(5 + i * 3, B - 6 - (i % 2), col)
      break
    }
    case 'tree': {
      if (stage === 0) { cv.rect(8, B - 3, 1, 4, '#7a5230'); leafPair(cv, 8, B - 3, G.l); cv.set(8, B - 4, G.m); break }
      const th = [0, 6, 9, 11][stage]
      const r = [0, 3, 5, 6][stage]
      cv.rect(7, B - th, 2, th + 1, '#7a5230')
      cv.rect(7, B - th, 1, th + 1, '#5a3a20')
      cv.disc(8, B - th - r + 2, r, G.m, G.l)
      if (stage >= 2) cv.disc(5, B - th + 1, r - 2, G.d, G.m), cv.disc(11, B - th + 1, r - 2, G.d, G.m)
      if (stage === 3) for (const [x, y] of [[6, B - th - 3], [10, B - th - 5], [12, B - th], [4, B - th]]) cv.set(x, y, '#d8302a')
      break
    }
  }
  return cv.outline().svg()
}

// ── 아이콘 ──
function seedIcon(c) {
  const cv = new Canvas()
  if (c.art === 'tree' || c.art === 'bush' || c.art === 'cane') {
    // 묘목 — 작은 화분
    cv.rect(5, 10, 6, 4, '#a8643a'); cv.rect(4, 10, 8, 1, '#c27a48'); cv.rect(6, 13, 4, 1, '#7a4426')
    blade(cv, 8, 9, 5, G.m); leafPair(cv, 8, 6, G.l); cv.set(8, 4, c.art === 'bush' ? c.color : G.l)
  } else if (c.id === 'potato') {
    cv.disc(8, 9, 4, '#c79a5a', '#e0b878'); cv.set(6, 8, '#8a6232'); cv.set(10, 11, '#8a6232'); cv.set(9, 4, G.l); cv.set(8, 5, G.m)
  } else {
    // 씨앗 봉투 + 그림
    cv.rect(3, 3, 10, 11, '#e8d6a8'); cv.rect(3, 3, 10, 2, '#c9a86a'); cv.rect(3, 13, 10, 1, '#b8955a')
    cv.disc(8, 9, 2, c.color, shade(c.color, 0.4))
    for (const [x, y] of [[5, 12], [11, 11], [6, 6]]) cv.set(x, y, '#8a6a3a')
  }
  return cv.outline().svg()
}
function produceIcon(id) {
  const cv = new Canvas()
  const draw = {
    'crop-wheat': () => { for (const x of [6, 8, 10]) { blade(cv, x, 14, 9, '#c9a240', x - 8); cv.rect(x - 1 + Math.round((x - 8) * 0.9), 4, 2, 4, '#e2c25a') } cv.rect(5, 11, 7, 1, '#a8302a') },
    'crop-potato': () => { cv.disc(8, 9, 5, '#c79a5a', '#e0b878'); for (const [x, y] of [[6, 7], [10, 10], [8, 12], [11, 7]]) cv.set(x, y, '#8a6232') },
    'crop-carrot': () => { for (let i = 0; i < 9; i++) cv.rect(7 - Math.floor((8 - i) / 3) + 1, 5 + i, Math.max(1, 4 - Math.floor(i / 3)), 1, '#ec8a2c'); cv.set(8, 9, '#c26a1a'); blade(cv, 7, 5, 4, G.m, -1); blade(cv, 9, 5, 4, G.l, 1) },
    'crop-beetroot': () => { cv.disc(8, 10, 4, '#a8304a', '#c8506a'); cv.set(8, 15, '#7a1a30'); blade(cv, 7, 6, 4, G.m, -1); blade(cv, 9, 6, 4, '#7a1a30', 1) },
    'crop-pumpkin': () => { cv.disc(8, 9, 6, '#e07a1a', '#f29a3a'); for (const x of [5, 8, 11]) cv.rect(x, 4, 1, 10, '#b85a10'); cv.rect(8, 2, 1, 2, '#5a3a1a'); cv.set(9, 2, G.m) },
    'crop-melon': () => { for (let y = 0; y < 8; y++) cv.rect(8 - y, 4 + y, 2 * y + 1, 1, y > 5 ? '#3f9a3a' : y > 4 ? '#e8f0c0' : '#e24a4a'); for (const [x, y] of [[7, 7], [9, 8], [6, 9], [10, 9]]) cv.set(x, y, '#2a1a10') },
    'crop-sugarcane': () => { for (const x of [5, 8, 11]) for (let i = 0; i < 6; i++) cv.rect(x, 2 + i * 2, 1, 2, i % 2 ? '#a8e07a' : '#8ccf5a') },
    'crop-berry': () => { for (const [x, y] of [[6, 8], [9, 7], [8, 10], [11, 10], [6, 11]]) cv.disc(x, y, 1, '#d6334f', '#f26a7f'); blade(cv, 8, 6, 3, G.m) },
    'crop-apple': () => { cv.disc(8, 9, 5, '#d8302a', '#f2605a'); cv.rect(8, 3, 1, 2, '#5a3a1a'); cv.set(9, 3, G.l); cv.set(10, 2, G.m) },
  }[id]
  draw?.()
  return cv.outline().svg()
}

let n = 0
for (const c of CROPS) {
  for (let s = 0; s < 4; s++) { fs.writeFileSync(path.join(PUB, `images/farm/${c.id}-${s}.svg`), drawStage(c, s)); n++ }
  fs.writeFileSync(path.join(PUB, `images/items/life/${c.seedId}.svg`), seedIcon(c)); n++
}
for (const id of ['crop-wheat', 'crop-potato', 'crop-carrot', 'crop-beetroot', 'crop-pumpkin', 'crop-melon', 'crop-sugarcane', 'crop-berry', 'crop-apple']) {
  fs.writeFileSync(path.join(PUB, `images/items/life/${id}.svg`), produceIcon(id)); n++
}
console.log(`농사 그림 ${n}장 → public/images/farm · public/images/items/life`)
