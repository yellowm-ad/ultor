// 사용법: node scripts/clean-prop.mjs <png...>
// PixelLab map-object 가 가끔 불투명 회색 배경으로 나옴 → 네 모서리 색 기준 flood-fill 로 투명화 후 여백 트림.
// 이미 투명(모서리 알파 0)이면 트림만. 결과 크기를 출력(PropDef px 에 그대로 사용).
import sharp from 'sharp'
import fs from 'node:fs'
const TOL = 22
for (const p of process.argv.slice(2)) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = info
  const at = (x, y) => (y * W + x) * 4
  if (data[3] > 0) {
    const seen = new Uint8Array(W * H)
    const stack = []
    for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) stack.push([x, y, data.slice(at(x, y), at(x, y) + 3)])
    while (stack.length) {
      const [x, y, ref] = stack.pop()
      if (x < 0 || y < 0 || x >= W || y >= H || seen[y * W + x]) continue
      const i = at(x, y)
      if (data[i + 3] === 0) { seen[y * W + x] = 1 } else {
        const d = Math.abs(data[i] - ref[0]) + Math.abs(data[i + 1] - ref[1]) + Math.abs(data[i + 2] - ref[2])
        if (d > TOL) continue
        seen[y * W + x] = 1
        data[i + 3] = 0
      }
      stack.push([x + 1, y, ref], [x - 1, y, ref], [x, y + 1, ref], [x, y - 1, ref])
    }
  }
  const buf = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()
  const out = await sharp(buf).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true })
  fs.writeFileSync(p, out.data)
  console.log(p.split('/').pop(), out.info.width + 'x' + out.info.height)
}
