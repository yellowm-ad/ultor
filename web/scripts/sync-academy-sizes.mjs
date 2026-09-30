// lib/maps.ts 의 acs('<file>', w, h) 크기를 public/images/map/props/academy/<file> 실제 PNG 크기로 맞춘다.
//   node scripts/sync-academy-sizes.mjs
import sharp from 'sharp'
import fs from 'node:fs'
const P = 'lib/maps.ts'
const DIR = 'public/images/map/props/academy/'
let src = fs.readFileSync(P, 'utf8')
const re = /acs\('([^']+)', (\d+), (\d+)\)/g
for (const [whole, f] of [...src.matchAll(re)]) {
  if (!fs.existsSync(DIR + f)) { console.log('missing', f); continue }
  const { width, height } = await sharp(DIR + f).metadata()
  src = src.replace(whole, `acs('${f}', ${width}, ${height})`)
}
fs.writeFileSync(P, src)
console.log('synced')
