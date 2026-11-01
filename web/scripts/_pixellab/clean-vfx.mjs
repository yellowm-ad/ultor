// 스킬 이펙트 시트 손질(2026-11-01) — PixelLab 결과에 남는 불량 프레임(배경이 안 빠진 흰 사각형·흰 덩어리·프레임 번호 글자)을 지운다.
// usage: node scripts/_pixellab/clean-vfx.mjs            (아래 FIX 전부)
//   프레임을 비우면 그 칸은 투명 — 재생 중 잠깐 비는 대신 사각형이 번쩍이지 않는다.
import { createRequire } from 'node:module'
const require = createRequire(process.cwd() + '/package.json')
const sharp = require('sharp')

const DIR = 'public/images/battle/vfx/skills'

/** 시트 → { clear: 통째로 비울 프레임, rects: [프레임, x, y, w, h] 부분 지우기, whiteBg: 흰 배경 빼기 } */
const FIX = {
  'dark-veil-dome': { clear: [11, 15], rects: [12, 13, 14].map((f) => [f, 0, 0, 24, 12]) },
  'dark-seal-jaws': { clear: [0, 14, 15] },
  // 지진 — 가운데 크게 깔 때 흰 덩어리 프레임이 사각형으로 번쩍인다
  'earth-high-1-quake': { clear: [4] },
  // 저주의 안개 — 흰 배경이 통째로 안 빠졌다
  'dark-miasma-fog': { whiteBg: true },
  'light-wings': { clear: [14] },
  'dark-miasma-wings': { clear: [8, 9] },
}

export async function clean(name, { clear = [], rects = [], whiteBg = false }) {
  const file = `${DIR}/${name}.png`
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const W = info.width
  const wipe = (f, x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) data[(y * W + f * 64 + x) * 4 + 3] = 0
  }
  for (const f of clear) wipe(f, 0, 0, 64, 64)
  // 흰 배경 — 거의 흰(채도 낮고 밝은) 칸을 투명으로
  if (whiteBg)
    for (let i = 0; i < data.length; i += 4) {
      const lo = Math.min(data[i], data[i + 1], data[i + 2])
      const hi = Math.max(data[i], data[i + 1], data[i + 2])
      if (lo > 222 && hi - lo < 26) data[i + 3] = 0
    }
  for (const [f, x, y, w, h] of rects) wipe(f, x, y, w, h)
  await sharp(data, { raw: { width: W, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(file + '.tmp.png')
  const fs = await import('node:fs')
  fs.renameSync(file + '.tmp.png', file)
}

if (process.argv[1]?.endsWith('clean-vfx.mjs')) {
  const only = process.argv.slice(2)
  for (const [name, fix] of Object.entries(FIX)) {
    if (only.length && !only.includes(name)) continue
    await clean(name, fix)
    console.log('손질', name)
  }
}
