// node scripts/_pixellab/preview.mjs <out.png> <png...>  — 소품 여러 장을 한 장에 나란히(확인용)
import sharp from 'sharp'
const [out, ...files] = process.argv.slice(2)
const metas = await Promise.all(files.map((f) => sharp(f).metadata()))
const H = Math.max(...metas.map((m) => m.height)) + 8
let x = 4; const comp = []
files.forEach((f, i) => { comp.push({ input: f, left: x, top: H - 4 - metas[i].height }); x += metas[i].width + 12 })
await sharp({ create: { width: x, height: H, channels: 4, background: '#4a4a52' } }).composite(comp).png().toFile(out)
