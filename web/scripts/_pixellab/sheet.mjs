// contact sheet: node sheet.mjs <out.png> <cell> <cols> <files...>
import sharp from 'sharp'
import path from 'node:path'
const [out, cellS, colsS, ...files] = process.argv.slice(2)
const cell = +cellS, cols = +colsS
const rows = Math.ceil(files.length / cols)
const comp = []
for (let i = 0; i < files.length; i++) {
  const b = await sharp(files[i]).resize(cell - 8, cell - 8, { fit: 'inside', kernel: 'nearest', withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true })
  comp.push({ input: b.data, left: (i % cols) * cell + ((cell - b.info.width) >> 1), top: Math.floor(i / cols) * cell + (cell - b.info.height) })
}
await sharp({ create: { width: cols * cell, height: rows * cell, channels: 4, background: '#6b7f5a' } }).composite(comp).png().toFile(out)
console.log(out, files.length)
