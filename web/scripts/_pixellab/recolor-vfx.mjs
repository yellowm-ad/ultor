// 스킬 이펙트 시트 색 바꾸기(2026-11-01) — 밝기를 0~1로 펴서 속성 색 사다리(어두움→밝음)에 다시 입힌다(그라데이션 맵).
//   참고 자료가 없는 대지 스킬(불·얼음 시트 재활용), 빛 시트의 색 변주(축복별 색), 무속성(은빛) 시트를 만든다.
// usage: node scripts/_pixellab/recolor-vfx.mjs            (아래 JOBS 전부)
//        node scripts/_pixellab/recolor-vfx.mjs <dst> ...  (골라서)
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(process.cwd() + '/package.json')
const sharp = require('sharp')

const DIR = 'public/images/battle/vfx/skills'

/** 색 사다리 — 어두운 쪽 → 밝은 쪽 */
export const RAMPS = {
  earth: ['#1e130b', '#4a2f17', '#7a5124', '#a9773a', '#d6a75a', '#f2d79a'],
  stone: ['#1b1a1c', '#3d3835', '#655c52', '#8f8473', '#bdb29c', '#e8e0cc'],
  amber: ['#241205', '#5a2f0c', '#9a5a16', '#d08f2c', '#f2c25a', '#fff0b8'],
  sleep: ['#241a35', '#4d3a6a', '#8a6aa8', '#c9a9d6', '#efd9a8', '#fff6dc'],
  silver: ['#121418', '#333a44', '#5f6a78', '#97a3b2', '#cfd8e2', '#ffffff'],
  might: ['#2a0d08', '#6b1d10', '#b23a18', '#e8722a', '#f8b850', '#fff0b8'],
  wisdom: ['#0f0c2e', '#2a2370', '#4a46c0', '#7f8cf0', '#b9c8ff', '#f0f4ff'],
  bulwark: ['#15151a', '#3b3a40', '#6e6a62', '#a99a70', '#dcc68a', '#fff4c8'],
  ward: ['#061a22', '#0c4256', '#13788f', '#3cb8c8', '#98e8ea', '#f0ffff'],
  haste: ['#0b1f0f', '#1c4d22', '#3b8a35', '#7fc950', '#c8ec7a', '#f8ffd8'],
  crimson: ['#1a0508', '#4a0b14', '#8a1424', '#c8303a', '#f07a70', '#ffe0d8'],
  mint: ['#0b2018', '#165238', '#2c8c5a', '#5cc884', '#a8ecc0', '#f4fff6'],
  focus: ['#0a1020', '#1c2c50', '#3a5890', '#6c94d0', '#b4d0f4', '#ffffff'],
  violet: ['#120818', '#2e1240', '#562076', '#8a3cb4', '#c27ae8', '#f2dcff'],
}

/** [만들 시트, 원본 시트, 색 사다리] */
const JOBS = [
  // 대지 — 참고 자료 없는 스킬은 기존 불·얼음 시트에 색만 입힌다
  ['earth-basic-1-proj', 'ice-basic-1-proj', 'stone'],
  ['earth-basic-1-hit', 'ice-basic-1-hit', 'earth'],
  ['earth-basic-2-shield', 'ice-basic-2-shield', 'amber'],
  ['earth-basic-3-fist', 'fire-basic-3-fist', 'earth'],
  ['earth-basic-3-hit', 'fire-basic-1-hit', 'earth'],
  ['earth-adv-2-spikes', 'ice-high-2-spikes', 'stone'],
  ['earth-adv-2-shield', 'ice-basic-2-shield', 'amber'],
  ['earth-adv-2-ring', 'fire-adv-4-heal', 'amber'],
  ['earth-adv-3-dust', 'ice-adv-2-vortex', 'sleep'],
  ['earth-adv-3-snow', 'ice-adv-2-snow', 'sleep'],
  // 빛 — 축복마다 색만 살짝 다르게
  ['light-halo-might', 'light-halo', 'might'],
  ['light-burst-might', 'light-burst', 'might'],
  ['light-halo-wisdom', 'light-halo', 'wisdom'],
  ['light-burst-wisdom', 'light-burst', 'wisdom'],
  ['light-halo-bulwark', 'light-halo', 'bulwark'],
  ['light-circle-bulwark', 'light-circle', 'bulwark'],
  ['light-halo-ward', 'light-halo', 'ward'],
  ['light-circle-ward', 'light-circle', 'ward'],
  ['light-feathers-ward', 'light-feathers', 'ward'],
  ['light-burst-haste', 'light-burst', 'haste'],
  ['light-circle-haste', 'light-circle', 'haste'],
  ['light-feathers-haste', 'light-feathers', 'haste'],
  ['light-pillar-purify', 'light-pillar', 'ward'],
  // 무속성 — 은빛·푸른빛·붉은빛 변주
  ['neutral-halo', 'light-halo', 'focus'],
  ['neutral-burst', 'light-burst', 'silver'],
  ['neutral-circle', 'light-circle', 'silver'],
  ['neutral-heal', 'light-heal', 'mint'],
  ['neutral-pillar', 'light-pillar', 'focus'],
  ['neutral-halo-crimson', 'light-halo', 'crimson'],
  ['neutral-burst-crimson', 'light-burst', 'crimson'],
  // 어둠 — 쇠약의 저주 안개(보라)
  ['dark-curse-fog', 'dark-miasma-fog', 'violet'],
]

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

export async function recolor(src, dst, rampName) {
  const ramp = RAMPS[rampName].map(hex)
  const { data, info } = await sharp(`${DIR}/${src}.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  // 밝기 분포를 펴서(하위 2% ~ 상위 2%) 사다리 전체를 쓴다
  const ls = []
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 24) ls.push(0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2])
  ls.sort((a, b) => a - b)
  const lo = ls[Math.floor(ls.length * 0.02)] ?? 0
  const hi = ls[Math.floor(ls.length * 0.98)] ?? 255
  const span = Math.max(1, hi - lo)
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue
    const l = Math.min(1, Math.max(0, (0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2] - lo) / span))
    // 도트 느낌 유지 — 사다리 칸으로 끊어 칠한다(섞지 않음)
    const c = ramp[Math.min(ramp.length - 1, Math.round(l * (ramp.length - 1)))]
    data[i] = c[0]
    data[i + 1] = c[1]
    data[i + 2] = c[2]
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(`${DIR}/${dst}.png`)
}

if (process.argv[1]?.endsWith('recolor-vfx.mjs')) {
  const only = process.argv.slice(2)
  for (const [dst, src, ramp] of JOBS) {
    if (only.length && !only.includes(dst)) continue
    if (!fs.existsSync(`${DIR}/${src}.png`)) {
      console.log(`  · 원본 없음(나중에) ${src} → ${dst}`)
      continue
    }
    await recolor(src, dst, ramp)
    console.log('→', dst)
  }
}
