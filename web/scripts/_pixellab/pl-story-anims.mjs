// story-anims.txt 의 동작을 PixelLab 에 요청(남쪽 8프레임). 이미 같은 이름 애니가 있으면 건너뜀.
// usage: PIXELLAB_TOKEN=... node scripts/_pixellab/pl-story-anims.mjs [id ...]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const TOKEN = process.env.PIXELLAB_TOKEN
if (!TOKEN) throw new Error('PIXELLAB_TOKEN 환경변수가 필요합니다')
const API = 'https://api.pixellab.ai/v2'
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const only = process.argv.slice(2)
const rows = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'story-anims.txt'), 'utf8')
  .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t'))
  .filter(([id]) => !only.length || only.includes(id))
const has = async (charId, name) => {
  const c = await (await fetch(`${API}/characters/${charId}`, { headers })).json()
  return (c.animations ?? []).some((a) => a.display_name === name && (a.directions ?? []).some((d) => d.direction === 'south'))
}
const pending = []
for (const [id, charId, name, action] of rows) {
  if (await has(charId, name)) { console.log('skip', id); continue }
  const res = await fetch(`${API}/animate-character`, { method: 'POST', headers, body: JSON.stringify({ character_id: charId, animation_name: name, action_description: action, frame_count: 8, directions: ['south'] }) })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) { console.log('✗', id, res.status, JSON.stringify(j).slice(0, 200)); continue }
  console.log('→', id); pending.push([id, ...(j.background_job_ids ?? [])])
  await sleep(1500)
}
for (const [id, ...jobs] of pending) for (const job of jobs) {
  for (let i = 0; i < 120; i++) {
    const st = await (await fetch(`${API}/background-jobs/${job}`, { headers })).json()
    if (st.status === 'completed') { console.log('✓', id); break }
    if (st.status === 'failed') { console.log('✗ failed', id); break }
    await sleep(5000)
  }
}
