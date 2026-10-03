// PixelLab v2 범용 호출 — 요청 JSON 을 보내고(비동기면 background job 폴링) 응답 속 이미지를 전부 PNG 로 저장.
// usage: PIXELLAB_TOKEN=... node scripts/_pixellab/pl-call.mjs <endpoint> <request.json> <outDir> <name>
import fs from 'node:fs'
import path from 'node:path'

const TOKEN = process.env.PIXELLAB_TOKEN
if (!TOKEN) throw new Error('PIXELLAB_TOKEN 환경변수가 필요합니다')
const API = 'https://api.pixellab.ai/v2'
const [endpoint, reqFile, outDir, name] = process.argv.slice(2)
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

/** 응답 객체에서 base64 PNG 를 모두 찾아낸다 */
function collect(obj, out = [], key = '') {
  if (!obj) return out
  if (typeof obj === 'string') {
    if (obj.length > 200 && /^(data:image\/\w+;base64,)?[A-Za-z0-9+/=\s]+$/.test(obj.slice(0, 300))) out.push({ key, b64: obj.replace(/^data:image\/\w+;base64,/, '') })
    return out
  }
  if (Array.isArray(obj)) obj.forEach((v, i) => collect(v, out, `${key}[${i}]`))
  else if (typeof obj === 'object') for (const [k, v] of Object.entries(obj)) collect(v, out, key ? `${key}.${k}` : k)
  return out
}

// Git Bash 는 '/'로 시작하는 인자를 윈도 경로로 바꿔 버리므로 끝 이름만 쓴다
const res = await fetch(`${API}/${endpoint.split('/').pop()}`, { method: 'POST', headers, body: fs.readFileSync(reqFile, 'utf8') })
let body = await res.json()
if (!res.ok) throw new Error(`요청 실패 ${res.status}: ${JSON.stringify(body).slice(0, 600)}`)
const jobId = body.background_job_id ?? body.job_id
if (jobId && !collect(body).length) {
  console.log('job', jobId)
  for (let i = 0; ; i++) {
    if (i > 150) throw new Error('시간 초과')
    await new Promise((r) => setTimeout(r, 4000))
    const st = await (await fetch(`${API}/background-jobs/${jobId}`, { headers })).json()
    if (st.status === 'completed') { body = st.last_response ?? st; break }
    if (st.status === 'failed') throw new Error(`생성 실패: ${JSON.stringify(st).slice(0, 600)}`)
  }
}
fs.mkdirSync(outDir, { recursive: true })
const imgs = collect(body)
imgs.forEach((im, k) => {
  const f = path.join(outDir, `${name}-${k}.png`)
  fs.writeFileSync(f, Buffer.from(im.b64, 'base64'))
})
// 메타(이미지 제외)도 남겨 둔다 — 타일셋은 타일 배치 정보가 필요
const strip = (o) => (typeof o === 'string' && o.length > 200 ? '<b64>' : Array.isArray(o) ? o.map(strip) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, strip(v)])) : o)
fs.writeFileSync(path.join(outDir, `${name}.meta.json`), JSON.stringify(strip(body), null, 1))
console.log(`saved ${imgs.length} images ->`, outDir, imgs.map((i) => i.key).slice(0, 6).join(', '))
