// PixelLab 웹 생성 시트(256×256 = 64px 4×4 변형) 묶음 아틀라스에서 칸을 골라 잘라낸다(2026-11-02 미니게임·UI 도트화).
//   아틀라스: 시트를 가로 8장씩 이어 붙인 PNG(페이지에서 묶어 클립보드로 가져온 것)
//   usage:
//     node scripts/_pixellab/cut-cells.mjs preview <atlas.png> <sheet> <out.png>        — 시트 하나를 4배 + 칸 번호 격자로
//     node scripts/_pixellab/cut-cells.mjs cut <atlas.png> <jobs.json>                  — [{sheet, cell, out, crop?:[x,y,w,h], size?:[w,h], trim?:true}]
//   sheet = 아틀라스 안 순번(0부터), cell = 시트 안 칸(0~15, 행 우선). 큰 시트(128px 2×2, 344×192 1장)는 grid 로 지정.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(process.cwd() + '/package.json')
const sharp = require('sharp')

const [mode, atlas, a3, a4] = process.argv.slice(2)
const SHEET = 256

async function sheetBuf(sheet, w = SHEET, h = SHEET) {
  return sharp(atlas).extract({ left: (sheet % 8) * w, top: Math.floor(sheet / 8) * h, width: w, height: h }).png().toBuffer()
}

if (mode === 'preview') {
  const sheet = +a3
  const buf = await sharp(await sheetBuf(sheet)).resize(SHEET * 3, SHEET * 3, { kernel: 'nearest' }).png().toBuffer()
  // 칸 번호 격자
  const cell = (SHEET * 3) / 4
  let svg = `<svg width="${SHEET * 3}" height="${SHEET * 3}" xmlns="http://www.w3.org/2000/svg">`
  for (let i = 0; i < 16; i++) {
    const x = (i % 4) * cell, y = Math.floor(i / 4) * cell
    svg += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="none" stroke="#ff0" stroke-width="1"/><rect x="${x}" y="${y}" width="22" height="16" fill="#000"/><text x="${x + 3}" y="${y + 13}" fill="#ff0" font-size="13" font-family="monospace">${i}</text>`
  }
  svg += '</svg>'
  await sharp({ create: { width: SHEET * 3, height: SHEET * 3, channels: 4, background: { r: 90, g: 90, b: 100, alpha: 1 } } })
    .composite([{ input: buf }, { input: Buffer.from(svg) }])
    .png()
    .toFile(a4)
  console.log('preview →', a4)
} else if (mode === 'cut') {
  const jobs = JSON.parse(fs.readFileSync(a3, 'utf8'))
  for (const j of jobs) {
    const sw = j.sheetSize?.[0] ?? SHEET, sh = j.sheetSize?.[1] ?? SHEET
    const grid = j.grid ?? 4
    const cw = sw / grid, ch = sh / grid
    let img = sharp(await sheetBuf(j.sheet, sw, sh)).extract({ left: (j.cell % grid) * cw, top: Math.floor(j.cell / grid) * ch, width: cw, height: ch })
    let buf = await img.png().toBuffer()
    if (j.crop) buf = await sharp(buf).extract({ left: j.crop[0], top: j.crop[1], width: j.crop[2], height: j.crop[3] }).png().toBuffer()
    if (j.trim) buf = await sharp(buf).trim({ threshold: 1 }).png().toBuffer()
    if (j.flip) buf = await sharp(buf).flop().png().toBuffer()
    if (j.size) buf = await sharp(buf).resize(j.size[0], j.size[1], { kernel: 'nearest', fit: 'fill' }).png().toBuffer()
    fs.mkdirSync(path.dirname(j.out), { recursive: true })
    await sharp(buf).png({ compressionLevel: 9 }).toFile(j.out)
    const m = await sharp(j.out).metadata()
    console.log('→', j.out, m.width + 'x' + m.height)
  }
}
