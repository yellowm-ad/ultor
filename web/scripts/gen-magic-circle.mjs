// 이동 마법진(바닥 각인) — PixelLab map-object 원판(scripts/_pixellab/magic-circle-raw.png, 128px 위에서 본 돌 원판)에
// 참고 이미지(이동포탈 디자인 참고용.jpg)의 큰 금빛 삼각형 · 8방위 별 · 작은 룬을 도트로 덧그리고,
// 쿼터뷰 바닥에 눕힌 2:1 타원(256×128)으로 내보낸다. 빛·반짝임은 게임에서 SVG 로 얹는다(components/game/iso-world.tsx).
//
// node scripts/gen-magic-circle.mjs
import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(WEB, 'scripts/_pixellab/magic-circle-raw.png')
const OUT_DIR = path.join(WEB, 'public/images/map/portal')

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width
const C = W / 2
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const put = (x, y, col) => {
  x = Math.round(x)
  y = Math.round(y)
  if (x < 0 || y < 0 || x >= W || y >= W) return
  const i = (y * W + x) * 4
  const [r, g, b] = typeof col === 'string' ? hex(col) : col
  data[i] = r
  data[i + 1] = g
  data[i + 2] = b
  data[i + 3] = 255
}

// 1) 안쪽 원판(r ≤ 28)을 짙은 청회색 석판으로 다시 칠한다 — 가는 동심원 두 줄
const INNER = 28.5
for (let y = 0; y < W; y++)
  for (let x = 0; x < W; x++) {
    const r = Math.hypot(x + 0.5 - C, y + 0.5 - C)
    if (r > INNER) continue
    let col = (x + y) % 2 === 0 ? '#17212d' : '#141c28'
    if (r > 15 && r < 23 && (x * 7 + y * 13) % 11 === 0) col = '#1d2a38' // 돌결
    if (Math.abs(r - 20.5) < 0.55) col = '#2b3d50'
    if (Math.abs(r - 27.3) < 0.6) col = '#c8812f'
    if (Math.abs(r - 26.2) < 0.5) col = '#5a2a0c'
    put(x, y, col)
  }

// 2) 큰 금빛 삼각형(꼭짓점 r=25.5, 위를 향함) — 1px 금선 + 아래쪽 그림자
const tri = [-90, 30, 150].map((a) => [C - 0.5 + Math.cos((a * Math.PI) / 180) * 25.5, C - 0.5 + Math.sin((a * Math.PI) / 180) * 25.5])
function line(a, b, col, dy = 0) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2)
  for (let i = 0; i <= n; i++) put(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n + dy, col)
}
for (let k = 0; k < 3; k++) line(tri[k], tri[(k + 1) % 3], '#5a2a0c', 1)
for (let k = 0; k < 3; k++) line(tri[k], tri[(k + 1) % 3], '#e9a63a')

// 3) 삼각형 바깥 세 칸에 작은 룬(참고 이미지의 연금술 기호 느낌, 5×5)
const RUNES = [
  ['..#..', '.#.#.', '..#..', '..#..', '.###.'],
  ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  ['.###.', '#....', '.##..', '...#.', '###..'],
]
;[90, 210, 330].forEach((a, k) => {
  const cx = C - 0.5 + Math.cos((a * Math.PI) / 180) * 19.5
  const cy = C - 0.5 + Math.sin((a * Math.PI) / 180) * 19.5
  RUNES[k].forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && put(cx - 2 + i, cy - 2 + j, '#d99a35')))
})

// 4) 가운데 8방위 별 — 긴 살(상하좌우 12) · 짧은 살(대각 7), 왼쪽 밝게 오른쪽 어둡게 + 테두리
const star = new Map()
function ray(angle, len, half) {
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  for (let t = 0; t <= len; t += 0.25) {
    const w = half * (1 - t / len)
    for (let s = -w; s <= w; s += 0.25) {
      const x = Math.round(C - 0.5 + ux * t - uy * s)
      const y = Math.round(C - 0.5 + uy * t + ux * s)
      // 살마다 축을 따라 한쪽 면은 밝게, 다른 면은 어둡게(각진 나침반 별)
      star.set(`${x},${y}`, s < 0 ? '#f7c45b' : '#c8812f')
    }
  }
}
for (let k = 0; k < 8; k++) ray((k * Math.PI) / 4 - Math.PI / 2, k % 2 ? 9 : 14, k % 2 ? 2.6 : 3.4)
// 테두리 먼저(별 주변 1px), 그 위에 별
for (const key of star.keys()) {
  const [x, y] = key.split(',').map(Number)
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!star.has(`${x + dx},${y + dy}`)) put(x + dx, y + dy, '#45140a')
}
for (const [key, col] of star) {
  const [x, y] = key.split(',').map(Number)
  put(x, y, col)
}
// 별 가운데 하이라이트
put(C - 1, C - 1, '#fff3c4')
put(C, C - 1, '#fde39a')
put(C - 1, C, '#fde39a')

const topDown = await sharp(data, { raw: { width: W, height: W, channels: 4 } }).png().toBuffer()
await sharp(topDown).toFile(path.join(OUT_DIR, 'magic_circle_top.png'))

// 5) 쿼터뷰 바닥 타원 — 가로 2배(최근접), 세로 그대로 → 256×128(2:1)
await sharp(topDown).resize(W * 2, W, { kernel: 'nearest', fit: 'fill' }).png().toFile(path.join(OUT_DIR, 'magic_circle.png'))
console.log('ok', OUT_DIR)
