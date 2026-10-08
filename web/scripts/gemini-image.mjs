// Gemini 이미지 생성(나노 바나나) — 프롬프트(+ 참고 이미지)로 그림을 만들어 바로 게임 폴더에 PNG 로 저장.
//
// API 키: web/.env.local 에 `GEMINI_API_KEY=...` 한 줄(깃에 안 올라감, .gitignore .env*) 또는 환경변수 GEMINI_API_KEY.
//
// usage:
//   node scripts/gemini-image.mjs --out public/images/npc/portrait-npc-king.png --prompt "..." \
//        [--ref 참고.png ...] [--aspect 1:1] [--size 1K] [--model gemini-3.1-flash-image] [--n 1]
//   --ref   참고 이미지(삼면도·기존 초상화 등) — 여러 개 가능. 스타일·외형을 맞출 때
//   --n     여러 장이면 out 이름 뒤에 -1, -2 … 를 붙여 저장
//   --raw   PNG 변환 없이 받은 그대로(jpeg 등) 저장
//
// 엔드포인트: POST https://generativelanguage.googleapis.com/v1beta/interactions (Gemini API 이미지 생성 문서 2026-10 기준)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB = path.join(__dirname, '..')

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim()
  for (const f of ['.env.local', '.env']) {
    const p = path.join(WEB, f)
    if (!fs.existsSync(p)) continue
    const m = fs.readFileSync(p, 'utf8').match(/^\s*GEMINI_API_KEY\s*=\s*["']?([^"'\r\n]+)/m)
    if (m) return m[1].trim()
  }
  throw new Error('GEMINI_API_KEY 가 없습니다 — web/.env.local 에 GEMINI_API_KEY=... 를 넣어 주세요')
}

function parseArgs(argv) {
  const o = { ref: [], aspect: '1:1', size: '1K', model: 'gemini-3.1-flash-image', n: 1, raw: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const v = () => argv[++i]
    if (a === '--out') o.out = v()
    else if (a === '--prompt') o.prompt = v()
    else if (a === '--ref') o.ref.push(v())
    else if (a === '--aspect') o.aspect = v()
    else if (a === '--size') o.size = v()
    else if (a === '--model') o.model = v()
    else if (a === '--n') o.n = Number(v())
    else if (a === '--raw') o.raw = true
    else throw new Error(`알 수 없는 옵션: ${a}`)
  }
  if (!o.out || !o.prompt) throw new Error('usage: --out <path> --prompt "<text>" [--ref img ...] [--aspect 1:1] [--size 1K] [--model id] [--n 1]')
  return o
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

/** 응답 어디에 있든 base64 이미지 블록을 전부 찾는다(SDK/REST 응답 모양 차이 흡수) — 마지막 것이 최종 결과 */
function collectImages(obj, out = []) {
  if (!obj || typeof obj !== 'object') return out
  if (Array.isArray(obj)) {
    obj.forEach((v) => collectImages(v, out))
    return out
  }
  const mime = obj.mime_type ?? obj.mimeType
  if (typeof obj.data === 'string' && obj.data.length > 200 && (!mime || /^image\//.test(mime))) out.push({ data: obj.data, mime: mime ?? 'image/png' })
  for (const v of Object.values(obj)) collectImages(v, out)
  return out
}

const opts = parseArgs(process.argv.slice(2))
const key = loadKey()
const input = [{ type: 'text', text: opts.prompt }]
for (const r of opts.ref) {
  const p = path.resolve(r)
  input.push({ type: 'image', mime_type: MIME[path.extname(p).toLowerCase()] ?? 'image/png', data: fs.readFileSync(p).toString('base64') })
}

for (let k = 0; k < opts.n; k++) {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: opts.model, input, response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: opts.aspect, image_size: opts.size } }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Gemini 요청 실패 ${res.status}: ${JSON.stringify(body).slice(0, 600)}`)
  const imgs = collectImages(body)
  if (!imgs.length) throw new Error(`응답에 이미지가 없습니다: ${JSON.stringify(body).slice(0, 600)}`)
  const img = imgs[imgs.length - 1]
  const out = path.resolve(opts.n > 1 ? opts.out.replace(/(\.\w+)?$/, (ext) => `-${k + 1}${ext || '.png'}`) : opts.out)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const buf = Buffer.from(img.data, 'base64')
  if (opts.raw) fs.writeFileSync(out, buf)
  else await sharp(buf).png().toFile(out)
  const m = await sharp(out).metadata()
  console.log(`✓ ${path.relative(WEB, out)}  ${m.width}x${m.height}  (${opts.model})`)
}
