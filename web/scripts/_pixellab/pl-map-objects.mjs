// PixelLab map-objects 일괄 생성 — 목록 파일을 읽어 맵 오브젝트 PNG 를 만들고 여백을 잘라 저장.
// usage: PIXELLAB_TOKEN=... node scripts/_pixellab/pl-map-objects.mjs <list.txt> [동시실행=4] [이름필터(정규식)]
// 목록 형식(한 줄 1개, # 주석):  group/name | size | description   (끝에 ' | flip' 을 붙이면 좌우반전본 name_f 도 저장)
//   → public/images/map/props/<group>/<name>.png   · 이미 있는 파일은 건너뜀(리롤하려면 파일을 지우고 다시 실행)
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const TOKEN = process.env.PIXELLAB_TOKEN
if (!TOKEN) throw new Error('PIXELLAB_TOKEN 환경변수가 필요합니다')
const API = 'https://api.pixellab.ai/v2'
const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = path.join(WEB, 'public/images/map/props')
const [listFile, concS, filterS] = process.argv.slice(2)
const CONC = Number(concS ?? 4)
const filter = filterS ? new RegExp(filterS) : null
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// '$이름 = 문구' 줄은 변수 — 설명 안의 {이름} 자리에 들어간다(마을별 화풍 문구를 한 번만 적기 위함)
const vars = {}
const jobs = fs.readFileSync(listFile, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => {
  const v = l.match(/^\$(\w+)\s*=\s*(.+)$/)
  if (v) vars[v[1]] = v[2]
  return l && !l.startsWith('#') && !v
}).map((l) => {
  const [id, size, desc, flag] = l.split('|').map((s) => s.trim())
  const description = desc.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
  const [w, h] = size.split('x').map(Number)
  return { id, w, h: h || w, description, flip: flag === 'flip', file: path.join(OUT, id + '.png') }
}).filter((j) => (!filter || filter.test(j.id)) && !fs.existsSync(j.file))
console.log('to generate', jobs.length)

/** 불투명 배경이면 모서리 색 기준으로 지우고 여백을 자른다(clean-prop.mjs 와 같은 처리) */
async function clean(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = info
  const at = (x, y) => (y * W + x) * 4
  if (data[3] > 0) {
    const seen = new Uint8Array(W * H)
    const stack = []
    for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) stack.push([x, y, data.slice(at(x, y), at(x, y) + 3)])
    while (stack.length) {
      const [x, y, ref] = stack.pop()
      if (x < 0 || y < 0 || x >= W || y >= H || seen[y * W + x]) continue
      const i = at(x, y)
      if (data[i + 3] !== 0) {
        if (Math.abs(data[i] - ref[0]) + Math.abs(data[i + 1] - ref[1]) + Math.abs(data[i + 2] - ref[2]) > 22) continue
        data[i + 3] = 0
      }
      seen[y * W + x] = 1
      stack.push([x + 1, y, ref], [x - 1, y, ref], [x, y + 1, ref], [x, y - 1, ref])
    }
  }
  const png = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()
  return sharp(png).trim({ threshold: 1 }).png().toBuffer()
}

async function run(j) {
  const res = await fetch(`${API}/map-objects`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ description: j.description, image_size: { width: j.w, height: j.h }, view: 'low top-down', outline: 'single color outline', shading: 'detailed shading', detail: 'high detail' }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body).slice(0, 300)}`)
  const oid = body.object_id ?? body.id
  for (let i = 0; i < 90; i++) {
    await sleep(5000)
    const st = await fetch(`${API}/map-objects/${oid}`, { headers })
    if (st.status === 423) continue
    if (!st.ok) throw new Error(`poll ${st.status} ${(await st.text()).slice(0, 200)}`)
    const dl = await fetch(`https://api.pixellab.ai/mcp/map-objects/${oid}/download`, { headers })
    if (!dl.ok) throw new Error(`download ${dl.status}`)
    const out = await clean(Buffer.from(await dl.arrayBuffer()))
    fs.mkdirSync(path.dirname(j.file), { recursive: true })
    fs.writeFileSync(j.file, out)
    if (j.flip) await sharp(out).flop().png().toFile(j.file.replace(/\.png$/, '_f.png'))
    const m = await sharp(out).metadata()
    return `${m.width}x${m.height}`
  }
  throw new Error('시간 초과 ' + oid)
}

let next = 0, ok = 0
const fails = []
await Promise.all(Array.from({ length: CONC }, async () => {
  while (next < jobs.length) {
    const j = jobs[next++]
    try { console.log('ok', j.id, await run(j)); ok++ } catch (e) { console.log('FAIL', j.id, String(e.message).slice(0, 200)); fails.push(j.id) }
  }
}))
console.log(`done ${ok}/${jobs.length}`, fails.length ? 'failed: ' + fails.join(', ') : '')
