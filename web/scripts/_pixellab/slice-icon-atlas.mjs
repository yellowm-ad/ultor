// PixelLab 웹(Creator · Pro 64x64)에서 고른 아이콘을 한 장으로 묶은 아틀라스를 칸별 PNG 로 자른다(2026-10-31).
// usage: node scripts/_pixellab/slice-icon-atlas.mjs <atlas.png>
// 순서는 아틀라스를 만든 순서 그대로(8열 × 64px). ui-* 는 HUD·메뉴 아이콘, 나머지는 public/images/items/<id>.png
import { createRequire } from 'node:module'
const require = createRequire(process.cwd() + '/package.json')
const sharp = require('sharp')

const ORDER = ['ui-cat-scroll', 'ui-magic-summon', 'ui-magic', 'acc-pendant-vitality', 'acc-charm-ward', 'acc-ring-luck', 'scroll-mastery-dark', 'scroll-mastery-earth', 'robe-t1', 'wand-light-t5', 'wand-light-t3', 'wand-light-t1', 'wand-dark-t5', 'wand-dark-t3', 'wand-dark-t1', 'wand-earth-t5', 'wand-earth-t1', 'wand-ice-t5', 'wand-ice-t3', 'wand-ice-t1', 'wand-fire-t5', 'wand-fire-t3', 'wand-fire-t1', 'ui-craft-enhance', 'acc-band-swift', 'acc-brooch-guard', 'acc-amulet-mana', 'scroll-mastery-light', 'scroll-mastery-high', 'scroll-mastery-ice', 'scroll-mastery-fire', 'scroll-mastery', 'robe-t5', 'robe-t4', 'wand-earth-t3', 'robe-t2', 'robe-t3']
const UI_OUT = {
  'ui-magic': 'public/images/icons/hud/magic.png',
  'ui-magic-summon': 'public/images/icons/menu/magic-summon.png',
  'ui-craft-enhance': 'public/images/icons/menu/craft-enhance.png',
  'ui-cat-scroll': 'public/images/icons/menu/cat-scroll.png',
}
const src = process.argv[2]
for (let n = 0; n < ORDER.length; n++) {
  const id = ORDER[n]
  const out = UI_OUT[id] ?? `public/images/items/${id}.png`
  await sharp(src).extract({ left: (n % 8) * 64, top: Math.floor(n / 8) * 64, width: 64, height: 64 }).png({ compressionLevel: 9 }).toFile(out)
  console.log('→', out)
}
