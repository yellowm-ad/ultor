// PixelLab 아이소 타일(블록 형태, 두께 있음)을 기존 평면 타일과 완전히 동일한
// 실루엣(64x64 캔버스, 다이아몬드가 y 0~31에 딱 맞음)으로 강제 정합시킨다.
// 방법: 원본에서 "윗면(다이아몬드 탑페이스)" 32px 띠만 잘라 캔버스 맨 위로 옮기고,
// 최종 알파를 plaza.png 마스크로 덮어써 타 타일과 픽셀 단위로 동일한 모양을 보장한다.
// (참고: scripts/gen-town-tiles.mjs 의 "높이 안 맞아 틈 생김" 버그와 동일 클래스의 문제를 원천 차단)
import sharp from 'sharp'
import path from 'node:path'

const dir = path.resolve('public/images/map/tiles')

async function fit(srcPath, outName) {
  const src = sharp(srcPath).ensureAlpha()
  const { data, info } = await src.raw().toBuffer({ resolveWithObject: true })
  const W = info.width // 64
  let minY = 999
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 10) { minY = y; break }
    }
    if (minY !== 999) break
  }
  // 윗면(top face) 32px 띠 = alpha 시작점부터 32px
  const topBand = await sharp(srcPath).extract({ left: 0, top: minY, width: W, height: 32 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  const mask = await sharp(path.join(dir, 'plaza.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const MW = mask.info.width, MH = mask.info.height // 64x64
  const out = Buffer.alloc(MW * MH * 4)
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      const mi = (y * MW + x) * 4
      const maskA = mask.data[mi + 3]
      const oi = (y * MW + x) * 4
      if (y < 32 && maskA > 10) {
        const si = (y * W + x) * 4
        out[oi] = topBand.data[si]
        out[oi + 1] = topBand.data[si + 1]
        out[oi + 2] = topBand.data[si + 2]
        out[oi + 3] = maskA
      } else {
        out[oi] = out[oi + 1] = out[oi + 2] = out[oi + 3] = 0
      }
    }
  }
  const outPath = path.join(dir, outName)
  await sharp(out, { raw: { width: MW, height: MH, channels: 4 } }).png().toFile(outPath)
  console.log('wrote', outPath)
}

const [, , srcPath, outName] = process.argv
await fit(srcPath, outName)
