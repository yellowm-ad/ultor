import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

const ROOT = 'C:/겜 개발 백업/게임 개발 파일'
const ICON_SHEET = path.join(ROOT, '속성, 아이템 각종 아이콘.png')
const OUT_BASE = path.join(ROOT, '_master/web/public/images')

/** 배경(어두운 남색) 을 알파로 제거 + trim + 정사각 중앙 배치. rect 는 넉넉하게 줘도 됨(trim 이 알아서 타이트하게). */
async function processIcon(srcPath, rect, outPath, { canvas = 160, pad = 0.16, inset = 6 } = {}) {
  const insetRect = { left: rect.left + inset, top: rect.top + inset, width: rect.width - inset * 2, height: rect.height - inset * 2 }
  const { data, info } = await sharp(srcPath)
    .extract(insetRect)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  // 시트 전체가 같은 어두운 남색 배경(RGB 약 1,9,18) — 모서리 샘플링은 장식 테두리에 걸리면
  // 틀어지므로 고정값 사용
  const bg = [1, 9, 18]
  const out = Buffer.alloc(w * h * 4)
  let minX = w, minY = h, maxX = -1, maxY = -1
  const ALPHA_THRESHOLD = 60
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const dist = Math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2)
      const a = Math.max(0, Math.min(255, (dist - 22) * 4.2))
      out[i] = r
      out[i + 1] = g
      out[i + 2] = b
      out[i + 3] = a
      if (a > ALPHA_THRESHOLD) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < minX) { minX = 0; minY = 0; maxX = w - 1; maxY = h - 1 } // 전부 배경으로만 감지되면 원본 유지(안전장치)
  const keyed = sharp(out, { raw: { width: w, height: h, channels: 4 } })
  const cw = maxX - minX + 1
  const ch = maxY - minY + 1
  const trimmedBuf = await keyed.extract({ left: minX, top: minY, width: cw, height: ch }).png().toBuffer()
  const contentSide = Math.max(cw, ch)
  const side = Math.max(canvas, Math.round(contentSide * (1 + pad * 2)))
  const innerSide = Math.round(side / (1 + pad * 2))
  const resized = await sharp(trimmedBuf)
    .resize({ width: Math.round((cw / contentSide) * innerSide), height: Math.round((ch / contentSide) * innerSide), fit: 'inside' })
    .toBuffer()
  await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, gravity: 'center' }])
    .resize(canvas, canvas)
    .png()
    .toFile(outPath)
}

const ELEMENTS = {
  fire: { left: 4, top: 82, width: 150, height: 190 },
  ice: { left: 150, top: 82, width: 150, height: 190 },
  earth: { left: 288, top: 82, width: 145, height: 190 },
  neutral: { left: 1132, top: 42, width: 145, height: 140 },
}

// 실측 스팬(육안 크롭 확인): 아이템 행 컬럼폭 87px(무기@48→방어구@135→장신구@222→로브@309...),
// 상태 행 컬럼폭 80px(전투@42→방어@122) — 시트 폭 나눈 값(1536/15, 980/14)과 다름. 실측값 사용.
const ITEM_GRID = { n: 15, rowLeft: 5, rowTop: 448, colTotal: 1305, cropW: 74, cropH: 96 }
const ITEM_IDX = { weapon: 0, armor: 1, accessory: 2, potion: 5, tool: 8, feed: 9 }

const STATUS_GRID = { n: 14, rowLeft: 40, rowTop: 662, colTotal: 1030, cropW: 62, cropH: 92 }
const STATUS_NAMES = ['battle', 'defense', 'hp', 'mp', 'heal', 'move', 'detect', 'poison', 'bleed', 'sleep', 'stun', 'burn', 'freeze', 'antimagic']

const MISC = {
  wultor: { left: 1210, top: 250, width: 145, height: 140 },
  'ui-shop': { left: 1160, top: 838, width: 96, height: 96 },
  'ui-map': { left: 1233, top: 838, width: 96, height: 96 },
  'ui-close': { left: 1438, top: 838, width: 96, height: 96 },
}

function gridRect(grid, idx) {
  const colW = grid.colTotal / grid.n
  const cx = grid.rowLeft + colW * idx + colW / 2
  const left = Math.max(0, Math.min(grid.colTotal - grid.cropW, Math.round(cx - grid.cropW / 2)))
  return { left, top: grid.rowTop, width: grid.cropW, height: grid.cropH }
}

async function main() {
  fs.mkdirSync(path.join(OUT_BASE, 'elements'), { recursive: true })
  fs.mkdirSync(path.join(OUT_BASE, 'icons/items'), { recursive: true })
  fs.mkdirSync(path.join(OUT_BASE, 'icons/status'), { recursive: true })
  fs.mkdirSync(path.join(OUT_BASE, 'icons/ui'), { recursive: true })

  for (const [name, rect] of Object.entries(ELEMENTS)) {
    await processIcon(ICON_SHEET, rect, path.join(OUT_BASE, 'elements', `${name}-crest.png`), { canvas: 200, pad: 0.1 })
    console.log('element', name)
  }
  for (const [name, idx] of Object.entries(ITEM_IDX)) {
    await processIcon(ICON_SHEET, gridRect(ITEM_GRID, idx), path.join(OUT_BASE, 'icons/items', `${name}.png`), { canvas: 160, pad: 0.14 })
    console.log('item', name)
  }
  for (let i = 0; i < STATUS_NAMES.length; i++) {
    await processIcon(ICON_SHEET, gridRect(STATUS_GRID, i), path.join(OUT_BASE, 'icons/status', `${STATUS_NAMES[i]}.png`), { canvas: 120, pad: 0.06 })
    console.log('status', STATUS_NAMES[i])
  }
  for (const [name, rect] of Object.entries(MISC)) {
    await processIcon(ICON_SHEET, rect, path.join(OUT_BASE, 'icons/ui', `${name}.png`), { canvas: 160, pad: 0.12 })
    console.log('misc', name)
  }
  console.log('all done')
}

main().catch((e) => { console.error(e); process.exit(1) })
