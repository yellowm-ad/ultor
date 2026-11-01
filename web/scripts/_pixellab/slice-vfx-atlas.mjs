// PixelLab 웹 「Create animated object」(64×64 · 4×4 = 16프레임) 결과를 한 장으로 묶은 아틀라스를
// 스킬 연출용 가로 띠(1024×64, lib/skill-vfx)로 자른다(2026-11-01).
// usage: node scripts/_pixellab/slice-vfx-atlas.mjs <atlas.png> <order.json>
//   atlas: 256×256 시트를 8열로 이어 붙인 그림 · order.json: 시트 이름 배열(아틀라스 순서)
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(process.cwd() + '/package.json')
const sharp = require('sharp')

const [atlas, orderFile] = process.argv.slice(2)
const order = JSON.parse(fs.readFileSync(orderFile, 'utf8'))
const OUT = 'public/images/battle/vfx/skills'
/** 세로로 몇 배 굵게 펼까 */
const THICKEN = { 'fire-master-1-cannon-stream': 3, 'dark-sentence-bolt': 1.8 }
fs.mkdirSync(OUT, { recursive: true })
for (let n = 0; n < order.length; n++) {
  const ox = (n % 8) * 256
  const oy = Math.floor(n / 8) * 256
  const frames = []
  for (let f = 0; f < 16; f++) {
    const cell = sharp(atlas).extract({ left: ox + (f % 4) * 64, top: oy + Math.floor(f / 4) * 64, width: 64, height: 64 })
    // 배경 제거 잔여물 — 불 시트의 끝 프레임에 남는 흰 덩어리(밝은 픽셀이 대부분인 프레임)는 비운다
    if (order[n].startsWith('fire-') && f >= 10) {
      const { data } = await cell.clone().raw().ensureAlpha().toBuffer({ resolveWithObject: true })
      let solid = 0
      let pale = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 40) continue
        solid++
        const lo = Math.min(data[i], data[i + 1], data[i + 2])
        if (lo > 170) pale++
      }
      if (solid > 60 && pale / solid > 0.55) {
        console.log(`  · ${order[n]} 프레임 ${f} 잔여물 비움`)
        continue
      }
    }
    // 굵게 — 가늘게 나온 빔 줄기는 가운데를 기준으로 세로로 늘린다(도트 그대로, 2026-11-01 에너지포)
    const thick = THICKEN[order[n]]
    if (thick) {
      const h = Math.round(64 / thick)
      const band = await cell.clone().png().toBuffer()
      const mid = await sharp(band).extract({ left: 0, top: Math.round((64 - h) / 2), width: 64, height: h }).resize(64, 64, { kernel: 'nearest', fit: 'fill' }).png().toBuffer()
      frames.push({ input: mid, left: f * 64, top: 0 })
      continue
    }
    frames.push({ input: await cell.png().toBuffer(), left: f * 64, top: 0 })
  }
  const file = `${OUT}/${order[n]}.png`
  await sharp({ create: { width: 1024, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(frames).png({ compressionLevel: 9 }).toFile(file)
  console.log('→', file)
}
