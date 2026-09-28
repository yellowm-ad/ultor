// 마을 바닥 타일 텍스처 완화 — 반복 타일의 강한 균열선/줄눈 대비를 평균색 쪽으로 당겨 눈피로를 줄인다.
// 사용: node scripts/soften-village-tiles.mjs <원본폴더>  (원본 → public/images/map/tiles 로 출력, 재실행해도 누적 안 됨)
import sharp from 'sharp'
import path from 'node:path'

const SRC = process.argv[2]
if (!SRC) throw new Error('원본 타일 폴더 경로를 넘겨주세요')
const OUT = 'public/images/map/tiles'
// k = 평균색과의 차이를 남길 비율 (1 = 원본, 0 = 단색)
const JOBS = [
  { file: 'plaza.png', k: 0.28 },
  { file: 'path.png', k: 0.5 },
  { file: 'grass.png', k: 0.7 },
  { file: 'grass-dark.png', k: 0.7 },
]

for (const { file, k } of JOBS) {
  const { data, info } = await sharp(path.join(SRC, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const sum = [0, 0, 0]
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue
    for (let c = 0; c < 3; c++) sum[c] += data[i + c]
    n++
  }
  const mean = sum.map((v) => v / n)
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(mean[c] + (data[i + c] - mean[c]) * k)
  }
  await sharp(data, { raw: info }).png().toFile(path.join(OUT, file))
  console.log(file, 'mean', mean.map((v) => v.toFixed(0)).join(','), 'k', k)
}
