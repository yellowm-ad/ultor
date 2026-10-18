// 세 기숙사 휴게실 문 · 깃발 (2026-10-18) — 1층 속성 수업관 문(door_ice / door_earth / door_fire)을 바탕으로
// 아치 창을 상징동물 스테인드글라스로 바꾸고, 아치 위에 상징동물 문장(메달)을 올린다. 깃발은 banner_flat 을 기숙사 색으로.
//   요르문간드(얼음) = 제 꼬리를 문 뱀 · 펜리르(대지) = 늑대 머리 · 헬라(불) = 날개 편 불사조
//
// node scripts/gen-house-doors.mjs
//   → public/images/map/props/academy/door_house_{jor,fen,hel}.png · banner_house_{jor,fen,hel}.png
import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const P = path.join(WEB, 'public/images/map/props/academy')
const A = path.join(WEB, 'public/images/map/academy')

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

/** RGBA 버퍼 위의 작은 도트 캔버스 */
class Canvas {
  constructor(w, h, data) {
    this.w = w
    this.h = h
    this.d = data ?? Buffer.alloc(w * h * 4)
  }
  static async load(file, padTop = 0) {
    const img = sharp(file).ensureAlpha()
    const { width, height } = await img.metadata()
    const src = await img.raw().toBuffer()
    const c = new Canvas(width, height + padTop)
    src.copy(c.d, padTop * width * 4)
    return c
  }
  get(x, y) {
    const i = (y * this.w + x) * 4
    return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]
  }
  put(x, y, col) {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const [r, g, b] = typeof col === 'string' ? hex(col) : col
    const i = (y * this.w + x) * 4
    this.d[i] = r
    this.d[i + 1] = g
    this.d[i + 2] = b
    this.d[i + 3] = 255
  }
  png() {
    return sharp(this.d, { raw: { width: this.w, height: this.h, channels: 4 } }).png()
  }
}

/** 모양(셀 집합)을 만들어 칠하는 도구 — 채우고 바깥 1px 테두리 */
class Shape {
  constructor() {
    this.cells = new Map() // "x,y" → 색
  }
  set(x, y, col) {
    this.cells.set(`${Math.round(x)},${Math.round(y)}`, col)
  }
  has(x, y) {
    return this.cells.has(`${x},${y}`)
  }
  poly(pts, col) {
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        let inside = false
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i]
          const [xj, yj] = pts[j]
          if (yi > y + 0.01 !== yj > y + 0.01 && x < ((xj - xi) * (y + 0.01 - yi)) / (yj - yi) + xi) inside = !inside
        }
        if (inside) this.set(x, y, typeof col === 'function' ? col(x, y) : col)
      }
  }
  disc(cx, cy, r, col) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if (Math.hypot(x - cx, y - cy) <= r) this.set(x, y, typeof col === 'function' ? col(x, y) : col)
  }
  ring(cx, cy, rx, ry, t, col) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const k = Math.hypot((x - cx) / rx, (y - cy) / ry)
        if (k <= 1 && k >= 1 - t / Math.min(rx, ry)) this.set(x, y, typeof col === 'function' ? col(x, y) : col)
      }
  }
  /** 캔버스에 그린다 — outline 색이 있으면 바깥 테두리 먼저 */
  draw(c, outline) {
    if (outline)
      for (const key of this.cells.keys()) {
        const [x, y] = key.split(',').map(Number)
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!this.has(x + dx, y + dy)) c.put(x + dx, y + dy, outline)
      }
    for (const [key, col] of this.cells) {
      const [x, y] = key.split(',').map(Number)
      c.put(x, y, col)
    }
  }
}

// ── 상징동물(중심 cx,cy · 배율 k · 팔레트 [밝음, 기본, 어둠, 눈]) ──
function serpent(cx, cy, k, [li, mid, dk, eye]) {
  const s = new Shape()
  const rx = 9.5 * k
  const ry = 8 * k
  // 몸통 고리(제 꼬리를 문 뱀) — 위쪽이 밝고 비늘 무늬(대각 점), 가운데는 비어 유리가 보인다
  s.ring(cx, cy, rx, ry, 3.4 * k, (x, y) => ((x * 2 + y) % 4 === 0 ? dk : y < cy ? li : mid))
  // 꼬리 끝(머리 아래로 가늘게)
  s.poly([[cx + rx * 0.2, cy - ry - 0.4 * k], [cx + rx * 0.55, cy - ry * 0.95], [cx + rx * 0.35, cy - ry * 0.6]], mid)
  // 머리 — 고리 오른쪽 위에 크게, 위턱·아래턱을 벌려 꼬리를 문다
  const hx = cx + rx * 0.72
  const hy = cy - ry * 0.62
  s.poly([[hx - 3 * k, hy + 1 * k], [hx - 1 * k, hy - 4.5 * k], [hx + 4 * k, hy - 5.5 * k], [hx + 7 * k, hy - 3 * k], [hx + 6.5 * k, hy - 1 * k], [hx + 1 * k, hy - 1.2 * k]], (x, y) => (y < hy - 3 * k ? li : mid))
  s.poly([[hx - 2.5 * k, hy + 1.5 * k], [hx + 1 * k, hy + 0.2 * k], [hx + 5.5 * k, hy + 1.5 * k], [hx + 3 * k, hy + 3.5 * k], [hx - 1 * k, hy + 4 * k]], mid)
  s.set(hx + 2.2 * k, hy - 3.2 * k, eye)
  if (k > 0.9) s.set(hx + 3 * k, hy - 3.2 * k, eye)
  // 송곳니
  s.set(hx + 4.5 * k, hy - 0.4 * k, li)
  return s
}
function wolf(cx, cy, k, [li, mid, dk, eye]) {
  const s = new Shape()
  const shade = (x, y) => (x < cx ? (y < cy ? li : mid) : y < cy - 2 * k ? mid : dk)
  // 귀
  s.poly([[cx - 9 * k, cy - 3 * k], [cx - 7.5 * k, cy - 10.5 * k], [cx - 2.5 * k, cy - 6 * k]], shade)
  s.poly([[cx + 9 * k, cy - 3 * k], [cx + 7.5 * k, cy - 10.5 * k], [cx + 2.5 * k, cy - 6 * k]], shade)
  // 머리 — 넓은 이마 → 삐죽한 볼털 → 좁고 긴 주둥이
  s.poly([
    [cx - 8 * k, cy - 5 * k], [cx - 3 * k, cy - 7.5 * k], [cx + 3 * k, cy - 7.5 * k], [cx + 8 * k, cy - 5 * k],
    [cx + 11 * k, cy + 0 * k], [cx + 8 * k, cy + 1 * k], [cx + 10 * k, cy + 4 * k], [cx + 5 * k, cy + 4.5 * k],
    [cx + 2.5 * k, cy + 10 * k], [cx - 2.5 * k, cy + 10 * k],
    [cx - 5 * k, cy + 4.5 * k], [cx - 10 * k, cy + 4 * k], [cx - 8 * k, cy + 1 * k], [cx - 11 * k, cy + 0 * k],
  ], shade)
  // 귀 안쪽 · 눈썹 · 눈 · 코 · 콧등
  for (const sx of [-1, 1]) {
    s.poly([[cx + sx * 7.4 * k, cy - 4.5 * k], [cx + sx * 7.1 * k, cy - 8.5 * k], [cx + sx * 4.2 * k, cy - 6 * k]], dk)
    s.set(cx + sx * 3.6 * k, cy - 1 * k, eye)
    if (k > 0.8) s.set(cx + sx * 4.4 * k, cy - 1.3 * k, eye)
    s.set(cx + sx * 3 * k, cy - 2.6 * k, dk)
    s.set(cx + sx * 4.4 * k, cy - 3 * k, dk)
  }
  for (let y = cy + 1 * k; y < cy + 6 * k; y++) s.set(cx, y, cx % 1 ? mid : li)
  s.poly([[cx - 1.8 * k, cy + 7 * k], [cx + 1.8 * k, cy + 7 * k], [cx, cy + 9.2 * k]], dk)
  return s
}
function phoenix(cx, cy, k, [li, mid, dk, eye]) {
  const s = new Shape()
  // 불꽃처럼 위로 치솟는 V 자 날개(깃 끝 세 갈래)
  for (const sx of [-1, 1]) {
    const X = (v) => cx + sx * v * k
    const Y = (v) => cy + v * k
    s.poly([[X(1.5), Y(-1.5)], [X(5), Y(-10)], [X(7), Y(-6.5)], [X(10), Y(-11)], [X(10.5), Y(-5)], [X(13), Y(-7)], [X(11.5), Y(0)], [X(7), Y(2.5)], [X(2), Y(3)]], (x, y) => (y < cy - 5 * k ? li : sx < 0 ? mid : dk))
    // 날개 안쪽 결
    s.poly([[X(3), Y(-1)], [X(8.5), Y(-4)], [X(9), Y(-1)], [X(3), Y(1.5)]], sx < 0 ? li : mid)
  }
  // 꼬리깃 — 아래로 세 갈래
  s.poly([[cx - 1.5 * k, cy + 3 * k], [cx - 5 * k, cy + 11 * k], [cx - 2.5 * k, cy + 9.5 * k], [cx, cy + 12.5 * k], [cx + 2.5 * k, cy + 9.5 * k], [cx + 5 * k, cy + 11 * k], [cx + 1.5 * k, cy + 3 * k]], (x) => (x < cx ? mid : dk))
  // 몸통 · 머리 · 볏 · 부리
  s.poly([[cx - 2.2 * k, cy - 3 * k], [cx + 2.2 * k, cy - 3 * k], [cx + 1.8 * k, cy + 4 * k], [cx - 1.8 * k, cy + 4 * k]], (x) => (x < cx ? li : mid))
  s.disc(cx, cy - 5 * k, 2.3 * k, li)
  s.poly([[cx - 1 * k, cy - 7 * k], [cx - 2.2 * k, cy - 11 * k], [cx + 0.4 * k, cy - 8.5 * k], [cx + 1.8 * k, cy - 10.5 * k], [cx + 1.4 * k, cy - 6.5 * k]], mid)
  s.poly([[cx + 1.8 * k, cy - 5.6 * k], [cx + 4.2 * k, cy - 4.6 * k], [cx + 1.8 * k, cy - 3.8 * k]], dk)
  s.set(cx + 0.6 * k, cy - 5.4 * k, eye)
  return s
}

const HOUSES = [
  {
    id: 'jor',
    door: 'door_ice.png',
    win: { x0: 22, x1: 70, y0: 14, y1: 48 },
    glass: ['#123c6e', '#1f63a8', '#4fa6e0', '#9ad6f6'],
    lead: '#0a1c30',
    emblem: serpent,
    pal: ['#f2fbff', '#a9d4ee', '#4c7fa6', '#ff4d4d'],
    outline: '#0a1c30',
    medal: ['#c9d6e2', '#7f93a8', '#3a4a5c'],
    cloth: ['#2f6fb0', '#1e4f86', '#143a66', '#0c2848'],
    trim: '#d8e8f4',
  },
  {
    id: 'fen',
    door: 'door_earth.png',
    win: { x0: 18, x1: 68, y0: 10, y1: 47 },
    glass: ['#173d22', '#2b6a38', '#53a050', '#a6d98a'],
    lead: '#0d2414',
    emblem: wolf,
    pal: ['#f6deaa', '#d39e52', '#7c5222', '#fff7c0'],
    outline: '#2a1606',
    medal: ['#d9b878', '#a07a3c', '#5a3e18'],
    cloth: ['#4f8a3e', '#3a6c2e', '#2a5222', '#1a3816'],
    trim: '#e6c27a',
  },
  {
    id: 'hel',
    door: 'door_fire.png',
    win: { x0: 23, x1: 65, y0: 12, y1: 46 },
    glass: ['#4a0c08', '#8e1e12', '#d2471e', '#f6a043'],
    lead: '#220504',
    emblem: phoenix,
    pal: ['#fff0a8', '#ffc23a', '#d0661a', '#3a0a04'],
    outline: '#2a0704',
    medal: ['#e8c26a', '#b07c2c', '#5e3a10'],
    cloth: ['#b8322a', '#8e221c', '#6a1814', '#48100c'],
    trim: '#f0c860',
  },
]

const PAD = 30 // 아치 위 문장 자리

for (const h of HOUSES) {
  // ── 문 ──
  const c = await Canvas.load(path.join(P, h.door), PAD)
  const { x0, x1, y0, y1 } = h.win
  const wx0 = x0
  const wx1 = x1
  const wy0 = y0 + PAD
  const wy1 = y1 + PAD
  const cx = (wx0 + wx1) / 2
  const rx = (wx1 - wx0) / 2
  const archY = wy0 + rx * 0.9 // 반원 아치가 끝나는 높이
  const inWin = (x, y) => x >= wx0 && x <= wx1 && y <= wy1 && (y >= archY || Math.hypot((x - cx) / rx, (y - archY) / (archY - wy0)) <= 1)
  // 유리 — 위가 밝고 아래가 짙은 띠 + 납선 마름모 격자
  for (let y = wy0 - 1; y <= wy1; y++)
    for (let x = wx0; x <= wx1; x++) {
      if (!inWin(x, y)) continue
      const edge = !inWin(x - 1, y) || !inWin(x + 1, y) || !inWin(x, y - 1) || !inWin(x, y + 1)
      if (edge) {
        c.put(x, y, h.lead)
        continue
      }
      const t = (y - wy0) / (wy1 - wy0)
      let col = h.glass[t < 0.3 ? 3 : t < 0.6 ? 2 : t < 0.85 ? 1 : 0]
      if ((x + y) % 9 === 0 || (x - y + 900) % 9 === 0) col = h.glass[Math.max(0, h.glass.indexOf(col) - 1)]
      c.put(x, y, col)
    }
  // 가운데 문양
  h.emblem(cx, (wy0 + wy1) / 2 + 1.5, 1.15, h.pal).draw(c, h.outline)

  // 아치 위 메달 문장
  const mx = Math.round(c.w / 2) - 0.5
  const my = 15
  const medal = new Shape()
  medal.disc(mx, my, 13, (x, y) => (Math.hypot(x - mx, y - my) > 10.5 ? (y < my ? h.medal[0] : h.medal[1]) : y < my ? h.glass[2] : h.glass[1]))
  // 메달 받침(아치 꼭대기까지 늘어진 장식)
  medal.poly([[mx - 5, my + 10], [mx + 5, my + 10], [mx + 2, PAD + 6], [mx - 2, PAD + 6]], (x) => (x < mx ? h.medal[0] : h.medal[1]))
  medal.draw(c, h.medal[2])
  h.emblem(mx, my + 0.5, 0.82, h.pal).draw(c, h.outline)
  // 메달 반짝임
  c.put(mx - 7, my - 8, '#ffffff')
  c.put(mx - 8, my - 7, '#ffffff')

  const out = path.join(P, `door_house_${h.id}.png`)
  await c.png().toFile(out)

  // ── 깃발 ── banner_flat(남색)을 기숙사 색으로 바꾸고 독수리 대신 상징동물
  const b = await Canvas.load(path.join(A, 'banner_flat.png'))
  // 천: 원래 남색 밝기를 기숙사 색 4단으로(접힌 면 명암 유지). 문양 자리(22<y<68)는 접힌 면 따라 천 색으로 덮는다
  const navyLum = []
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const [r, g, bl, a] = b.get(x, y)
      if (a > 10 && bl > r + 15 && bl > g + 10) navyLum.push((r + g + bl) / 3)
    }
  navyLum.sort((p, q) => p - q)
  const q = (t) => navyLum[Math.floor(navyLum.length * t)]
  const cuts = [q(0.85), q(0.45), q(0.12)]
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const [r, g, bl, a] = b.get(x, y)
      if (a < 10) continue
      const navy = bl > r + 15 && bl > g + 10
      const gold = r > 150 && g > 100 && bl < 110
      if (navy) {
        const lum = (r + g + bl) / 3
        b.put(x, y, h.cloth[lum >= cuts[0] ? 0 : lum >= cuts[1] ? 1 : lum >= cuts[2] ? 2 : 3])
      } else if (gold) b.put(x, y, r > 200 ? h.trim : h.medal[1])
    }
  // 옛 문양 자리 — 바로 위(y=19) 천 줄을 그대로 내려 덮는다(접힌 면 명암 유지)
  for (let y = 20; y < 70; y++) for (let x = 6; x < 41; x++) if (b.get(x, 19)[3] > 10) b.put(x, y, b.get(x, 19))
  h.emblem(23, 44, 1.05, h.pal).draw(b, h.outline)
  await b.png().toFile(path.join(P, `banner_house_${h.id}.png`))
  console.log('ok', h.id, c.w, c.h)
}
