// PixelLab generate-with-style-v2 로 UI 아이콘을 HUD 아이콘(가방·파티·설정·정보)과 같은 화풍으로 생성.
// usage: PIXELLAB_TOKEN=... node scripts/_pixellab/gen-ui-icons.mjs <outDir> <name> "<description>" [seed]
// 후보 이미지를 <outDir>/<name>-<i>.png 로 저장한다.
import fs from 'node:fs'
import path from 'node:path'

const TOKEN = process.env.PIXELLAB_TOKEN
if (!TOKEN) throw new Error('PIXELLAB_TOKEN 환경변수가 필요합니다')
const API = 'https://api.pixellab.ai/v2'
const [outDir, name, description, seed] = process.argv.slice(2)

const STYLE_REFS = ['backpack', 'party', 'settings', 'character'].map((n) => `public/images/icons/hud/${n}.png`)
const style_images = STYLE_REFS.map((f) => ({ image: { type: 'base64', base64: fs.readFileSync(f).toString('base64'), format: 'png' }, width: 64, height: 64 }))

const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const res = await fetch(`${API}/generate-with-style-v2`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    style_images,
    description,
    style_description: 'chunky 64x64 fantasy RPG game UI icon, warm gold and brown palette, dark outline, soft shading, centered single object',
    no_background: true,
    ...(seed ? { seed: Number(seed) } : {}),
  }),
})
const job = await res.json()
if (!res.ok) throw new Error(`요청 실패 ${res.status}: ${JSON.stringify(job).slice(0, 400)}`)
const jobId = job.background_job_id ?? job.job_id ?? job.id
console.log('job', jobId)

for (let i = 0; i < 90; i++) {
  await new Promise((r) => setTimeout(r, 4000))
  const st = await (await fetch(`${API}/background-jobs/${jobId}`, { headers })).json()
  if (st.status === 'completed') {
    const lr = st.last_response ?? {}
    const imgs = lr.images ?? (lr.image ? [lr.image] : [])
    fs.mkdirSync(outDir, { recursive: true })
    imgs.forEach((im, k) => {
      const b64 = (im.base64 ?? im).replace(/^data:image\/\w+;base64,/, '')
      const f = path.join(outDir, `${name}-${k}.png`)
      fs.writeFileSync(f, Buffer.from(b64, 'base64'))
      console.log('saved', f)
    })
    if (!imgs.length) console.log('no images; keys:', Object.keys(lr))
    process.exit(0)
  }
  if (st.status === 'failed') throw new Error(`생성 실패: ${JSON.stringify(st).slice(0, 400)}`)
}
throw new Error('시간 초과')
