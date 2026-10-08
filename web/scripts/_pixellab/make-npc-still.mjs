// NPC 정지 전신 도트(public/images/npc/<id>.png, 96px) — build-npc-sheets 가 받아 둔 캐시 시트의 남쪽 회전 프레임을
// 정수배(nearest)로 키워 96px 캔버스 가운데·아래에 맞춘다. NPC 목록 아이콘·대화창 초상화 폴백에 쓰인다.
// node scripts/_pixellab/make-npc-still.mjs <id> [...]
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE = path.join(__dirname, 'npc-sheets')
const OUT = path.join(__dirname, '..', '..', 'public', 'images', 'npc')
const SIZE = 96

for (const id of process.argv.slice(2)) {
  const meta = JSON.parse(fs.readFileSync(path.join(CACHE, `${id}.json`), 'utf8')).spritesheet
  const cell = meta.cell_size.width
  const rot = meta.rows.find((r) => r.type === 'rotations')
  const frame = await sharp(path.join(CACHE, `${id}.png`)).extract({ left: 0, top: rot.row * cell, width: cell, height: cell }).png().toBuffer()
  const trimmed = await sharp(frame).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true })
  const k = Math.max(1, Math.floor(Math.min(SIZE / trimmed.info.width, SIZE / trimmed.info.height)))
  const scaled = await sharp(trimmed.data).resize(trimmed.info.width * k, trimmed.info.height * k, { kernel: 'nearest' }).png().toBuffer()
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaled, left: Math.round((SIZE - trimmed.info.width * k) / 2), top: SIZE - trimmed.info.height * k }])
    .png().toFile(path.join(OUT, `${id}.png`))
  console.log(`✓ ${id}.png ×${k}`)
}
