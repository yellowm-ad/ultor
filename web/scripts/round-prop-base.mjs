// 사각형으로 잘린 소품 밑동을 둥근 둔덕으로 깎는다(2026-10-07) — 원본 그림이 이미지 테두리에서 잘려
// 바닥·옆면이 일자로 끊겨 보이던 화산 첨탑·바위. 아래쪽 rows 줄을 타원으로 깎고, 깎인 가장자리에 어두운 외곽선을 다시 넣는다.
// usage: node scripts/round-prop-base.mjs <in.png> <out.png> <rows> [outlineHex]
import sharp from 'sharp'

const [src, dst, rowsArg, hex = '1a1220'] = process.argv.slice(2)
const rows = Number(rowsArg)
const OL = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H } = info
const A = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : data[(y * W + x) * 4 + 3])

// 그림이 실제로 차지하는 가로 범위(아래쪽 기준)로 타원 중심·반지름을 잡는다
let x0 = W
let x1 = -1
for (let y = H - rows; y < H; y++)
  for (let x = 0; x < W; x++)
    if (A(x, y) > 128) {
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
    }
const cx = (x0 + x1) / 2
const rx = (x1 - x0) / 2 + 0.5
const top = H - rows
const cut = new Uint8Array(W * H)
for (let y = top; y < H; y++) {
  const t = (y - top + 0.5) / rows
  const hw = rx * Math.sqrt(Math.max(0, 1 - t * t))
  for (let x = 0; x < W; x++)
    if (Math.abs(x + 0.5 - cx) > hw && A(x, y) > 0) {
      data[(y * W + x) * 4 + 3] = 0
      cut[y * W + x] = 1
    }
}
// 깎인 자리에 맞닿은 픽셀 → 외곽선
const out = Buffer.from(data)
for (let y = top - 1; y < H; y++)
  for (let x = 0; x < W; x++) {
    if (A(x, y) < 128) continue
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx
      const ny = y + dy
      return ny >= H || nx < 0 || nx >= W || (cut[ny * W + nx] && A(nx, ny) === 0)
    })
    if (!edge) continue
    const o = (y * W + x) * 4
    out[o] = OL[0]
    out[o + 1] = OL[1]
    out[o + 2] = OL[2]
    out[o + 3] = 255
  }
await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(dst)
console.log('rounded', src, '->', dst)
