// PixelLab 으로 만든 맵 오브젝트 PNG 목록 → lib/prop-catalog.ts (관리자 오브젝트 편집의 '추가' 목록)
// 대상: public/images/map/props/** (+ landmark, gather)
// usage: node scripts/build-prop-catalog.mjs
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOTS = ['public/images/map/props', 'public/images/map/landmark']
const items = []
async function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) await walk(p)
    else if (/\.png$/i.test(e.name)) {
      const m = await sharp(p).metadata()
      const rel = path.relative(path.join(WEB, 'public'), p).split(path.sep).join('/')
      const group = path.relative(path.join(WEB, 'public/images/map'), path.dirname(p)).split(path.sep).join('/')
      items.push({ src: '/' + rel, name: e.name.replace(/\.png$/i, ''), group, w: m.width, h: m.height })
    }
  }
}
for (const r of ROOTS) if (fs.existsSync(path.join(WEB, r))) await walk(path.join(WEB, r))
items.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
const out = `// ⚠ 자동 생성 — node scripts/build-prop-catalog.mjs
// 관리자 오브젝트 편집에서 새로 놓을 수 있는 오브젝트 그림(PixelLab 제작 맵 오브젝트)
export interface PropCatalogItem { src: string; name: string; group: string; w: number; h: number }
export const PROP_CATALOG: PropCatalogItem[] = ${JSON.stringify(items, null, 0).replace(/},{/g, '},\n  {')}
`
fs.writeFileSync(path.join(WEB, 'lib/prop-catalog.ts'), out)
console.log('items', items.length)
