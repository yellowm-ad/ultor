// 펫·몬스터 아이콘을 PixelLab 크리처 시트에서 뽑는다 — 옛 벡터 아이콘(SVG) 대체용.
//
//   node scripts/gen-creature-icons.mjs
//   public/images/creatures/<id>.png (8열×4행, 64px 셀) 의 row0 col0(정면 정지) 프레임을
//   투명 여백 트림 → 정사각 패딩 → 128px 로 NEAREST 확대해 저장.
//     펫  : public/images/pets/<id>.png
//     몬스터: public/images/monsters/<id>.png  (이미 있는 보스 일러스트 PNG 는 건드리지 않음)

import sharp from 'sharp'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'public/images/creatures'
const CELL = 64
const OUT_PX = 128
/** 보스는 PixelLab 일러스트 아이콘이 따로 있음 — 덮어쓰지 않는다 */
const BOSS_ART = new Set(['mon-thorn-matriarch', 'mon-ancient-bark-golem', 'mon-jelly-queen', 'mon-reef-king', 'mon-stone-titan-king'])

let made = 0
for (const f of readdirSync(SRC)) {
  if (!f.endsWith('.png')) continue
  const id = f.slice(0, -4)
  const outDir = id.startsWith('mon-') ? 'public/images/monsters' : 'public/images/pets'
  const out = join(outDir, `${id}.png`)
  if (id.startsWith('mon-') && BOSS_ART.has(id)) continue // 보스 전용 일러스트 보존
  const frame = await sharp(join(SRC, f)).extract({ left: 0, top: 0, width: CELL, height: CELL }).png().toBuffer()
  const trimmed = await sharp(frame).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true })
  const side = Math.max(trimmed.info.width, trimmed.info.height) + 4
  // sharp 는 체인 순서와 무관하게 resize 를 composite 보다 먼저 적용하므로 두 단계로 나눈다
  const squared = await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: trimmed.data, left: Math.floor((side - trimmed.info.width) / 2), top: Math.floor((side - trimmed.info.height) / 2) }])
    .png()
    .toBuffer()
  await sharp(squared).resize(OUT_PX, OUT_PX, { kernel: 'nearest' }).png().toFile(out)
  made++
}
console.log(`아이콘 ${made}개 생성`)
